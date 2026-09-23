package appplugin

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	openapiutil "k8s.io/kube-openapi/pkg/util"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/apiserver/kindstore"
)

// The definition map, the validator lookup in UpdateAPIGroupInfo, and the
// component injection + refs in postProcessManifestKinds all key kinds by
// kindstore.OpenAPIName. This test guards that shared name against drift.
func TestManifestKindOpenAPINames(t *testing.T) {
	manifest := testManifest(t)
	b := &AppPluginAPIBuilder{
		group:    manifest.Group,
		manifest: manifest,
	}
	defs := b.GetOpenAPIDefinitions()(func(path string) spec.Ref {
		return spec.MustCreateRef("#/definitions/" + path)
	})

	gvk := schema.GroupVersionKind{Group: manifest.Group, Version: "v1alpha1", Kind: "TestKind"}
	name := kindstore.OpenAPIName(gvk)
	require.Equal(t, "example.ext.grafana.app.v1alpha1.TestKind", name)

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
		group:    manifest.Group,
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

	kindName := "example.ext.grafana.app.v1alpha1.TestKind"
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

func TestSetOperationResponseBodiesPreservesErrors(t *testing.T) {
	kindRef := spec.MustCreateRef("#/components/schemas/example.Kind")
	statusRef := spec.MustCreateRef("#/components/schemas/io.k8s.apimachinery.pkg.apis.meta.v1.Status")
	response := func(ref spec.Ref) *spec3.Response {
		return &spec3.Response{ResponseProps: spec3.ResponseProps{Content: map[string]*spec3.MediaType{
			"application/json": {MediaTypeProps: spec3.MediaTypeProps{
				Schema: &spec.Schema{SchemaProps: spec.SchemaProps{Ref: ref}},
			}},
		}}}
	}
	op := &spec3.Operation{OperationProps: spec3.OperationProps{Responses: &spec3.Responses{
		ResponsesProps: spec3.ResponsesProps{StatusCodeResponses: map[int]*spec3.Response{
			http.StatusOK:         response(statusRef),
			http.StatusBadRequest: response(statusRef),
		}},
	}}}

	setOperationResponseBodies(op, kindRef)

	require.Equal(t, kindRef.String(), op.Responses.StatusCodeResponses[http.StatusOK].Content["application/json"].Schema.Ref.String())
	require.Equal(t, statusRef.String(), op.Responses.StatusCodeResponses[http.StatusBadRequest].Content["application/json"].Schema.Ref.String())
}

func TestPostProcessManifestKindPostExample(t *testing.T) {
	manifest := testManifest(t)
	version := "v1alpha1"
	b := &AppPluginAPIBuilder{group: manifest.Group, manifest: manifest}

	root := "/apis/" + manifest.Group + "/" + version + "/"
	base := root + "namespaces/{namespace}/testkinds"
	oas := &spec3.OpenAPI{
		Paths: &spec3.Paths{Paths: map[string]*spec3.Path{
			base: {PathProps: spec3.PathProps{
				Post: &spec3.Operation{OperationProps: spec3.OperationProps{
					RequestBody: &spec3.RequestBody{RequestBodyProps: spec3.RequestBodyProps{
						Content: map[string]*spec3.MediaType{
							"application/json": {MediaTypeProps: spec3.MediaTypeProps{Schema: spec.MapProperty(nil)}},
						},
					}},
				}},
			}},
		}},
		Components: &spec3.Components{Schemas: map[string]*spec.Schema{}},
	}

	b.postProcessManifestKinds(oas, root, version)

	example, ok := oas.Paths.Paths[base].Post.RequestBody.Content["application/json"].Example.(*unstructured.Unstructured)
	require.True(t, ok, "expected an unstructured example on the POST body")
	require.Equal(t, manifest.Group+"/"+version, example.GetAPIVersion())
	require.Equal(t, "TestKind", example.GetKind())

	// A namespaced kind that does not set folderScoped is folder-scoped, and
	// storage requires the folder, so the example must carry the annotation.
	require.Equal(t, "{folder-name}", example.GetAnnotations()[utils.AnnoKeyFolder])

	// The spec property is a $ref, and Foo/Bar/Baz are refs nested inside it:
	// every level must be resolved so the example is a usable request body.
	// Each placeholder is named after the field it stands in for, so the example
	// reads as a description of the body rather than as a wall of "example".
	require.Equal(t, map[string]any{
		"testField": "testField",
		"foo": map[string]any{
			"foo": "foo",
			"bar": map[string]any{
				"value": "value",
				"baz":   map[string]any{"value": 0},
			},
		},
	}, example.Object["spec"])
}

func TestSpecVersion(t *testing.T) {
	b := &AppPluginAPIBuilder{group: "example.ext.grafana.app", pluginJSON: plugins.JSONData{ID: "example-app"}}

	// The builder framework stamps Info.Title with "<group>/<version>"
	oas := &spec3.OpenAPI{Info: &spec.Info{InfoProps: spec.InfoProps{Title: "example.ext.grafana.app/v1alpha1"}}}
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

// A POST example is only useful if a client can send it back: a value that does
// not satisfy the declared format is rejected before it reaches the server.
func TestExampleValueFormats(t *testing.T) {
	info := &operationInfo{}
	for _, tc := range []struct {
		format string
		want   any
	}{
		{"date-time", "2020-01-02T15:04:05Z"},
		{"date", "2020-01-02"},
		{"duration", "5m"},
		{"uuid", "00000000-0000-0000-0000-000000000000"},
		{"email", "owner@example.com"},
		{"uri", "https://owner.com"},
		{"url", "https://owner.com"},
		{"byte", "ZXhhbXBsZQ=="},
		// An unknown format falls back to the field name, so the example reads
		// as a description of the body.
		{"", "owner"},
		{"password", "owner"},
	} {
		t.Run("format "+tc.format, func(t *testing.T) {
			s := spec.StringProperty()
			s.Format = tc.format
			require.Equal(t, tc.want, info.exampleValue(s, map[string]bool{}, "owner"))
		})
	}
}

func TestExampleValueTypes(t *testing.T) {
	info := &operationInfo{defs: map[string]common.OpenAPIDefinition{
		"pkg.Leaf": {Schema: *spec.StringProperty()},
	}}
	example := func(s *spec.Schema) any {
		return info.exampleValue(s, map[string]bool{}, "field")
	}

	require.Equal(t, 0, example(spec.Int64Property()))
	require.Equal(t, 0.0, example(spec.Float64Property()))
	require.Equal(t, false, example(spec.BoolProperty()))
	require.Nil(t, example(nil))
	require.Nil(t, example(&spec.Schema{}), "a schema with no type has no example")

	// An explicit example, default or enum beats anything derived from the type.
	require.Equal(t, "given", example(spec.StringProperty().WithExample("given")))
	require.Equal(t, "given", example(spec.StringProperty().WithDefault("given")))
	require.Equal(t, "given", example(spec.StringProperty().WithEnum("given", "other")))

	require.Equal(t, []any{"field"}, example(spec.ArrayProperty(spec.StringProperty())))
	require.Equal(t, []any{}, example(spec.ArrayProperty(nil)), "an array with no item schema")

	// A map is described by one entry, so the shape of the value is visible.
	require.Equal(t, map[string]any{"key": "field"}, example(spec.MapProperty(spec.StringProperty())))
	require.Equal(t, map[string]any{}, example(spec.MapProperty(nil)))

	// Read-only properties are server owned, so a request example must not
	// suggest sending them.
	obj := &spec.Schema{SchemaProps: spec.SchemaProps{
		Type: []string{"object"},
		Properties: map[string]spec.Schema{
			"title": *spec.StringProperty(),
			"uid":   {SchemaProps: spec.SchemaProps{Type: []string{"string"}}, SwaggerSchemaProps: spec.SwaggerSchemaProps{ReadOnly: true}},
			"leaf":  {SchemaProps: spec.SchemaProps{Ref: spec.MustCreateRef("#/components/schemas/pkg.Leaf")}},
		},
	}}
	require.Equal(t, map[string]any{"title": "title", "leaf": "leaf"}, example(obj))

	// A ref with no definition (ObjectMeta, say) stops the walk rather than
	// producing a wrong shape.
	require.Equal(t, map[string]any{},
		example(&spec.Schema{SchemaProps: spec.SchemaProps{Ref: spec.MustCreateRef("#/components/schemas/pkg.Unknown")}}))
}

// specProperty resolves the property the POST example is built from, and a kind
// whose schema names no spec has no example to build.
func TestSpecProperty(t *testing.T) {
	manifest := testManifest(t)
	defs := kindstore.LoadOpenAPIDefinitions(func(name string) spec.Ref {
		return spec.MustCreateRef(name)
	}, manifest.Group, manifest)
	name := kindstore.OpenAPIName(schema.GroupVersionKind{
		Group: manifest.Group, Version: "v1alpha1", Kind: "TestKind",
	})

	info := &operationInfo{defs: defs, name: name}
	require.NotNil(t, info.specProperty())

	require.Nil(t, (&operationInfo{defs: defs, name: "nope"}).specProperty(),
		"an unknown kind has nothing to describe")

	noSpec := map[string]common.OpenAPIDefinition{
		name: {Schema: spec.Schema{SchemaProps: spec.SchemaProps{Type: []string{"object"}}}},
	}
	require.Nil(t, (&operationInfo{defs: noSpec, name: name}).specProperty())
}

// The generic unstructured models are how the route builder describes a manifest
// kind's bodies before postProcessManifestKinds points them at the kind's own
// schema. Once it has, nothing refers to them and they are noise in a published
// spec -- but they still have to reach GetOpenAPIDefinitions, where server-side
// apply resolves a manifest GVK through them.
func TestDropUnstructuredModels(t *testing.T) {
	unstructuredModels := []string{
		common.EscapeJsonPointer(openapiutil.GetCanonicalTypeName(unstructured.Unstructured{})),
		common.EscapeJsonPointer(openapiutil.GetCanonicalTypeName(unstructured.UnstructuredList{})),
	}

	newSpec := func() *spec3.OpenAPI {
		schemas := map[string]*spec.Schema{}
		for _, name := range unstructuredModels {
			schemas[name] = &spec.Schema{SchemaProps: spec.SchemaProps{Type: []string{"object"}}}
		}
		return &spec3.OpenAPI{Components: &spec3.Components{Schemas: schemas}}
	}

	t.Run("dropped once every kind has its own schema", func(t *testing.T) {
		manifest := testManifest(t)
		b := &AppPluginAPIBuilder{group: manifest.Group, manifest: manifest}

		oas := newSpec()
		b.dropUnstructuredModels(oas, "v1alpha1")
		for _, name := range unstructuredModels {
			require.NotContains(t, oas.Components.Schemas, name)
		}
	})

	t.Run("kept for a kind that declares no schema", func(t *testing.T) {
		manifest := testManifest(t)
		manifest.Versions[1].Kinds = append(manifest.Versions[1].Kinds, app.ManifestVersionKind{
			Kind: "Schemaless", Plural: "schemaless", Scope: "Namespaced",
		})
		b := &AppPluginAPIBuilder{group: manifest.Group, manifest: manifest}

		oas := newSpec()
		b.dropUnstructuredModels(oas, "v1alpha1")
		for _, name := range unstructuredModels {
			require.Contains(t, oas.Components.Schemas, name,
				"that kind's bodies still refer to the generic model")
		}
	})

	// GetOpenAPIDefinitions is the server's own view, and server-side apply needs
	// the group-version-kind extension these carry.
	t.Run("still declared for the field manager", func(t *testing.T) {
		manifest := testManifest(t)
		b := &AppPluginAPIBuilder{group: manifest.Group, manifest: manifest}

		defs := b.GetOpenAPIDefinitions()(func(path string) spec.Ref {
			return spec.MustCreateRef("#/definitions/" + path)
		})
		def, ok := defs[openapiutil.GetCanonicalTypeName(unstructured.Unstructured{})]
		require.True(t, ok)
		require.Contains(t, def.Schema.Extensions, "x-kubernetes-group-version-kind")
	})
}
