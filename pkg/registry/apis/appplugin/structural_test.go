package appplugin

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana-app-sdk/app"
)

// structuralFor builds the structural schema for a kind declared inline, the way
// newKindStore does from a manifest.
func structuralFor(t *testing.T, schemas string) (*kindStore, error) {
	t.Helper()

	manifest := testManifest(t)
	manifest.Versions = []app.ManifestVersion{{
		Name:   "v1alpha1",
		Served: true,
		Kinds: []app.ManifestVersionKind{{
			Kind:   "TestKind",
			Plural: "TestKinds",
			Scope:  "Namespaced",
			Schema: testVersionSchema(t, schemas),
		}},
	}}
	defs := loadOpenAPIDefinitions(func(name string) spec.Ref {
		return spec.MustCreateRef(name)
	}, manifest.Group, manifest)

	gvk := schema.GroupVersionKind{Group: manifest.Group, Version: "v1alpha1", Kind: "TestKind"}
	def, ok := defs[kindOpenAPIName(gvk)]
	require.True(t, ok)

	structural, err := newKindStructuralSchema(def.Schema, defs)
	s := testKindStore(false, false)
	s.structural = structural
	return s, err
}

// A manifest kind is pruned and defaulted the way apiextensions prunes and
// defaults a custom resource, so the object this path stores is the object a CRD
// would have stored.
func TestKindPruneAndDefault(t *testing.T) {
	s, err := structuralFor(t, `{
		"TestKind":{"type":"object","properties":{"spec":{"$ref":"#/components/schemas/spec"}},"required":["spec"]},
		"spec":{"type":"object","properties":{
			"declared":{"type":"string"},
			"tier":{"type":"string","default":"standard"},
			"nested":{"type":"object","properties":{"kept":{"type":"string"}}}
		}}
	}`)
	require.NoError(t, err)
	require.NotNil(t, s.structural)

	obj := &unstructured.Unstructured{Object: map[string]any{
		"spec": map[string]any{
			"declared": "yes",
			"unknown":  "dropped",
			"nested":   map[string]any{"kept": "yes", "alsoUnknown": "dropped"},
		},
	}}
	obj.SetName("thing")
	obj.SetLabels(map[string]string{"a": "b"})

	s.PrepareForCreate(context.Background(), obj)

	require.Equal(t, map[string]any{
		"declared": "yes",
		"tier":     "standard",
		"nested":   map[string]any{"kept": "yes"},
	}, obj.Object["spec"])

	// The schema describes none of these, and pruning at a resource root leaves
	// them alone rather than deleting the object's identity.
	require.Equal(t, "thing", obj.GetName())
	require.Equal(t, map[string]string{"a": "b"}, obj.GetLabels())
	require.Equal(t, s.gvk, obj.GroupVersionKind())
}

// additionalProperties keeps what it allows, pruned or not -- the same rule
// apiextensions applies, quirk included.
func TestKindPruneKeepsAdditionalProperties(t *testing.T) {
	s, err := structuralFor(t, `{
		"TestKind":{"type":"object","properties":{"spec":{"$ref":"#/components/schemas/spec"}},"required":["spec"]},
		"spec":{"type":"object","additionalProperties":false,"properties":{"declared":{"type":"string"}}}
	}`)
	require.NoError(t, err)

	obj := &unstructured.Unstructured{Object: map[string]any{
		"spec": map[string]any{"declared": "yes", "unknown": "kept"},
	}}
	s.PrepareForCreate(context.Background(), obj)

	// Kept here, and then rejected by validation, which is what the same schema
	// does in a CRD.
	require.Equal(t, map[string]any{"declared": "yes", "unknown": "kept"}, obj.Object["spec"])
}

// A schema apiextensions would refuse costs the kind pruning and defaulting, not
// the kind itself.
func TestKindStructuralSchemaRejectsUnstructural(t *testing.T) {
	s, err := structuralFor(t, `{
		"TestKind":{"type":"object","properties":{"spec":{"$ref":"#/components/schemas/spec"}},"required":["spec"]},
		"spec":{"type":"object","properties":{"declared":{}}}
	}`)
	require.Error(t, err, "a property with no type is not structural")
	require.Nil(t, s.structural)

	// Still serves: prune and default are a no-op without one.
	obj := &unstructured.Unstructured{Object: map[string]any{
		"spec": map[string]any{"declared": "yes", "unknown": "kept"},
	}}
	s.PrepareForCreate(context.Background(), obj)
	require.Equal(t, map[string]any{"declared": "yes", "unknown": "kept"}, obj.Object["spec"])
}
