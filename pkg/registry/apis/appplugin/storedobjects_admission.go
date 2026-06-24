package appplugin

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/pluginschema"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/admission"
)

// Validate implements builder.APIGroupValidation. It dispatches to the
// plugin's gRPC ValidateAdmission only when the admission attributes target a
// declared stored object that opts into validation for the operation;
// everything else (settings, other kinds, non-opt-in operations) passes
// through unchanged.
func (b *AppPluginAPIBuilder) Validate(ctx context.Context, a admission.Attributes, _ admission.ObjectInterfaces) error {
	kind, ok := b.findStoredObjectKind(a)
	if !ok {
		return nil
	}
	op, ok := mapStoredObjectOperation(a.GetOperation())
	if !ok {
		return nil
	}
	if !storedObjectOpsContain(kind.Validation, op) {
		return nil
	}

	ctx, req, err := b.toBackendAdmissionRequest(ctx, a, op)
	if err != nil {
		return err
	}
	resp, err := b.client.ValidateAdmission(ctx, req)
	if err != nil {
		return fmt.Errorf("plugin %s validate admission: %w", b.pluginJSON.ID, err)
	}
	if resp == nil {
		return fmt.Errorf("plugin %s returned nil validation response", b.pluginJSON.ID)
	}
	if resp.Allowed {
		return nil
	}
	return storedObjectAdmissionDeniedError(b.pluginJSON.ID, resp.Result)
}

// Mutate implements builder.APIGroupMutation. Same gating semantics as
// Validate: only declared stored objects with a mutation opt-in for the
// operation route to the plugin. When the plugin returns mutated bytes,
// those are decoded back into the live object in place so the admission
// pipeline sees the mutation.
func (b *AppPluginAPIBuilder) Mutate(ctx context.Context, a admission.Attributes, _ admission.ObjectInterfaces) error {
	kind, ok := b.findStoredObjectKind(a)
	if !ok {
		return nil
	}
	op, ok := mapStoredObjectOperation(a.GetOperation())
	if !ok {
		return nil
	}
	if !storedObjectOpsContain(kind.Mutation, op) {
		return nil
	}

	ctx, req, err := b.toBackendAdmissionRequest(ctx, a, op)
	if err != nil {
		return err
	}
	resp, err := b.client.MutateAdmission(ctx, req)
	if err != nil {
		return fmt.Errorf("plugin %s mutate admission: %w", b.pluginJSON.ID, err)
	}
	if resp == nil {
		return fmt.Errorf("plugin %s returned nil mutation response", b.pluginJSON.ID)
	}
	if !resp.Allowed {
		return storedObjectAdmissionDeniedError(b.pluginJSON.ID, resp.Result)
	}
	if len(resp.ObjectBytes) == 0 {
		return nil
	}
	live := a.GetObject()
	if live == nil {
		return fmt.Errorf("plugin %s returned mutation but admission attributes have no object", b.pluginJSON.ID)
	}
	if err := json.Unmarshal(resp.ObjectBytes, live); err != nil {
		return fmt.Errorf("decoding mutated object from plugin %s: %w", b.pluginJSON.ID, err)
	}
	return nil
}

// findStoredObjectKind returns the declared stored object matching the
// admission attributes, or false if the request targets a kind the builder
// doesn't own (e.g. the settings resource itself, or another builder's kind
// under the same group).
func (b *AppPluginAPIBuilder) findStoredObjectKind(a admission.Attributes) (storedObjectKind, bool) {
	kinds, err := b.parseStoredObjects()
	if err != nil || len(kinds) == 0 {
		return storedObjectKind{}, false
	}
	gvk := a.GetKind()
	if gvk.Group != b.groupVersion.Group || gvk.Version != b.groupVersion.Version {
		return storedObjectKind{}, false
	}
	for _, k := range kinds {
		if k.Kind == gvk.Kind {
			return k, true
		}
	}
	return storedObjectKind{}, false
}

func (b *AppPluginAPIBuilder) toBackendAdmissionRequest(ctx context.Context, a admission.Attributes, op backend.AdmissionRequestOperation) (context.Context, *backend.AdmissionRequest, error) {
	// Resolve plugin context through the same path the rest of this builder
	// uses for CallResource and health. This pulls the app's settings,
	// decrypts secure values, and returns a PluginContext bound to the
	// caller's identity.
	ctx, pluginCtx, err := b.getPluginContext(ctx)
	if err != nil {
		return ctx, nil, fmt.Errorf("getting plugin context for %s: %w", b.pluginJSON.ID, err)
	}
	req := &backend.AdmissionRequest{
		PluginContext: pluginCtx,
		Operation:     op,
		Kind: backend.GroupVersionKind{
			Group:   a.GetKind().Group,
			Version: a.GetKind().Version,
			Kind:    a.GetKind().Kind,
		},
	}
	if obj := a.GetObject(); obj != nil {
		bytes, err := encodeAdmissionObject(obj)
		if err != nil {
			return ctx, nil, err
		}
		req.ObjectBytes = bytes
	}
	if old := a.GetOldObject(); old != nil {
		bytes, err := encodeAdmissionObject(old)
		if err != nil {
			return ctx, nil, err
		}
		req.OldObjectBytes = bytes
	}
	return ctx, req, nil
}

func encodeAdmissionObject(obj runtime.Object) ([]byte, error) {
	bytes, err := json.Marshal(obj)
	if err != nil {
		return nil, fmt.Errorf("marshaling admission object: %w", err)
	}
	return bytes, nil
}

func mapStoredObjectOperation(verb admission.Operation) (backend.AdmissionRequestOperation, bool) {
	switch verb {
	case admission.Create:
		return backend.AdmissionRequestCreate, true
	case admission.Update:
		return backend.AdmissionRequestUpdate, true
	case admission.Delete:
		return backend.AdmissionRequestDelete, true
	default:
		return 0, false
	}
}

func storedObjectOpsContain(declared []pluginschema.AdmissionOperation, op backend.AdmissionRequestOperation) bool {
	if len(declared) == 0 {
		return false
	}
	target := storedObjectOpToSchema(op)
	for _, d := range declared {
		if d == target {
			return true
		}
	}
	return false
}

func storedObjectOpToSchema(op backend.AdmissionRequestOperation) pluginschema.AdmissionOperation {
	switch op {
	case backend.AdmissionRequestCreate:
		return pluginschema.AdmissionOperationCreate
	case backend.AdmissionRequestUpdate:
		return pluginschema.AdmissionOperationUpdate
	case backend.AdmissionRequestDelete:
		return pluginschema.AdmissionOperationDelete
	default:
		return ""
	}
}

func storedObjectAdmissionDeniedError(pluginID string, result *backend.StatusResult) error {
	if result == nil {
		return fmt.Errorf("plugin %s denied admission", pluginID)
	}
	if result.Message != "" {
		return fmt.Errorf("plugin %s denied admission: %s", pluginID, result.Message)
	}
	if result.Reason != "" {
		return fmt.Errorf("plugin %s denied admission: %s", pluginID, result.Reason)
	}
	return fmt.Errorf("plugin %s denied admission", pluginID)
}
