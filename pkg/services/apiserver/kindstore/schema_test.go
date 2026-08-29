package kindstore

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
	defs := LoadOpenAPIDefinitions(func(name string) spec.Ref {
		return spec.MustCreateRef(name)
	}, manifest.Group, manifest)

	gvk := schema.GroupVersionKind{Group: manifest.Group, Version: version, Kind: "TestKind"}
	obj, ok := defs[OpenAPIName(gvk)]
	require.True(t, ok, "missing definition for %s", OpenAPIName(gvk))
	return newSchemaValidator(obj.Schema, defs)
}

// Guards the manifest-kind write path: kube-openapi's validator panics on any
// schema containing a $ref, so newSchemaValidator must produce a fully
// self-contained schema that validates realistic bodies (which always carry
// metadata by the time the Store strategy validates them).
func TestSchemaValidator(t *testing.T) {
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
func TestSchemaValidatorNestedRefs(t *testing.T) {
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

// A ref can appear anywhere in a schema, not just under properties. Any ref the
// expander leaves behind panics kube-openapi's validator at request time, so
// every composite position has to be walked.
func TestExpandSchemaRefsEverywhere(t *testing.T) {
	ref := func() spec.Schema {
		return spec.Schema{SchemaProps: spec.SchemaProps{Ref: spec.MustCreateRef("pkg.Leaf")}}
	}
	leaf := spec.Schema{SchemaProps: spec.SchemaProps{Type: []string{"string"}}}
	defs := map[string]common.OpenAPIDefinition{"pkg.Leaf": {Schema: leaf}}

	root := spec.Schema{SchemaProps: spec.SchemaProps{
		Type:                 []string{"object"},
		Properties:           map[string]spec.Schema{"prop": ref()},
		AdditionalProperties: &spec.SchemaOrBool{Schema: ptr(ref())},
		AdditionalItems:      &spec.SchemaOrBool{Schema: ptr(ref())},
		Items: &spec.SchemaOrArray{
			Schema:  ptr(ref()),
			Schemas: []spec.Schema{ref()},
		},
		AllOf: []spec.Schema{ref()},
		AnyOf: []spec.Schema{ref()},
		OneOf: []spec.Schema{ref()},
		Not:   ptr(ref()),
		// Definitions are never consulted by the validator, so they are dropped
		// rather than expanded.
		Definitions: spec.Definitions{"unused": ref()},
	}}

	out := expandSchemaRefs(root, defs, map[string]bool{})

	require.Nil(t, out.Definitions)
	for name, got := range map[string]spec.Schema{
		"properties":           out.Properties["prop"],
		"additionalProperties": *out.AdditionalProperties.Schema,
		"additionalItems":      *out.AdditionalItems.Schema,
		"items.schema":         *out.Items.Schema,
		"items.schemas":        out.Items.Schemas[0],
		"allOf":                out.AllOf[0],
		"anyOf":                out.AnyOf[0],
		"oneOf":                out.OneOf[0],
		"not":                  *out.Not,
	} {
		require.Empty(t, got.Ref.String(), "%s still holds a $ref", name)
		require.Equal(t, leaf.Type, got.Type, "%s was not replaced by the definition", name)
	}

	// Expanding must not write through to the manifest's own schema, which is
	// shared with the loaded manifest and reused for every version.
	rootProp := root.Properties["prop"]
	require.Equal(t, "pkg.Leaf", rootProp.Ref.String())
}

// The API server validates apiVersion, kind and metadata itself, and the
// manifest's own descriptions of them are usually incomplete, so they are
// dropped from the kind's schema -- without mutating the shared manifest schema.
func TestSchemaValidatorDropsCommonFields(t *testing.T) {
	kindSchema := spec.Schema{SchemaProps: spec.SchemaProps{
		Type: []string{"object"},
		Properties: map[string]spec.Schema{
			"apiVersion": *spec.StringProperty(),
			"kind":       *spec.StringProperty(),
			"metadata":   {SchemaProps: spec.SchemaProps{Ref: spec.MustCreateRef("io.k8s.ObjectMeta")}},
			"spec":       *spec.MapProperty(nil),
		},
		Required: []string{"apiVersion", "kind", "metadata", "spec"},
	}}

	validator := newSchemaValidator(kindSchema, nil)

	// metadata is a ref the expander cannot resolve; if it survived, the object
	// below would fail against a permissive empty schema's absent properties.
	require.NotPanics(t, func() {
		require.Empty(t, validation.ValidateCustomResource(nil, map[string]any{
			"spec": map[string]any{},
		}, validator), "only spec is still required")
	})

	require.Len(t, kindSchema.Properties, 4, "the manifest schema is left alone")
	require.Len(t, kindSchema.Required, 4)
}

func ptr[T any](v T) *T { return &v }
