package admission

import (
	"context"
	"encoding/json"
	"testing"

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
