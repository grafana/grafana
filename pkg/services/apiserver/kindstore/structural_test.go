package kindstore

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana-app-sdk/app"
)

// structuralFor builds the structural schema for a kind declared inline, the way
// New does from a manifest.
func structuralFor(t *testing.T, schemas string) (*Store, error) {
	t.Helper()

	manifest := testManifest(t)
	manifest.Versions = []app.ManifestVersion{{
		Name:   "v1alpha1",
		Served: true,
		Kinds: []app.ManifestVersionKind{{
			Kind:   "TestKind",
			Plural: "TestKinds", Resource: "testkinds",
			Scope:  "Namespaced",
			Schema: testVersionSchema(t, schemas),
		}},
	}}
	defs := LoadOpenAPIDefinitions(func(name string) spec.Ref {
		return spec.MustCreateRef(name)
	}, manifest.Group, manifest)

	gvk := schema.GroupVersionKind{Group: manifest.Group, Version: "v1alpha1", Kind: "TestKind"}
	def, ok := defs[OpenAPIName(gvk)]
	require.True(t, ok)

	structural, err := newStructuralSchema(def.Schema, defs)
	s := testStore(false, false)
	s.structural = structural
	return s, err
}

// A manifest kind is pruned and defaulted the way apiextensions prunes and
// defaults a custom resource, so the object this path stores is the object a CRD
// would have stored.
func TestPruneAndDefault(t *testing.T) {
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
func TestPruneKeepsAdditionalProperties(t *testing.T) {
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
func TestStructuralSchemaRejectsUnstructural(t *testing.T) {
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

// The shape app-sdk codegen gives a manifest's secure values: a map whose value
// is a ref wrapped in allOf so it can carry a description.
const secureValuesSchema = `{
	"TestKind":{"type":"object","properties":{
		"spec":{"$ref":"#/components/schemas/spec"},
		"secure":{"type":"object","additionalProperties":{
			"description":"Provider API key, keyed by the provider name",
			"allOf":[{"$ref":"#/components/schemas/com.github.grafana.grafana-app-sdk.resource.InlineSecureValue"}]
		}}
	},"required":["spec"]},
	"com.github.grafana.grafana-app-sdk.resource.InlineSecureValue":{
		"type":"object",
		"oneOf":[{"required":["create"]},{"required":["name"]},{"required":["remove"]}],
		"not":{"required":["description"],"not":{"required":["create"]}},
		"properties":{
			"create":{"description":"Plaintext value.","type":"string","minLength":1},
			"description":{"description":"Description of a new secret.","type":"string"},
			"name":{"description":"Reference to an existing value.","type":"string","minLength":1},
			"remove":{"description":"Remove this entry.","type":"boolean"}
		}
	},
	"spec":{"type":"object","properties":{"declared":{"type":"string"}}}
}`

// A ref wrapped in allOf, the way codegen attaches a description to a secure
// value, is still a structural schema once its type is lifted out of the
// junction, so secure values are pruned like the rest of the kind.
func TestStructuralSchemaLiftsAllOfRef(t *testing.T) {
	s, err := structuralFor(t, secureValuesSchema)
	require.NoError(t, err)
	require.NotNil(t, s.structural)

	obj := &unstructured.Unstructured{Object: map[string]any{
		"spec": map[string]any{"declared": "yes"},
		"secure": map[string]any{
			"openai": map[string]any{"name": "existing", "unknown": "dropped"},
		},
	}}
	s.PrepareForCreate(context.Background(), obj)
	require.Equal(t, map[string]any{"openai": map[string]any{"name": "existing"}}, obj.Object["secure"])
}

// A default beside a ref is applied once the referenced type is lifted out.
func TestStructuralSchemaDefaultsBesideRef(t *testing.T) {
	s, err := structuralFor(t, `{
		"TestKind":{"type":"object","properties":{"spec":{"$ref":"#/components/schemas/spec"}},"required":["spec"]},
		"Tier":{"type":"string","enum":["standard","premium"]},
		"spec":{"type":"object","properties":{
			"tier":{"allOf":[{"$ref":"#/components/schemas/Tier"}],"default":"standard"}
		}}
	}`)
	require.NoError(t, err)

	obj := &unstructured.Unstructured{Object: map[string]any{"spec": map[string]any{}}}
	s.PrepareForCreate(context.Background(), obj)
	require.Equal(t, map[string]any{"tier": "standard"}, obj.Object["spec"])
}

// Lifting happens on the structural schema alone; the definitions the validator
// is built from keep their allOf.
func TestStructuralSchemaLeavesDefinitions(t *testing.T) {
	manifest := testManifest(t)
	manifest.Versions = []app.ManifestVersion{{
		Name: "v1alpha1", Served: true,
		Kinds: []app.ManifestVersionKind{{
			Kind: "TestKind", Plural: "TestKinds", Resource: "testkinds", Scope: "Namespaced",
			Schema: testVersionSchema(t, secureValuesSchema),
		}},
	}}
	defs := LoadOpenAPIDefinitions(func(name string) spec.Ref { return spec.MustCreateRef(name) }, manifest.Group, manifest)
	def := defs[OpenAPIName(schema.GroupVersionKind{Group: manifest.Group, Version: "v1alpha1", Kind: "TestKind"})]
	before, err := json.Marshal(defs)
	require.NoError(t, err)

	_, err = newStructuralSchema(def.Schema, defs)
	require.NoError(t, err)

	after, err := json.Marshal(defs)
	require.NoError(t, err)
	require.JSONEq(t, string(before), string(after))
}
