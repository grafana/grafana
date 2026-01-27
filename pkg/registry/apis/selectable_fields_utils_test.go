package apiregistry

import (
	"testing"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	sdkres "github.com/grafana/grafana-app-sdk/resource"
)

type testSchema struct {
	group      string
	version    string
	kind       string
	selectable []sdkres.SelectableField
}

func (s testSchema) Group() string            { return s.group }
func (s testSchema) Version() string          { return s.version }
func (s testSchema) Kind() string             { return s.kind }
func (s testSchema) Plural() string           { return "tests" }
func (s testSchema) ZeroValue() sdkres.Object { return nil }
func (s testSchema) ZeroListValue() sdkres.ListObject {
	return nil
}
func (s testSchema) Scope() sdkres.SchemaScope { return sdkres.NamespacedScope }
func (s testSchema) SelectableFields() []sdkres.SelectableField {
	return s.selectable
}

func TestAddSelectableFieldLabelConversions(t *testing.T) {
	scheme := runtime.NewScheme()
	gv := schema.GroupVersion{Group: "test.group", Version: "v1"}

	kind := sdkres.Kind{
		Schema: testSchema{
			group:   gv.Group,
			version: gv.Version,
			kind:    "TestKind",
			selectable: []sdkres.SelectableField{
				{FieldSelector: "spec.foo"},
			},
		},
	}

	if err := AddSelectableFieldLabelConversions(scheme, gv, kind); err != nil {
		t.Fatalf("AddSelectableFieldLabelConversions error: %v", err)
	}

	gvk := gv.WithKind("TestKind")
	if _, _, err := scheme.ConvertFieldLabel(gvk, "metadata.name", "name"); err != nil {
		t.Fatalf("metadata.name should be allowed: %v", err)
	}
	if _, _, err := scheme.ConvertFieldLabel(gvk, "spec.foo", "bar"); err != nil {
		t.Fatalf("spec.foo should be allowed since it is a selectable field: %v", err)
	}
	if _, _, err := scheme.ConvertFieldLabel(gvk, "spec.nope", "x"); err == nil {
		t.Fatal("spec.nope should be rejected since it is not a selectable field")
	}
}

func TestBuildGetAttrsFn(t *testing.T) {
	kind := sdkres.Kind{
		Schema: testSchema{
			group:   "test.group",
			version: "v1",
			kind:    "TestKind",
			selectable: []sdkres.SelectableField{
				{
					FieldSelector: "spec.foo",
					FieldValueFunc: func(_ sdkres.Object) (string, error) {
						return "bar", nil
					},
				},
			},
		},
	}

	obj := &sdkres.TypedSpecObject[any]{
		ObjectMeta: metav1.ObjectMeta{
			Labels: map[string]string{"label": "value"},
		},
	}

	getAttrs := BuildGetAttrsFn(kind)
	labels, fields, err := getAttrs(obj)
	if err != nil {
		t.Fatalf("BuildGetAttrsFn error: %v", err)
	}
	if labels["label"] != "value" {
		t.Fatalf("expected label to be preserved, got %v", labels)
	}
	if fields["spec.foo"] != "bar" {
		t.Fatalf("expected spec.foo field to be set, got %v", fields)
	}
}
