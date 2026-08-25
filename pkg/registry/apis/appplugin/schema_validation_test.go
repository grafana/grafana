package appplugin

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apiextensions-apiserver/pkg/apiserver/validation"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/validation/spec"
)

func buildTestKindValidator(t *testing.T, version string) validation.SchemaValidator {
	t.Helper()
	manifest := testManifest(t)

	// Same construction as UpdateAPIGroupInfo: bare-name refs so the expander
	// can resolve them directly against the definition map.
	defs := loadOpenAPIDefinition(func(name string) spec.Ref {
		return spec.MustCreateRef(name)
	}, manifest)

	gvk := schema.GroupVersionKind{Group: manifest.Group, Version: version, Kind: "TestKind"}
	obj, ok := defs[kindOpenAPIName(gvk)]
	require.True(t, ok, "missing definition for %s", kindOpenAPIName(gvk))
	return newKindSchemaValidator(obj.Schema, defs)
}

// Guards the manifest-kind write path: kube-openapi's validator panics on any
// schema containing a $ref, so newKindSchemaValidator must produce a fully
// self-contained schema that validates realistic bodies (which always carry
// metadata by the time the kindStore strategy validates them).
func TestKindSchemaValidator(t *testing.T) {
	manifest := testManifest(t)
	validator := buildTestKindValidator(t, "v0alpha1")

	valid := map[string]interface{}{
		"apiVersion": manifest.Group + "/v0alpha1",
		"kind":       "TestKind",
		"metadata":   map[string]interface{}{"name": "x", "namespace": "default"},
		"spec":       map[string]interface{}{"testField": int64(42)},
	}
	require.NotPanics(t, func() {
		require.Empty(t, validation.ValidateCustomResource(nil, valid, validator))
	})

	badType := map[string]interface{}{
		"metadata": map[string]interface{}{"name": "x"},
		"spec":     map[string]interface{}{"testField": "not-an-integer"},
	}
	require.NotEmpty(t, validation.ValidateCustomResource(nil, badType, validator))

	missingSpec := map[string]interface{}{
		"metadata": map[string]interface{}{"name": "x"},
	}
	require.NotEmpty(t, validation.ValidateCustomResource(nil, missingSpec, validator))
}

// The v1alpha1 TestKind nests refs several levels deep (spec -> Foo -> Bar ->
// Baz), exercising recursive expansion.
func TestKindSchemaValidatorNestedRefs(t *testing.T) {
	validator := buildTestKindValidator(t, "v1alpha1")

	valid := map[string]interface{}{
		"metadata": map[string]interface{}{"name": "x"},
		"spec": map[string]interface{}{
			"testField": "value",
			"foo": map[string]interface{}{
				"foo": "a",
				"bar": map[string]interface{}{
					"value": "b",
					"baz":   map[string]interface{}{"value": int64(10)},
				},
			},
		},
	}
	require.NotPanics(t, func() {
		require.Empty(t, validation.ValidateCustomResource(nil, valid, validator))
	})

	// wrong type three refs deep
	deepBad := map[string]interface{}{
		"metadata": map[string]interface{}{"name": "x"},
		"spec": map[string]interface{}{
			"testField": "value",
			"foo": map[string]interface{}{
				"foo": "a",
				"bar": map[string]interface{}{
					"value": "b",
					"baz":   map[string]interface{}{"value": "not-an-integer"},
				},
			},
		},
	}
	require.NotEmpty(t, validation.ValidateCustomResource(nil, deepBad, validator))
}

// Cyclic references must expand to a permissive schema instead of recursing
// forever or panicking.
func TestExpandSchemaRefsCycle(t *testing.T) {
	defs := map[string]common.OpenAPIDefinition{
		"loop.Node": {Schema: spec.Schema{SchemaProps: spec.SchemaProps{
			Type: []string{"object"},
			Properties: map[string]spec.Schema{
				"next": {SchemaProps: spec.SchemaProps{Ref: spec.MustCreateRef("loop.Node")}},
			},
		}}},
	}
	root := spec.Schema{SchemaProps: spec.SchemaProps{
		Type: []string{"object"},
		Properties: map[string]spec.Schema{
			"node": {SchemaProps: spec.SchemaProps{Ref: spec.MustCreateRef("loop.Node")}},
		},
	}}

	var expanded spec.Schema
	require.NotPanics(t, func() {
		expanded = expandSchemaRefs(root, defs, map[string]bool{})
	})
	node := expanded.Properties["node"]
	next := node.Properties["next"]
	require.Empty(t, node.Ref.String())
	// the cycle point collapses to a permissive empty schema
	require.Empty(t, next.Ref.String())
	require.Empty(t, next.Type)
}
