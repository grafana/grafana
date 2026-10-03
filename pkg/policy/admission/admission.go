// Package admission evaluates policies on admission requests of a Kubernetes-style API server.
//
// It only translates between admission and the engine: where policies come from is decided by
// the SetProvider, so the same plugin can run inside Grafana's API server or behind a webhook.
package admission

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/warning"

	"github.com/grafana/grafana/pkg/policy/api"
	"github.com/grafana/grafana/pkg/policy/engine"
)

// SetProvider returns the policies that apply in a namespace. A nil set means no policies.
type SetProvider interface {
	SetFor(ctx context.Context, namespace string) (*engine.Set, error)
}

// Plugin is a validating admission plugin that evaluates the policies of the request's namespace.
type Plugin struct {
	*admission.Handler
	sets SetProvider
}

var _ admission.ValidationInterface = (*Plugin)(nil)

func NewPlugin(sets SetProvider) *Plugin {
	return &Plugin{
		Handler: admission.NewHandler(admission.Create, admission.Update, admission.Delete),
		sets:    sets,
	}
}

func (p *Plugin) Validate(ctx context.Context, a admission.Attributes, _ admission.ObjectInterfaces) error {
	// Subresources such as status carry partial objects that policies are not written against.
	if a.GetSubresource() != "" {
		return nil
	}
	set, err := p.sets.SetFor(ctx, a.GetNamespace())
	if err != nil {
		return apierrors.NewInternalError(fmt.Errorf("loading validation policies: %w", err))
	}
	if set == nil || !set.Matches(a.GetKind()) {
		return nil
	}
	in, err := InputFromAttributes(a)
	if err != nil {
		return apierrors.NewInternalError(err)
	}
	return Respond(ctx, a, set.EvaluateAll(ctx, in).Decisions)
}

// InputFromAttributes converts an admission request into an engine input.
func InputFromAttributes(a admission.Attributes) (engine.Input, error) {
	in := engine.Input{
		GVK:       a.GetKind(),
		Namespace: a.GetNamespace(),
		Request: &engine.RequestInfo{
			Operation: api.Operation(a.GetOperation()),
			Name:      a.GetName(),
			Namespace: a.GetNamespace(),
		},
	}
	if u := a.GetUserInfo(); u != nil {
		in.Request.UserInfo = engine.UserInfo{Username: u.GetName(), UID: u.GetUID(), Groups: u.GetGroups()}
	}
	var err error
	if in.Object, err = toUnstructured(a.GetObject()); err != nil {
		return in, fmt.Errorf("converting object: %w", err)
	}
	if in.OldObject, err = toUnstructured(a.GetOldObject()); err != nil {
		return in, fmt.Errorf("converting old object: %w", err)
	}
	return in, nil
}

// toUnstructured round-trips through JSON rather than using the reflection-based converter,
// because generated app types may customize their JSON encoding.
func toUnstructured(obj runtime.Object) (map[string]any, error) {
	if obj == nil {
		return nil, nil
	}
	if u, ok := obj.(runtime.Unstructured); ok {
		return u.UnstructuredContent(), nil
	}
	raw, err := json.Marshal(obj)
	if err != nil {
		return nil, err
	}
	out := map[string]any{}
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// Respond adds a warning for every Warn decision and returns an error rejecting the request when
// any decision is Deny.
func Respond(ctx context.Context, a admission.Attributes, decisions []engine.Decision) error {
	var denied []engine.Decision
	for _, d := range decisions {
		switch d.Action {
		case api.ActionWarn:
			warning.AddWarning(ctx, "", describe(d))
		case api.ActionDeny:
			denied = append(denied, d)
		}
	}
	if len(denied) == 0 {
		return nil
	}

	gk := a.GetKind().GroupKind()
	name := a.GetName()
	switch reasonOf(denied) {
	case api.ReasonUnauthorized:
		return apierrors.NewUnauthorized(joined(denied))
	case api.ReasonForbidden:
		return apierrors.NewForbidden(a.GetResource().GroupResource(), name, errors.New(joined(denied)))
	default:
		errs := make(field.ErrorList, 0, len(denied))
		for _, d := range denied {
			errs = append(errs, field.Invalid(fieldPath(d.FieldPath), nil, describe(d)))
		}
		return apierrors.NewInvalid(gk, name, errs)
	}
}

// reasonOf picks the most severe reason, so that an authorization failure is never reported as
// a mere invalid value.
func reasonOf(decisions []engine.Decision) api.Reason {
	reason := api.ReasonInvalid
	for _, d := range decisions {
		switch d.Reason {
		case api.ReasonUnauthorized:
			return api.ReasonUnauthorized
		case api.ReasonForbidden:
			reason = api.ReasonForbidden
		}
	}
	return reason
}

func describe(d engine.Decision) string {
	return fmt.Sprintf("ValidationPolicy %q with binding %q: %s", d.Policy, d.Binding, d.Message)
}

func joined(decisions []engine.Decision) string {
	msgs := make([]string, 0, len(decisions))
	for _, d := range decisions {
		msgs = append(msgs, describe(d))
	}
	return strings.Join(msgs, "; ")
}

func fieldPath(p string) *field.Path {
	if p == "" {
		return field.NewPath("")
	}
	parts := strings.Split(p, ".")
	return field.NewPath(parts[0], parts[1:]...)
}
