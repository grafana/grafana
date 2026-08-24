package pluginmanifest

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	jsonpatch "gopkg.in/evanphx/json-patch.v4"
	admissionv1beta1 "k8s.io/api/admission/v1beta1"
	authnv1 "k8s.io/api/authentication/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// validateRoutePath and mutateRoutePath are the standard kubernetes admission webhook paths the
// plugin backend exposes. They consume an admission/v1beta1.AdmissionReview (with .Request set)
// and respond with an AdmissionReview (with .Response set), exactly as the grafana-app-sdk
// WebhookHandler does — so app.AdmissionRequest objects flow over the wire natively without any
// conversion to the plugin gRPC admission types.
const (
	validateRoutePath = "/validate"
	mutateRoutePath   = "/mutate"
)

// Validate proxies validating admission to the plugin's backend via a CallResource POST to the
// "/validate" webhook path. The SDK only calls this for manifest kinds that declare validation
// capabilities.
func (a *pluginBackendApp) Validate(ctx context.Context, req *app.AdmissionRequest) error {
	resp, err := a.callAdmissionWebhook(ctx, validateRoutePath, req)
	if err != nil {
		return err
	}
	if resp.Allowed {
		return nil
	}
	return admissionDeniedError(a.pluginID, resp.Result)
}

// Mutate proxies mutating admission to the plugin's backend via a CallResource POST to the
// "/mutate" webhook path. The SDK only calls this for manifest kinds that declare mutation
// capabilities. The webhook returns a JSONPatch (per the kubernetes admission contract), which is
// applied to the incoming object to produce the mutated result.
func (a *pluginBackendApp) Mutate(ctx context.Context, req *app.AdmissionRequest) (*app.MutatingResponse, error) {
	objBytes, err := marshalAdmissionObject(req.Object)
	if err != nil {
		return nil, err
	}

	resp, err := a.callAdmissionWebhook(ctx, mutateRoutePath, req)
	if err != nil {
		return nil, err
	}
	if !resp.Allowed {
		return nil, admissionDeniedError(a.pluginID, resp.Result)
	}
	if len(resp.Patch) == 0 {
		return &app.MutatingResponse{}, nil
	}

	patch, err := jsonpatch.DecodePatch(resp.Patch)
	if err != nil {
		return nil, fmt.Errorf("decoding mutation patch from plugin %s: %w", a.pluginID, err)
	}
	patched, err := patch.Apply(objBytes)
	if err != nil {
		return nil, fmt.Errorf("applying mutation patch from plugin %s: %w", a.pluginID, err)
	}

	// The mutated object must unmarshal into a *manifestObject: the SDK's appAdmission.Admit
	// reflect-copies UpdatedObject into the live object, whose concrete type is *manifestObject.
	// A different type would panic in reflect.Set.
	updated := &manifestObject{}
	if err := json.Unmarshal(patched, updated); err != nil {
		return nil, fmt.Errorf("decoding mutated object from plugin %s: %w", a.pluginID, err)
	}
	return &app.MutatingResponse{UpdatedObject: updated}, nil
}

// callAdmissionWebhook builds a kubernetes AdmissionReview from req, POSTs it (JSON-encoded) to the
// given webhook path via CallResource, and returns the decoded AdmissionResponse.
func (a *pluginBackendApp) callAdmissionWebhook(ctx context.Context, path string, req *app.AdmissionRequest) (*admissionv1beta1.AdmissionResponse, error) {
	review, err := a.toAdmissionReview(req)
	if err != nil {
		return nil, err
	}

	body, err := json.Marshal(review)
	if err != nil {
		return nil, fmt.Errorf("marshaling admission review: %w", err)
	}

	pluginCtx, err := a.resolvePluginContext(ctx)
	if err != nil {
		return nil, fmt.Errorf("getting plugin context for %s: %w", a.pluginID, err)
	}

	crReq := &backend.CallResourceRequest{
		PluginContext: pluginCtx,
		Path:          path,
		Method:        http.MethodPost,
		Headers:       map[string][]string{"Content-Type": {"application/json"}},
		Body:          body,
	}

	resp, err := a.callResourceBuffered(ctx, crReq)
	if err != nil {
		return nil, err
	}
	if resp.Status >= http.StatusBadRequest {
		return nil, fmt.Errorf("admission webhook failed for plugin %s: status %d: %s", a.pluginID, resp.Status, resp.Body)
	}

	var respReview admissionv1beta1.AdmissionReview
	if err := json.Unmarshal(resp.Body, &respReview); err != nil {
		return nil, fmt.Errorf("decoding admission review from plugin %s: %w", a.pluginID, err)
	}
	if respReview.Response == nil {
		return nil, fmt.Errorf("admission review from plugin %s has no response", a.pluginID)
	}
	return respReview.Response, nil
}

// toAdmissionReview converts the SDK admission request into a kubernetes AdmissionReview request,
// the wire format the plugin's /validate and /mutate webhook handlers consume.
func (a *pluginBackendApp) toAdmissionReview(req *app.AdmissionRequest) (*admissionv1beta1.AdmissionReview, error) {
	op, err := toAdmissionOperation(req.Action)
	if err != nil {
		return nil, err
	}

	admReq := &admissionv1beta1.AdmissionRequest{
		Operation: op,
		Kind: metav1.GroupVersionKind{
			Group:   req.Group,
			Version: req.Version,
			Kind:    req.Kind,
		},
		UserInfo: authnv1.UserInfo{
			Username: req.UserInfo.Username,
			UID:      req.UserInfo.UID,
			Groups:   req.UserInfo.Groups,
		},
	}
	if req.Object != nil {
		b, err := marshalAdmissionObject(req.Object)
		if err != nil {
			return nil, err
		}
		admReq.Object = runtime.RawExtension{Raw: b}
	}
	if req.OldObject != nil {
		b, err := marshalAdmissionObject(req.OldObject)
		if err != nil {
			return nil, err
		}
		admReq.OldObject = runtime.RawExtension{Raw: b}
	}

	return &admissionv1beta1.AdmissionReview{
		TypeMeta: metav1.TypeMeta{
			APIVersion: admissionv1beta1.SchemeGroupVersion.String(),
			Kind:       "AdmissionReview",
		},
		Request: admReq,
	}, nil
}

// marshalAdmissionObject serializes a resource.Object to its full JSON envelope (apiVersion, kind,
// metadata, spec, ...), the representation the plugin webhook expects in Object/OldObject.
func marshalAdmissionObject(obj resource.Object) ([]byte, error) {
	b, err := json.Marshal(obj)
	if err != nil {
		return nil, fmt.Errorf("marshaling admission object: %w", err)
	}
	return b, nil
}

// toAdmissionOperation maps the SDK admission action to the kubernetes admission operation. The
// webhook supports CONNECT, so every action maps cleanly; an unknown action is an error.
func toAdmissionOperation(action resource.AdmissionAction) (admissionv1beta1.Operation, error) {
	switch action {
	case resource.AdmissionActionCreate:
		return admissionv1beta1.Create, nil
	case resource.AdmissionActionUpdate:
		return admissionv1beta1.Update, nil
	case resource.AdmissionActionDelete:
		return admissionv1beta1.Delete, nil
	case resource.AdmissionActionConnect:
		return admissionv1beta1.Connect, nil
	default:
		return "", fmt.Errorf("unknown admission action %q", action)
	}
}

// callResourceBuffered issues a single-shot CallResource and returns the buffered response, sparing
// callers from implementing a streaming backend.CallResourceResponseSender. It is meant for
// request/response style plugin routes (like the admission webhooks) that reply with one response.
func (a *pluginBackendApp) callResourceBuffered(ctx context.Context, req *backend.CallResourceRequest) (*backend.CallResourceResponse, error) {
	var resp *backend.CallResourceResponse
	sender := backend.CallResourceResponseSenderFunc(func(r *backend.CallResourceResponse) error {
		resp = r
		return nil
	})
	if err := a.client.CallResource(ctx, req, sender); err != nil {
		return nil, err
	}
	if resp == nil {
		return nil, fmt.Errorf("no response from plugin %s for %s", a.pluginID, req.Path)
	}
	return resp, nil
}

func admissionDeniedError(pluginID string, result *metav1.Status) error {
	if result != nil && result.Message != "" {
		return errors.New(result.Message)
	}
	if result != nil && result.Reason != "" {
		return errors.New(string(result.Reason))
	}
	return fmt.Errorf("admission denied by plugin %s", pluginID)
}
