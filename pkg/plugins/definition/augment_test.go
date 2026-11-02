package definition

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana-plugin-sdk-go/experimental/pluginschema"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

func TestRewriteAppInstance(t *testing.T) {
	const path = "/apis/example-app/v0alpha1/namespaces/{namespace}/app"

	newOAS := func(paths map[string]*spec3.Path) *spec3.OpenAPI {
		return &spec3.OpenAPI{
			Paths: &spec3.Paths{Paths: paths},
		}
	}
	nameParam := &spec3.Parameter{ParameterProps: spec3.ParameterProps{Name: "name", In: "path"}}
	namespaceParam := &spec3.Parameter{ParameterProps: spec3.ParameterProps{Name: "namespace", In: "path"}}

	t.Run("removes the collection path", func(t *testing.T) {
		oas := newOAS(map[string]*spec3.Path{
			path: {PathProps: spec3.PathProps{Get: &spec3.Operation{}}},
		})

		RewriteAppInstance(oas, path)

		_, exists := oas.Paths.Paths[path]
		assert.False(t, exists, "collection path should be deleted")
	})

	t.Run("rewrites /{name} to /instance", func(t *testing.T) {
		oas := newOAS(map[string]*spec3.Path{
			path + "/{name}": {PathProps: spec3.PathProps{Get: &spec3.Operation{}}},
		})

		RewriteAppInstance(oas, path)

		_, oldExists := oas.Paths.Paths[path+"/{name}"]
		assert.False(t, oldExists, "parameterised path should be removed")
		_, newExists := oas.Paths.Paths[path+"/instance"]
		assert.True(t, newExists, "instance path should be registered")
	})

	t.Run("rewrites subresource paths", func(t *testing.T) {
		oas := newOAS(map[string]*spec3.Path{
			path + "/{name}/health":           {PathProps: spec3.PathProps{Get: &spec3.Operation{}}},
			path + "/{name}/resources":        {PathProps: spec3.PathProps{Get: &spec3.Operation{}}},
			path + "/{name}/resources/{path}": {PathProps: spec3.PathProps{Get: &spec3.Operation{}}},
			path + "/{name}/proxy":            {PathProps: spec3.PathProps{Post: &spec3.Operation{}}},
		})

		RewriteAppInstance(oas, path)

		for _, want := range []string{
			path + "/instance/health",
			path + "/instance/resources",
			path + "/instance/resources/{path}",
			path + "/instance/proxy",
		} {
			_, ok := oas.Paths.Paths[want]
			assert.Truef(t, ok, "expected rewritten path %q", want)
		}
		for _, gone := range []string{
			path + "/{name}/health",
			path + "/{name}/resources",
			path + "/{name}/resources/{path}",
			path + "/{name}/proxy",
		} {
			_, ok := oas.Paths.Paths[gone]
			assert.Falsef(t, ok, "expected parameterised path %q to be removed", gone)
		}
	})

	t.Run("strips only the name parameter", func(t *testing.T) {
		oas := newOAS(map[string]*spec3.Path{
			path + "/{name}/health": {
				PathProps: spec3.PathProps{
					Parameters: []*spec3.Parameter{namespaceParam, nameParam},
					Get:        &spec3.Operation{},
				},
			},
		})

		RewriteAppInstance(oas, path)

		got := oas.Paths.Paths[path+"/instance/health"]
		require.NotNil(t, got)
		require.Len(t, got.Parameters, 1)
		assert.Equal(t, "namespace", got.Parameters[0].Name)
	})

	t.Run("leaves unrelated paths untouched", func(t *testing.T) {
		other := "/apis/other-group/v0alpha1/namespaces/{namespace}/widgets/{name}"
		oas := newOAS(map[string]*spec3.Path{
			path + "/{name}/health": {PathProps: spec3.PathProps{Get: &spec3.Operation{}}},
			other: {
				PathProps: spec3.PathProps{
					Parameters: []*spec3.Parameter{nameParam},
					Get:        &spec3.Operation{},
				},
			},
		})

		RewriteAppInstance(oas, path)

		widget, ok := oas.Paths.Paths[other]
		require.True(t, ok, "unrelated path should still exist")
		require.Len(t, widget.Parameters, 1, "unrelated path parameters should be untouched")
		assert.Equal(t, "name", widget.Parameters[0].Name)
	})

	t.Run("returns the same instance", func(t *testing.T) {
		oas := newOAS(map[string]*spec3.Path{})
		assert.Same(t, oas, RewriteAppInstance(oas, path))
	})
}

const augmentPath = "/apis/example-app/v0alpha1/namespaces/{namespace}/app"

// newAugmentOAS builds the subset of a generated spec that AugmentOpenAPI
// requires: the collection path with a POST, the /{name} path with a GET and
// its path parameters, and the default resources/proxy subresources.
func newAugmentOAS(path string) *spec3.OpenAPI {
	return &spec3.OpenAPI{
		Components: &spec3.Components{Schemas: map[string]*spec.Schema{}},
		Paths: &spec3.Paths{Paths: map[string]*spec3.Path{
			path: {PathProps: spec3.PathProps{
				Post: &spec3.Operation{OperationProps: spec3.OperationProps{
					RequestBody: &spec3.RequestBody{RequestBodyProps: spec3.RequestBodyProps{
						Content: map[string]*spec3.MediaType{"application/json": {}},
					}},
				}},
			}},
			path + "/{name}": {PathProps: spec3.PathProps{
				Parameters: []*spec3.Parameter{
					{ParameterProps: spec3.ParameterProps{Name: "namespace", In: "path"}},
					{ParameterProps: spec3.ParameterProps{Name: "name", In: "path"}},
				},
				Get: &spec3.Operation{},
			}},
			path + "/{name}/resources": {PathProps: spec3.PathProps{Get: &spec3.Operation{}}},
			path + "/{name}/proxy":     {PathProps: spec3.PathProps{Get: &spec3.Operation{}}},
		}},
	}
}

func newResourceSchema() *spec.Schema {
	return &spec.Schema{SchemaProps: spec.SchemaProps{
		Type:       []string{"object"},
		Properties: map[string]spec.Schema{},
	}}
}

func TestAugmentOpenAPI(t *testing.T) {
	t.Run("zero schema is a no-op", func(t *testing.T) {
		oas := newAugmentOAS(augmentPath)
		got, err := AugmentOpenAPI(oas, SettingsResource{
			Schema:   &pluginschema.PluginSchema{},
			Resource: newResourceSchema(),
			SpecName: "SettingsSpec",
			Path:     augmentPath,
		})
		require.NoError(t, err)
		assert.Same(t, oas, got)
		assert.Empty(t, oas.Components.Schemas, "nothing should be registered")
	})

	t.Run("nil schema is a no-op", func(t *testing.T) {
		oas := newAugmentOAS(augmentPath)
		got, err := AugmentOpenAPI(oas, SettingsResource{Path: augmentPath})
		require.NoError(t, err)
		assert.Same(t, oas, got)
	})

	settingsOnly := func() *pluginschema.PluginSchema {
		return &pluginschema.PluginSchema{
			SettingsSchema: &pluginschema.Settings{
				Spec: &spec.Schema{SchemaProps: spec.SchemaProps{
					Type: []string{"object"},
					Properties: map[string]spec.Schema{
						"path": *spec.StringProperty(),
					},
				}},
			},
		}
	}

	t.Run("missing routes are reported", func(t *testing.T) {
		for _, tc := range []struct {
			name    string
			mutate  func(*spec3.OpenAPI)
			expects string
		}{
			{
				name:    "no collection path",
				mutate:  func(oas *spec3.OpenAPI) { delete(oas.Paths.Paths, augmentPath) },
				expects: "no route registered",
			},
			{
				name:    "no POST on the collection path",
				mutate:  func(oas *spec3.OpenAPI) { oas.Paths.Paths[augmentPath].Post = nil },
				expects: "expecting POST under",
			},
			{
				name:    "no {name} path",
				mutate:  func(oas *spec3.OpenAPI) { delete(oas.Paths.Paths, augmentPath+"/{name}") },
				expects: "expecting route registered",
			},
			{
				name:    "no GET on the {name} path",
				mutate:  func(oas *spec3.OpenAPI) { oas.Paths.Paths[augmentPath+"/{name}"].Get = nil },
				expects: "expecting GET under",
			},
		} {
			t.Run(tc.name, func(t *testing.T) {
				oas := newAugmentOAS(augmentPath)
				tc.mutate(oas)

				_, err := AugmentOpenAPI(oas, SettingsResource{
					Schema:   settingsOnly(),
					Resource: newResourceSchema(),
					SpecName: "SettingsSpec",
					Path:     augmentPath,
				})
				require.ErrorContains(t, err, tc.expects)
			})
		}
	})

	t.Run("registers the settings spec and links it from the resource", func(t *testing.T) {
		oas := newAugmentOAS(augmentPath)
		resource := newResourceSchema()

		_, err := AugmentOpenAPI(oas, SettingsResource{
			Schema:   settingsOnly(),
			Resource: resource,
			SpecName: "DataSourceSpec",
			Path:     augmentPath,
		})
		require.NoError(t, err)

		registered, ok := oas.Components.Schemas["DataSourceSpec"]
		require.True(t, ok, "spec should be registered under SpecName")
		assert.Contains(t, registered.Properties, "path", "the plugin's own spec should be used verbatim")
		specProp := resource.Properties["spec"]
		assert.Equal(t, "#/components/schemas/DataSourceSpec", specProp.Ref.String())
		assert.Nil(t, resource.Example, "only apps get a canned example")
	})

	t.Run("app wraps the spec in the settings envelope", func(t *testing.T) {
		oas := newAugmentOAS(augmentPath)
		resource := newResourceSchema()

		_, err := AugmentOpenAPI(oas, SettingsResource{
			Schema:   settingsOnly(),
			Resource: resource,
			SpecName: "SettingsSpec",
			Path:     augmentPath,
			IsApp:    true,
		})
		require.NoError(t, err)

		registered := oas.Components.Schemas["SettingsSpec"]
		require.NotNil(t, registered)
		assert.Contains(t, registered.Properties, "enabled")
		assert.Contains(t, registered.Properties, "pinned")
		jsonData := registered.Properties["jsonData"]
		assert.Contains(t, jsonData.Properties, "path", "the plugin spec becomes jsonData")

		example, ok := resource.Example.(map[string]any)
		require.True(t, ok, "apps get a canned instance example")
		assert.Equal(t, map[string]any{"name": app_INSTANCE_NAME}, example["metadata"])

		_, hasNamed := oas.Paths.Paths[augmentPath+"/{name}"]
		assert.False(t, hasNamed, "{name} should be rewritten to /instance")
		_, hasInstance := oas.Paths.Paths[augmentPath+"/instance"]
		assert.True(t, hasInstance)
	})

	t.Run("secure values", func(t *testing.T) {
		oas := newAugmentOAS(augmentPath)
		resource := newResourceSchema()
		schema := settingsOnly()
		schema.SettingsSchema.SecureValues = []pluginschema.SecureValueInfo{
			{Key: "apiKey", Description: "the key", Required: true},
			{Key: "optional", Description: "not required"},
		}

		_, err := AugmentOpenAPI(oas, SettingsResource{
			Schema:   schema,
			Resource: resource,
			SpecName: "DataSourceSpec",
			Path:     augmentPath,
		})
		require.NoError(t, err)

		secure, ok := oas.Components.Schemas["SecureValues"]
		require.True(t, ok)
		assert.Contains(t, secure.Properties, "apiKey")
		assert.Contains(t, secure.Properties, "optional")
		assert.Equal(t, "the key", secure.Properties["apiKey"].Description)
		assert.Equal(t, []string{"apiKey"}, secure.Required, "only required keys are required")
		assert.False(t, secure.AdditionalProperties.Allows, "unknown secure keys are rejected")

		example, ok := secure.Example.(common.InlineSecureValues)
		require.True(t, ok)
		assert.Equal(t, common.InlineSecureValues{"apiKey": {Create: "***"}}, example,
			"only required keys appear in the example")

		secureProp := resource.Properties["secure"]
		assert.Equal(t, "#/components/schemas/SecureValues", secureProp.Ref.String())
	})

	t.Run("no secure values means no SecureValues component", func(t *testing.T) {
		oas := newAugmentOAS(augmentPath)
		resource := newResourceSchema()

		_, err := AugmentOpenAPI(oas, SettingsResource{
			Schema:   settingsOnly(),
			Resource: resource,
			SpecName: "DataSourceSpec",
			Path:     augmentPath,
		})
		require.NoError(t, err)

		assert.NotContains(t, oas.Components.Schemas, "SecureValues")
		assert.NotContains(t, resource.Properties, "secure")
	})

	t.Run("settings examples are attached to the POST body", func(t *testing.T) {
		oas := newAugmentOAS(augmentPath)
		schema := settingsOnly()
		schema.SettingsExamples = &pluginschema.SettingsExamples{
			Examples: map[string]*spec3.Example{
				"basic": {ExampleProps: spec3.ExampleProps{Summary: "basic"}},
			},
		}

		_, err := AugmentOpenAPI(oas, SettingsResource{
			Schema:   schema,
			Resource: newResourceSchema(),
			SpecName: "DataSourceSpec",
			Path:     augmentPath,
		})
		require.NoError(t, err)

		content := oas.Paths.Paths[augmentPath].Post.RequestBody.Content["application/json"]
		require.NotNil(t, content)
		assert.Contains(t, content.Examples, "basic")
	})

	routesSchema := func() *pluginschema.PluginSchema {
		return &pluginschema.PluginSchema{
			Routes: &pluginschema.Routes{
				Paths: map[string]*spec3.Path{
					"/resources/{path}": {PathProps: spec3.PathProps{
						Get:  &spec3.Operation{},
						Post: &spec3.Operation{},
					}},
					"/proxy/ping": {PathProps: spec3.PathProps{
						Get: &spec3.Operation{},
					}},
				},
				Components: &spec3.Components{
					Schemas: map[string]*spec.Schema{"Custom": spec.StringProperty()},
				},
			},
		}
	}

	t.Run("routes replace the default subresources", func(t *testing.T) {
		oas := newAugmentOAS(augmentPath)

		_, err := AugmentOpenAPI(oas, SettingsResource{
			Schema:   routesSchema(),
			Resource: newResourceSchema(),
			SpecName: "DataSourceSpec",
			Path:     augmentPath,
		})
		require.NoError(t, err)

		prefix := augmentPath + "/{name}"
		assert.NotContains(t, oas.Paths.Paths, prefix+"/resources", "generic route should be dropped")
		assert.NotContains(t, oas.Paths.Paths, prefix+"/proxy", "generic route should be dropped")
		assert.Contains(t, oas.Paths.Paths, prefix+"/resources/{path}")
		assert.Contains(t, oas.Paths.Paths, prefix+"/proxy/ping")

		assert.Contains(t, oas.Components.Schemas, "Custom", "route components should be copied")
		assert.NotContains(t, oas.Components.Schemas, "DataSourceSpec",
			"a routes-only schema has no settings to register")
	})

	t.Run("routes get tags, operation ids and path parameters", func(t *testing.T) {
		oas := newAugmentOAS(augmentPath)

		_, err := AugmentOpenAPI(oas, SettingsResource{
			Schema:   routesSchema(),
			Resource: newResourceSchema(),
			SpecName: "DataSourceSpec",
			Path:     augmentPath,
		})
		require.NoError(t, err)

		resources := oas.Paths.Paths[augmentPath+"/{name}/resources/{path}"]
		require.NotNil(t, resources)
		assert.Equal(t, []string{"Resources"}, resources.Get.Tags)
		assert.Equal(t, "get_resources_path", resources.Get.OperationId)
		assert.Equal(t, "post_resources_path", resources.Post.OperationId)
		assert.NotNil(t, resources.Get.Extensions)

		names := make([]string, len(resources.Parameters))
		for i, p := range resources.Parameters {
			names[i] = p.Name
		}
		assert.Equal(t, []string{"namespace", "name"}, names,
			"datasources keep both path parameters")

		proxy := oas.Paths.Paths[augmentPath+"/proxy/ping"]
		assert.Nil(t, proxy, "routes hang off the named instance, not the collection")
		assert.Equal(t, []string{"Proxy"},
			oas.Paths.Paths[augmentPath+"/{name}/proxy/ping"].Get.Tags)
	})

	t.Run("app routes hang off /instance and drop the name parameter", func(t *testing.T) {
		oas := newAugmentOAS(augmentPath)

		_, err := AugmentOpenAPI(oas, SettingsResource{
			Schema:   routesSchema(),
			Resource: newResourceSchema(),
			SpecName: "SettingsSpec",
			Path:     augmentPath,
			IsApp:    true,
		})
		require.NoError(t, err)

		resources := oas.Paths.Paths[augmentPath+"/instance/resources/{path}"]
		require.NotNil(t, resources, "app routes are registered under /instance")

		names := make([]string, len(resources.Parameters))
		for i, p := range resources.Parameters {
			names[i] = p.Name
		}
		assert.Equal(t, []string{"namespace"}, names, "apps have a fixed instance name")
	})

	t.Run("route prefixes are validated", func(t *testing.T) {
		oas := newAugmentOAS(augmentPath)
		schema := &pluginschema.PluginSchema{
			Routes: &pluginschema.Routes{
				Paths: map[string]*spec3.Path{
					"/custom": {PathProps: spec3.PathProps{Get: &spec3.Operation{}}},
				},
			},
		}

		got, err := AugmentOpenAPI(oas, SettingsResource{
			Schema:   schema,
			Resource: newResourceSchema(),
			SpecName: "DataSourceSpec",
			Path:     augmentPath,
		})
		require.ErrorContains(t, err, "invalid path: /custom")
		assert.Same(t, oas, got)
		assert.NotContains(t, oas.Paths.Paths, augmentPath+"/{name}/custom")
	})
}

func TestGetPathOperations(t *testing.T) {
	t.Run("empty path has no operations", func(t *testing.T) {
		assert.Empty(t, getPathOperations(&spec3.PathProps{}))
	})

	t.Run("returns every defined operation", func(t *testing.T) {
		get, head, del := &spec3.Operation{}, &spec3.Operation{}, &spec3.Operation{}
		post, put, patch := &spec3.Operation{}, &spec3.Operation{}, &spec3.Operation{}
		trace, options := &spec3.Operation{}, &spec3.Operation{}

		ops := getPathOperations(&spec3.PathProps{
			Get: get, Head: head, Delete: del, Post: post,
			Put: put, Patch: patch, Trace: trace, Options: options,
		})

		assert.Equal(t, map[string]*spec3.Operation{
			http.MethodGet:     get,
			http.MethodHead:    head,
			http.MethodDelete:  del,
			http.MethodPost:    post,
			http.MethodPut:     put,
			http.MethodPatch:   patch,
			http.MethodTrace:   trace,
			http.MethodOptions: options,
		}, ops)
	})

	t.Run("skips nil operations", func(t *testing.T) {
		ops := getPathOperations(&spec3.PathProps{Get: &spec3.Operation{}})
		require.Len(t, ops, 1)
		assert.Contains(t, ops, http.MethodGet)
	})
}

func TestCopyComponents(t *testing.T) {
	src := &spec3.Components{
		Schemas:       map[string]*spec.Schema{"Schema": {}},
		Responses:     map[string]*spec3.Response{"Response": {}},
		Examples:      map[string]*spec3.Example{"Example": {}},
		Headers:       map[string]*spec3.Header{"Header": {}},
		Parameters:    map[string]*spec3.Parameter{"Parameter": {}},
		Links:         map[string]*spec3.Link{"Link": {}},
		RequestBodies: map[string]*spec3.RequestBody{"RequestBody": {}},
	}

	t.Run("allocates missing destination maps", func(t *testing.T) {
		dst := &spec3.Components{}
		copyComponents(src, dst)

		assert.Contains(t, dst.Schemas, "Schema")
		assert.Contains(t, dst.Responses, "Response")
		assert.Contains(t, dst.Examples, "Example")
		assert.Contains(t, dst.Headers, "Header")
		assert.Contains(t, dst.Parameters, "Parameter")
		assert.Contains(t, dst.Links, "Link")
		assert.Contains(t, dst.RequestBodies, "RequestBody")
	})

	t.Run("merges into existing maps", func(t *testing.T) {
		existing := &spec.Schema{SchemaProps: spec.SchemaProps{Description: "keep me"}}
		dst := &spec3.Components{Schemas: map[string]*spec.Schema{"Existing": existing}}

		copyComponents(src, dst)

		assert.Len(t, dst.Schemas, 2)
		assert.Same(t, existing, dst.Schemas["Existing"], "existing entries survive")
		assert.Contains(t, dst.Schemas, "Schema")
	})

	t.Run("empty source leaves the destination alone", func(t *testing.T) {
		dst := &spec3.Components{}
		copyComponents(&spec3.Components{}, dst)
		assert.Equal(t, &spec3.Components{}, dst)
	})
}
