package validation

import (
	"context"
	"errors"
	"testing"

	sdkapp "github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	v1 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	manifestdata "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/manifestdata"
)

func newAlertRule(name string) *v1.AlertRule {
	r := &v1.AlertRule{}
	r.SetGroupVersionKind(v1.AlertRuleKind().GroupVersionKind())
	r.Name = name
	return r
}

func TestBuilder_ActionScopingAndOrder(t *testing.T) {
	var ran []string
	record := func(label string) ValidateFunc[*v1.AlertRule] {
		return func(_ context.Context, _ Request[*v1.AlertRule]) error {
			ran = append(ran, label)
			return nil
		}
	}

	v := NewBuilder[*v1.AlertRule]().
		OnWrite(record("write-1")).
		OnWrite(record("write-2")).
		OnDelete(record("delete")).
		Build()

	obj := newAlertRule("r1")

	ran = nil
	require.NoError(t, v.Validate(context.Background(), &sdkapp.AdmissionRequest{Action: resource.AdmissionActionCreate, Object: obj}))
	require.Equal(t, []string{"write-1", "write-2"}, ran)

	ran = nil
	require.NoError(t, v.Validate(context.Background(), &sdkapp.AdmissionRequest{Action: resource.AdmissionActionDelete, OldObject: obj}))
	require.Equal(t, []string{"delete"}, ran)
}

func TestBuilder_ShortCircuitsOnFirstError(t *testing.T) {
	var ran []string
	boom := errors.New("boom")
	v := NewBuilder[*v1.AlertRule]().
		OnWrite(func(_ context.Context, _ Request[*v1.AlertRule]) error { ran = append(ran, "a"); return boom }).
		OnWrite(func(_ context.Context, _ Request[*v1.AlertRule]) error { ran = append(ran, "b"); return nil }).
		Build()

	err := v.Validate(context.Background(), &sdkapp.AdmissionRequest{Action: resource.AdmissionActionCreate, Object: newAlertRule("r1")})
	require.ErrorIs(t, err, boom)
	require.Equal(t, []string{"a"}, ran)
}

func TestBuilder_TypedObjects(t *testing.T) {
	old := newAlertRule("old")
	cur := newAlertRule("cur")

	var seen Request[*v1.AlertRule]
	v := NewBuilder[*v1.AlertRule]().
		OnWrite(func(_ context.Context, req Request[*v1.AlertRule]) error { seen = req; return nil }).
		OnDelete(func(_ context.Context, req Request[*v1.AlertRule]) error { seen = req; return nil }).
		Build()

	// UPDATE populates both Object and OldObject.
	require.NoError(t, v.Validate(context.Background(), &sdkapp.AdmissionRequest{Action: resource.AdmissionActionUpdate, Object: cur, OldObject: old}))
	require.Same(t, cur, seen.Object)
	require.Same(t, old, seen.OldObject)

	// CREATE leaves OldObject nil.
	seen = Request[*v1.AlertRule]{}
	require.NoError(t, v.Validate(context.Background(), &sdkapp.AdmissionRequest{Action: resource.AdmissionActionCreate, Object: cur}))
	require.Same(t, cur, seen.Object)
	require.Nil(t, seen.OldObject)

	// DELETE populates OldObject from req.OldObject; Object stays nil.
	seen = Request[*v1.AlertRule]{}
	require.NoError(t, v.Validate(context.Background(), &sdkapp.AdmissionRequest{Action: resource.AdmissionActionDelete, OldObject: old}))
	require.Same(t, old, seen.OldObject)
	require.Nil(t, seen.Object)
}

func TestBuilder_WrongObjectType(t *testing.T) {
	v := NewBuilder[*v1.AlertRule]().
		OnWrite(func(_ context.Context, _ Request[*v1.AlertRule]) error { return nil }).
		Build()
	err := v.Validate(context.Background(), &sdkapp.AdmissionRequest{Action: resource.AdmissionActionCreate, Object: &v1.RecordingRule{}})
	require.Error(t, err)
}

func TestBuilder_NoApplicableSkipsCast(t *testing.T) {
	// Only a delete step is registered. A CREATE has no applicable steps, so the
	// builder returns nil without attempting to cast req.Object.
	v := NewBuilder[*v1.AlertRule]().
		OnDelete(func(_ context.Context, _ Request[*v1.AlertRule]) error { return errors.New("should not run") }).
		Build()
	require.NoError(t, v.Validate(context.Background(), &sdkapp.AdmissionRequest{Action: resource.AdmissionActionCreate, Object: &v1.RecordingRule{}}))
}

func TestOpenAPISpec(t *testing.T) {
	md := *manifestdata.LocalManifest().ManifestData
	gk := schema.GroupKind{Group: md.Group, Kind: "AlertRule"}

	step, err := OpenAPISpec[*v1.AlertRule](md, gk)
	require.NoError(t, err)

	good := newAlertRule("r1")
	good.Spec = validAlertRuleSpec()
	require.NoError(t, step(context.Background(), Request[*v1.AlertRule]{Action: resource.AdmissionActionCreate, Object: good}))

	bad := newAlertRule("r1")
	bad.Spec = validAlertRuleSpec()
	bad.Spec.NoDataState = v1.AlertRuleNoDataState("Bogus")
	err = step(context.Background(), Request[*v1.AlertRule]{Action: resource.AdmissionActionCreate, Object: bad})
	require.True(t, apierrors.IsInvalid(err), "expected Invalid error, got %v", err)
}

func TestOpenAPISpec_NilSchemaNoop(t *testing.T) {
	// A kind not present in the manifest yields a no-op step (no schema declared).
	step, err := OpenAPISpec[*v1.AlertRule](*manifestdata.LocalManifest().ManifestData, schema.GroupKind{Group: "x", Kind: "DoesNotExist"})
	require.NoError(t, err)
	require.NoError(t, step(context.Background(), Request[*v1.AlertRule]{Action: resource.AdmissionActionCreate, Object: newAlertRule("r1")}))
}
