package kindstore

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/warning"

	"github.com/grafana/grafana-app-sdk/app"
	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
)

// admissionOps is the set of operations one admission capability is declared for.
type admissionOps map[admission.Operation]bool

// newAdmissionOps expands a manifest capability's operations. CONNECT is dropped:
// the v3 admission request cannot express it, connect requests reach the plugin
// through custom routes instead, and admission never sees one anyway -- those
// requests name a subresource, which [AppPluginAPIBuilder.kindStoreFor] skips.
// Recording it would only fail a kind that declares nothing else at startup, for
// a hook that could never be called.
func newAdmissionOps(ops []app.AdmissionOperation) admissionOps {
	out := admissionOps{}
	for _, op := range ops {
		switch op {
		case app.AdmissionOperationAny:
			out[admission.Create] = true
			out[admission.Update] = true
			out[admission.Delete] = true
		case app.AdmissionOperationCreate:
			out[admission.Create] = true
		case app.AdmissionOperationUpdate:
			out[admission.Update] = true
		case app.AdmissionOperationDelete:
			out[admission.Delete] = true
		case app.AdmissionOperationConnect:
			// Dropped: see above.
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

// MutateAdmission asks the plugin to mutate the incoming object and applies the
// result in place. It is a no-op unless the manifest declared mutation for this
// operation.
//
// One AdmissionReview answers both halves: the response carries the mutated object
// and the allow/deny decision together, so a kind that declares both capabilities
// is reviewed here and ValidateAdmission has nothing left to ask.
func (s *Store) MutateAdmission(ctx context.Context, a admission.Attributes) error {
	if !s.mutation[a.GetOperation()] {
		return nil
	}
	rsp, err := s.admissionReview(ctx, a)
	if err != nil {
		return err
	}
	raw := rsp.GetObjectBytes()
	if len(raw) == 0 {
		return nil // the hook left the object unchanged
	}
	// A delete review carries only the stored object, so there is nothing to
	// mutate in place. A hook that handles every operation with one code path
	// still echoes an object back, and failing the request over it would break
	// DELETE for the kind entirely.
	if a.GetOperation() == admission.Delete {
		return nil
	}
	return s.applyMutation(a.GetObject(), raw)
}

// ValidateAdmission asks the plugin whether the operation may proceed. It is a
// no-op unless the manifest declared validation for this operation, and unless the
// mutating phase skipped it: that call already carried the plugin's decision.
func (s *Store) ValidateAdmission(ctx context.Context, a admission.Attributes) error {
	op := a.GetOperation()
	if !s.validation[op] || s.mutation[op] {
		return nil
	}
	_, err := s.admissionReview(ctx, a)
	return err
}

// admissionReview sends one AdmissionReview to the plugin, surfaces its warnings
// and turns a denial into an API error.
func (s *Store) admissionReview(ctx context.Context, a admission.Attributes) (*pluginv3.AdmissionReviewResponse, error) {
	op, ok := admissionOperation(a.GetOperation())
	if !ok {
		// Unreachable: newAdmissionOps only records the three operations the v3
		// request can express. Fail closed rather than admit an operation the
		// kind asked to have reviewed and never was.
		return nil, apierrors.NewInternalError(fmt.Errorf(
			"admission hook for %s cannot review a %q request", s.gvk.Kind, a.GetOperation()))
	}

	gvk := &pluginv3.GroupVersionKind{}
	gvk.SetGroup(s.gvk.Group)
	gvk.SetVersion(s.gvk.Version)
	gvk.SetKind(s.gvk.Kind)

	req := &pluginv3.AdmissionReviewRequest{}
	req.SetOperation(op)
	req.SetKind(gvk)
	// DELETE carries only the stored object; CREATE carries only the incoming one.
	if obj := a.GetObject(); obj != nil {
		raw, err := json.Marshal(obj)
		if err != nil {
			return nil, apierrors.NewInternalError(err)
		}
		req.SetObjectBytes(raw)
	}
	if old := a.GetOldObject(); old != nil {
		raw, err := json.Marshal(old)
		if err != nil {
			return nil, apierrors.NewInternalError(err)
		}
		req.SetOldObjectBytes(raw)
	}

	rsp, err := s.admission.AdmissionReview(ctx, req)
	if err != nil {
		// A kind that declares admission cannot be written without it, so a
		// transport failure has to fail the request rather than admit silently.
		var status apierrors.APIStatus
		if errors.As(err, &status) {
			return nil, err
		}
		return nil, apierrors.NewInternalError(
			fmt.Errorf("admission hook for %s failed: %w", s.gvk.Kind, err))
	}

	for _, w := range rsp.GetWarnings() {
		warning.AddWarning(ctx, "", w)
	}
	if rsp.GetError() != nil || !rsp.GetAllowed() {
		return nil, s.admissionDenied(rsp.GetError())
	}
	return rsp, nil
}

// applyMutation replaces the object's contents with the plugin's version, keeping
// the identity the request path and storage key were already derived from.
func (s *Store) applyMutation(obj runtime.Object, raw []byte) error {
	u, ok := obj.(*unstructured.Unstructured)
	if !ok {
		return apierrors.NewInternalError(
			fmt.Errorf("admission hook for %s cannot mutate a %T", s.gvk.Kind, obj))
	}
	content := map[string]any{}
	if err := json.Unmarshal(raw, &content); err != nil {
		return apierrors.NewInternalError(
			fmt.Errorf("admission hook for %s returned an invalid object: %w", s.gvk.Kind, err))
	}
	next := &unstructured.Unstructured{Object: content}
	next.SetGroupVersionKind(s.gvk)
	next.SetName(u.GetName())
	next.SetGenerateName(u.GetGenerateName())
	next.SetNamespace(u.GetNamespace())
	next.SetUID(u.GetUID())
	next.SetResourceVersion(u.GetResourceVersion())
	// On an update the generic handler has already written managedFields, and it
	// runs before mutating admission -- so a hook that rebuilds the object rather
	// than editing it would wipe the ownership the request just recorded, and
	// nothing downstream puts it back.
	next.SetManagedFields(u.GetManagedFields())
	u.Object = next.Object
	return nil
}

// admissionDenied converts the plugin's status into an API error, mirroring how
// the apiserver reports a rejection from an admission webhook.
func (s *Store) admissionDenied(status *pluginv3.StatusResult) error {
	out := metav1.Status{
		Status:  metav1.StatusFailure,
		Message: fmt.Sprintf("admission hook for %s denied the request", s.gvk.Kind),
		Reason:  metav1.StatusReasonForbidden,
		Code:    http.StatusForbidden,
	}
	if status != nil {
		if v := status.GetStatus(); v != "" {
			out.Status = v
		}
		if v := status.GetMessage(); v != "" {
			out.Message = fmt.Sprintf("admission hook for %s denied the request: %s", s.gvk.Kind, v)
		}
		if v := status.GetReason(); v != "" {
			out.Reason = metav1.StatusReason(v)
		}
		if v := status.GetCode(); v != 0 {
			out.Code = v
		}
		out.Details = admissionDetails(status.GetDetails())
	}
	// A rejection must never report success or a redirect, whatever the plugin said.
	if out.Code < http.StatusBadRequest {
		out.Code = http.StatusBadRequest
	}
	return &apierrors.StatusError{ErrStatus: out}
}

func admissionDetails(details *pluginv3.StatusDetails) *metav1.StatusDetails {
	if details == nil {
		return nil
	}
	out := &metav1.StatusDetails{
		Name:              details.GetName(),
		Group:             details.GetGroup(),
		Kind:              details.GetKind(),
		UID:               types.UID(details.GetUid()),
		RetryAfterSeconds: details.GetRetryAfterSeconds(),
	}
	for _, cause := range details.GetCauses() {
		if cause == nil {
			continue
		}
		out.Causes = append(out.Causes, metav1.StatusCause{
			Type:    metav1.CauseType(cause.GetReason()),
			Message: cause.GetMessage(),
			Field:   cause.GetField(),
		})
	}
	return out
}

func admissionOperation(op admission.Operation) (pluginv3.AdmissionReviewRequest_Operation, bool) {
	switch op {
	case admission.Create:
		return pluginv3.AdmissionReviewRequest_OPERATION_CREATE, true
	case admission.Update:
		return pluginv3.AdmissionReviewRequest_OPERATION_UPDATE, true
	case admission.Delete:
		return pluginv3.AdmissionReviewRequest_OPERATION_DELETE, true
	case admission.Connect:
		// should not be called
	}
	return pluginv3.AdmissionReviewRequest_OPERATION_UNSPECIFIED, false
}
