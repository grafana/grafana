package apiregistry

import (
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	sdkres "github.com/grafana/grafana-app-sdk/resource"
)

type selectableFieldsTestSchema struct {
	group      string
	version    string
	kind       string
	selectable []sdkres.SelectableField
}

func (s selectableFieldsTestSchema) Group() string            { return s.group }
func (s selectableFieldsTestSchema) Version() string          { return s.version }
func (s selectableFieldsTestSchema) Kind() string             { return s.kind }
func (s selectableFieldsTestSchema) Plural() string           { return "tests" }
func (s selectableFieldsTestSchema) ZeroValue() sdkres.Object { return nil }
func (s selectableFieldsTestSchema) ZeroListValue() sdkres.ListObject {
	return nil
}
func (s selectableFieldsTestSchema) Scope() sdkres.SchemaScope { return sdkres.NamespacedScope }
func (s selectableFieldsTestSchema) SelectableFields() []sdkres.SelectableField {
	return s.selectable
}

func TestSelectableFieldsAddSelectableFieldLabelConversions(t *testing.T) {
	scheme := runtime.NewScheme()
	gv := schema.GroupVersion{Group: "test.group", Version: "v1"}

	kind := sdkres.Kind{
		Schema: selectableFieldsTestSchema{
			group:   gv.Group,
			version: gv.Version,
			kind:    "TestKind",
			selectable: []sdkres.SelectableField{
				{FieldSelector: "spec.foo"},
			},
		},
	}

	gvk := gv.WithKind("TestKind")

	// should error before adding conversions
	_, _, err := scheme.ConvertFieldLabel(gvk, "spec.foo", "bar")
	require.Error(t, err)

	require.NoError(t, AddSelectableFieldLabelConversions(scheme, gv, kind))

	_, _, err = scheme.ConvertFieldLabel(gvk, "metadata.name", "name")
	require.NoError(t, err)

	_, _, err = scheme.ConvertFieldLabel(gvk, "spec.foo", "bar")
	require.NoError(t, err)

	_, _, err = scheme.ConvertFieldLabel(gvk, "spec.nope", "x")
	require.Error(t, err)
}

func TestSelectableFieldsBuildGetAttrsFn(t *testing.T) {
	kind := sdkres.Kind{
		Schema: selectableFieldsTestSchema{
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
	lbls, flds, err := getAttrs(obj)

	require.NoError(t, err)
	require.Equal(t, labels.Set{"label": "value"}, lbls)
	require.Equal(t, fields.Set{"spec.foo": "bar"}, flds)
}
