package admission

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authentication/user"
	"k8s.io/apiserver/pkg/warning"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana/pkg/policy/api"
	"github.com/grafana/grafana/pkg/policy/engine"
	policyschema "github.com/grafana/grafana/pkg/policy/schema"
)

var (
	thingGVK = schema.GroupVersionKind{Group: "things.example.grafana.app", Version: "v1", Kind: "Thing"}
	thingGVR = schema.GroupVersionResource{Group: "things.example.grafana.app", Version: "v1", Resource: "things"}
)

const thingSchema = `{"type": "object", "properties": {"spec": {"type": "object", "properties": {"title": {"type": "string"}}}}}`

type staticSets struct{ set *engine.Set }

func (s staticSets) SetFor(context.Context, string) (*engine.Set, error) { return s.set, nil }

type recorder struct{ warnings []string }

func (r *recorder) AddWarning(_, text string) { r.warnings = append(r.warnings, text) }

func newSet(t *testing.T, actions ...api.Action) *engine.Set {
	t.Helper()
	s := &spec.Schema{}
	require.NoError(t, json.Unmarshal([]byte(thingSchema), s))
	cp, err := engine.NewCompiler(policyschema.StaticResolver{thingGVK: s}).Compile(api.Policy{
		Name:  "titled",
		Match: []api.ResourceMatch{{Group: thingGVK.Group, Versions: []string{"v1"}, Kinds: []string{"Thing"}}},
		Validations: []api.Validation{
			{Expression: "object.spec.title != ''", Message: "title is required", FieldPath: "spec.title"},
			{Expression: "!request.userInfo.groups.exists(g, g == 'interns')", Message: "interns may not write things", Reason: api.ReasonForbidden},
		},
	})
	require.NoError(t, err)
	var bindings []api.Binding
	for _, a := range actions {
		bindings = append(bindings, api.Binding{Name: string(a), PolicyName: "titled", Actions: []api.Action{a}})
	}
	set, err := engine.NewSet([]*engine.CompiledPolicy{cp}, bindings, nil)
	require.NoError(t, err)
	return set
}

func attrs(title string, groups ...string) admission.Attributes {
	obj := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": thingGVK.GroupVersion().String(),
		"kind":       thingGVK.Kind,
		"metadata":   map[string]any{"name": "t1", "namespace": "default"},
		"spec":       map[string]any{"title": title},
	}}
	return admission.NewAttributesRecord(obj, nil, thingGVK, "default", "t1", thingGVR, "", admission.Create, nil, false,
		&user.DefaultInfo{Name: "someone", Groups: groups})
}

func validate(t *testing.T, set *engine.Set, a admission.Attributes) (error, []string) {
	t.Helper()
	rec := &recorder{}
	ctx := warning.WithWarningRecorder(context.Background(), rec)
	return NewPlugin(staticSets{set}).Validate(ctx, a, nil), rec.warnings
}

func TestPlugin(t *testing.T) {
	t.Run("deny rejects with the violated field", func(t *testing.T) {
		err, warnings := validate(t, newSet(t, api.ActionDeny), attrs(""))
		require.True(t, apierrors.IsInvalid(err), "got %v", err)
		require.Contains(t, err.Error(), `spec.title: Invalid value: null: ValidationPolicy "titled" with binding "Deny": title is required`)
		require.Empty(t, warnings)
	})

	t.Run("forbidden reasons are not reported as invalid", func(t *testing.T) {
		err, _ := validate(t, newSet(t, api.ActionDeny), attrs("", "interns"))
		require.True(t, apierrors.IsForbidden(err), "got %v", err)
		require.Contains(t, err.Error(), "interns may not write things")
		require.Contains(t, err.Error(), "title is required")
	})

	t.Run("warn admits and warns", func(t *testing.T) {
		err, warnings := validate(t, newSet(t, api.ActionWarn), attrs(""))
		require.NoError(t, err)
		require.Equal(t, []string{`ValidationPolicy "titled" with binding "Warn": title is required`}, warnings)
	})

	t.Run("compliant and unmatched requests pass", func(t *testing.T) {
		err, warnings := validate(t, newSet(t, api.ActionDeny), attrs("ok"))
		require.NoError(t, err)
		require.Empty(t, warnings)

		err, _ = validate(t, nil, attrs(""))
		require.NoError(t, err)
	})

	t.Run("subresources are skipped", func(t *testing.T) {
		obj := attrs("").GetObject()
		a := admission.NewAttributesRecord(obj, nil, thingGVK, "default", "t1", thingGVR, "status", admission.Update, nil, false, &user.DefaultInfo{})
		err, _ := validate(t, newSet(t, api.ActionDeny), a)
		require.NoError(t, err)
	})
}

type failingSets struct{}

func (failingSets) SetFor(context.Context, string) (*engine.Set, error) {
	return nil, errors.New("storage unavailable")
}

type observed struct {
	evaluations []engine.Evaluation
	sets        []*engine.Set
	failures    []error
}

func (o *observed) Evaluated(_ context.Context, _ admission.Attributes, set *engine.Set, ev engine.Evaluation, _ time.Duration) {
	o.sets = append(o.sets, set)
	o.evaluations = append(o.evaluations, ev)
}

func (o *observed) Failed(_ context.Context, _ admission.Attributes, err error) {
	o.failures = append(o.failures, err)
}

func TestObserver(t *testing.T) {
	ctx := warning.WithWarningRecorder(context.Background(), &recorder{})

	t.Run("sees every evaluation", func(t *testing.T) {
		o := &observed{}
		set := newSet(t, api.ActionDeny)
		p := NewPlugin(staticSets{set}, WithObserver(o))
		require.Error(t, p.Validate(ctx, attrs(""), nil))
		require.NoError(t, p.Validate(ctx, attrs("ok"), nil))
		require.Len(t, o.evaluations, 2)
		require.Len(t, o.evaluations[0].Decisions, 1)
		require.Empty(t, o.evaluations[1].Decisions)
		require.Same(t, set, o.sets[0])
		require.Empty(t, o.failures)
	})

	t.Run("is not called when nothing is evaluated", func(t *testing.T) {
		o := &observed{}
		require.NoError(t, NewPlugin(staticSets{nil}, WithObserver(o)).Validate(ctx, attrs(""), nil))
		require.Empty(t, o.evaluations)
		require.Empty(t, o.failures)
	})

	t.Run("sees failures", func(t *testing.T) {
		o := &observed{}
		err := NewPlugin(failingSets{}, WithObserver(o)).Validate(ctx, attrs(""), nil)
		require.True(t, apierrors.IsInternalError(err), "got %v", err)
		require.Len(t, o.failures, 1)
		require.ErrorContains(t, o.failures[0], "storage unavailable")
	})
}
