package appplugin

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
)

// The definition map, the validator lookup in UpdateAPIGroupInfo, and the
// component injection + refs in postProcessManifestKinds all key kinds by
// kindOpenAPIName. This test guards that shared name against drift.
func TestManifestKindOpenAPINames(t *testing.T) {
	manifest := testManifest(t)
	b := &AppPluginAPIBuilder{
		manifest: manifest,
	}
	defs := b.GetOpenAPIDefinitions()(func(path string) spec.Ref {
		return spec.MustCreateRef("#/definitions/" + path)
	})

	gvk := schema.GroupVersionKind{Group: manifest.Group, Version: "v1alpha1", Kind: "TestKind"}
	name := kindOpenAPIName(gvk)
	require.Equal(t, "example.ext.grafana.com.v1alpha1.TestKind", name)

	def, ok := defs[name]
	require.True(t, ok, "definition map must contain the kind's OpenAPI name, got keys: %v", keys(defs))
	require.Contains(t, def.Schema.Properties, "spec")
	require.Contains(t, def.Schema.Properties, "status")

	_, ok = defs[name+"List"]
	require.True(t, ok, "expected a list definition for the kind")
}

func TestPostProcessManifestKindRequestBodies(t *testing.T) {
	manifest := testManifest(t)
	group := manifest.Group
	version := "v1alpha1"

	b := &AppPluginAPIBuilder{
		manifest: manifest,
	}

	root := "/apis/" + group + "/" + version + "/"
	base := root + "namespaces/{namespace}/testkinds"
	body := func() *spec3.RequestBody {
		return &spec3.RequestBody{
			RequestBodyProps: spec3.RequestBodyProps{
				Content: map[string]*spec3.MediaType{
					"application/json": {MediaTypeProps: spec3.MediaTypeProps{Schema: spec.MapProperty(nil)}},
					"application/yaml": {MediaTypeProps: spec3.MediaTypeProps{Schema: spec.MapProperty(nil)}},
				},
			},
		}
	}
	listResponse := &spec3.Responses{
		ResponsesProps: spec3.ResponsesProps{
			StatusCodeResponses: map[int]*spec3.Response{
				200: {ResponseProps: spec3.ResponseProps{
					Content: map[string]*spec3.MediaType{
						"application/json": {MediaTypeProps: spec3.MediaTypeProps{Schema: spec.MapProperty(nil)}},
					},
				}},
			},
		},
	}
	singleResponse := func() *spec3.Responses {
		return &spec3.Responses{
			ResponsesProps: spec3.ResponsesProps{
				StatusCodeResponses: map[int]*spec3.Response{
					200: {ResponseProps: spec3.ResponseProps{
						Content: map[string]*spec3.MediaType{
							"application/json": {MediaTypeProps: spec3.MediaTypeProps{Schema: spec.MapProperty(nil)}},
						},
					}},
				},
			},
		}
	}
	oas := &spec3.OpenAPI{
		Paths: &spec3.Paths{
			Paths: map[string]*spec3.Path{
				base: {PathProps: spec3.PathProps{
					Get:  &spec3.Operation{OperationProps: spec3.OperationProps{Responses: listResponse}},
					Post: &spec3.Operation{OperationProps: spec3.OperationProps{RequestBody: body()}},
				}},
				base + "/{name}": {PathProps: spec3.PathProps{
					Get:   &spec3.Operation{OperationProps: spec3.OperationProps{Responses: singleResponse()}},
					Put:   &spec3.Operation{OperationProps: spec3.OperationProps{RequestBody: body(), Responses: singleResponse()}},
					Patch: &spec3.Operation{OperationProps: spec3.OperationProps{RequestBody: body(), Responses: singleResponse()}},
				}},
			},
		},
		Components: &spec3.Components{Schemas: map[string]*spec.Schema{}},
	}

	b.postProcessManifestKinds(oas, root, version)

	kindName := "example.ext.grafana.com.v1alpha1.TestKind"
	expected := "#/components/schemas/" + kindName
	for _, mt := range oas.Paths.Paths[base].Post.RequestBody.Content {
		require.Equal(t, expected, mt.Schema.Ref.String())
	}
	item := oas.Paths.Paths[base+"/{name}"]
	for _, mt := range item.Put.RequestBody.Content {
		require.Equal(t, expected, mt.Schema.Ref.String())
	}
	for _, op := range []*spec3.Operation{item.Get, item.Put, item.Patch} {
		for _, mt := range op.Responses.StatusCodeResponses[200].Content {
			require.Equal(t, expected, mt.Schema.Ref.String())
		}
	}
	// PATCH request bodies are patch documents and must be left alone
	for _, mt := range item.Patch.RequestBody.Content {
		require.Empty(t, mt.Schema.Ref.String())
	}

	// No route sample references the manifest definitions, so post-processing
	// must inject the components its refs point at -- otherwise every ref
	// above dangles and clients see empty models.
	kindSchema, ok := oas.Components.Schemas[kindName]
	require.True(t, ok, "expected the kind component to be injected, got: %v", keys(oas.Components.Schemas))
	require.Contains(t, kindSchema.Properties, "spec")
	_, ok = oas.Components.Schemas[kindName+"Spec"]
	require.True(t, ok, "expected the kind's nested definitions to be injected")

	// The list component must be injected and the list response repointed at it
	listSchema, ok := oas.Components.Schemas[kindName+"List"]
	require.True(t, ok, "expected the TestKindList component to be injected")
	require.Equal(t, expected, listSchema.Properties["items"].Items.Schema.Ref.String())
	for _, mt := range oas.Paths.Paths[base].Get.Responses.StatusCodeResponses[200].Content {
		require.Equal(t, expected+"List", mt.Schema.Ref.String())
	}

	// Each version's spec is self-contained: other versions must not leak in
	for name := range oas.Components.Schemas {
		require.NotContains(t, name, ".v0alpha1.", "other versions must not be injected into this version's spec")
	}
}

func TestSpecVersion(t *testing.T) {
	b := &AppPluginAPIBuilder{pluginJSON: plugins.JSONData{ID: "example-app"}}

	// The builder framework stamps Info.Title with "<group>/<version>"
	oas := &spec3.OpenAPI{Info: &spec.Info{InfoProps: spec.InfoProps{Title: "example-app/v1alpha1"}}}
	require.Equal(t, "v1alpha1", b.specVersion(oas))

	// Falls back to the settings version when the title is missing or foreign
	require.Equal(t, apppluginV0.VERSION, b.specVersion(&spec3.OpenAPI{}))
	other := &spec3.OpenAPI{Info: &spec.Info{InfoProps: spec.InfoProps{Title: "other-group/v1"}}}
	require.Equal(t, apppluginV0.VERSION, b.specVersion(other))
}

func keys[T any](m map[string]T) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}
