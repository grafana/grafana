package pluginroute

import (
	"encoding/json"
	"maps"
	"slices"
	"testing"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/stretchr/testify/require"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana/pkg/plugins"
)

func TestBuildOpenAPI(t *testing.T) {
	oas, err := BuildOpenAPI("example-app", offlineManifest(t), "v1alpha1", OpenAPIOptions{
		PluginInfo:   plugins.Info{Description: "An example"},
		BuildVersion: "12.3.4",
	})
	require.NoError(t, err)

	require.Equal(t, "example.ext.grafana.app/v1alpha1", oas.Info.Title)
	require.Equal(t, "12.3.4", oas.Info.Version)
	require.Equal(t, "An example", oas.Info.Description)
	raw, err := json.Marshal(oas)
	require.NoError(t, err)
	_, err = openapi3.NewLoader().LoadFromData(raw)
	require.NoError(t, err, "all schema references must resolve without settings")

	root := "/apis/example.ext.grafana.app/v1alpha1/"
	require.Equal(t, []string{
		root,
		// The kind, from resource storage.
		root + "namespaces/{namespace}/testkinds",
		// The routes the manifest declares, plus the generic ones. list-keys is the
		// only generic route mounted at both scopes.
		root + "namespaces/{namespace}/testkinds/list-keys",
		root + "namespaces/{namespace}/testkinds/search",
		root + "namespaces/{namespace}/testkinds/{name}",
		root + "namespaces/{namespace}/testkinds/{name}/reload",
		root + "testkinds/list-keys",
	}, slices.Sorted(maps.Keys(oas.Paths.Paths)), "paths should not include the watch or all-namespace routes the server hides")

	// The kind's schema, and the list wrapper around it, are the response types.
	kind := "example.ext.grafana.app.v1alpha1.TestKind"
	require.Contains(t, oas.Components.Schemas, kind)
	require.Contains(t, oas.Components.Schemas, kind+"List")
	require.Equal(t, "#/components/schemas/"+kind+"List",
		responseRef(t, oas.Paths.Paths[root+"namespaces/{namespace}/testkinds"].Get))
	require.Equal(t, "#/components/schemas/"+kind,
		responseRef(t, oas.Paths.Paths[root+"namespaces/{namespace}/testkinds/{name}"].Get))
}

func TestBuildOpenAPIHybridRoute(t *testing.T) {
	manifest := offlineManifest(t)
	hybrid, endpoint := true, false
	manifest.Versions[0].Kinds[0].Search = &app.ManifestVersionKindSearch{Endpoint: &endpoint, Hybrid: &hybrid}
	oas, err := BuildOpenAPI("example-app", manifest, "v1alpha1", OpenAPIOptions{})
	require.NoError(t, err)

	root := "/apis/example.ext.grafana.app/v1alpha1/namespaces/{namespace}/testkinds"
	require.NotContains(t, oas.Paths.Paths, root+"/search")
	route, ok := oas.Paths.Paths[root+"/search/hybrid"]
	require.True(t, ok)
	require.NotNil(t, route.Post)
	require.Contains(t, responseRef(t, route.Post), "HybridSearchResults")

	raw, err := json.Marshal(oas)
	require.NoError(t, err)
	_, err = openapi3.NewLoader().LoadFromData(raw)
	require.NoError(t, err, "hybrid request and response schemas must resolve")
}

func TestBuildOpenAPIVersionSelection(t *testing.T) {
	t.Run("no version renders the preferred one", func(t *testing.T) {
		oas, err := BuildOpenAPI("example-app", offlineManifest(t), "", OpenAPIOptions{})
		require.NoError(t, err)
		require.Equal(t, "example.ext.grafana.app/v1alpha1", oas.Info.Title)
	})

	t.Run("an unserved version is refused", func(t *testing.T) {
		_, err := BuildOpenAPI("example-app", offlineManifest(t), "v9", OpenAPIOptions{})
		require.ErrorContains(t, err, `does not serve version "v9"`)
	})

	// Settings are never part of a manifest's API.
	t.Run("the settings version is refused", func(t *testing.T) {
		_, err := BuildOpenAPI("example-app", offlineManifest(t), "v0alpha1", OpenAPIOptions{})
		require.ErrorContains(t, err, `does not serve version "v0alpha1"`)
	})

	t.Run("a manifest without served versions is refused", func(t *testing.T) {
		manifest := offlineManifest(t)
		manifest.Versions[0].Served = false
		for _, version := range []string{"", "v1alpha1"} {
			_, err := BuildOpenAPI("example-app", manifest, version, OpenAPIOptions{})
			require.ErrorContains(t, err, "no served versions")
		}
	})

	t.Run("a manifest the handler refuses is reported", func(t *testing.T) {
		manifest := offlineManifest(t)
		manifest.Versions[0].Kinds[0].Kind = "Settings"
		_, err := BuildOpenAPI("example-app", manifest, "", OpenAPIOptions{})
		require.ErrorContains(t, err, "reserved kind name")
	})

	t.Run("an invalid manifest is refused", func(t *testing.T) {
		manifest := offlineManifest(t)
		manifest.Group = "example.com"
		_, err := BuildOpenAPI("example-app", manifest, "", OpenAPIOptions{})
		require.ErrorContains(t, err, "invalid manifest group")
	})
}

func TestServedVersions(t *testing.T) {
	manifest := offlineManifest(t)
	manifest.Versions = append(manifest.Versions,
		app.ManifestVersion{Name: "v2alpha1", Served: true},
		app.ManifestVersion{Name: "v0alpha1", Served: false})
	require.Equal(t, []string{"v1alpha1", "v2alpha1"}, ServedVersions(manifest), "preferred version first, unserved left out")
	require.Nil(t, ServedVersions(nil))
}

// responseRef returns the schema an operation's 200 response refers to.
func responseRef(t *testing.T, op *spec3.Operation) string {
	t.Helper()

	require.NotNil(t, op)
	content := op.Responses.StatusCodeResponses[200].Content["application/json"]
	require.NotNil(t, content)
	return content.Schema.Ref.String()
}

func offlineManifest(t *testing.T) *app.ManifestData {
	t.Helper()

	var schema app.VersionSchema
	require.NoError(t, json.Unmarshal([]byte(`{
		"TestKind":{"type":"object","properties":{"spec":{"$ref":"#/components/schemas/spec"}},"required":["spec"]},
		"spec":{"type":"object","additionalProperties":false,"properties":{"testField":{"type":"string"}},"required":["testField"]}
	}`), &schema))

	return &app.ManifestData{
		AppName:          "example",
		Group:            "example.ext.grafana.app",
		PreferredVersion: "v1alpha1",
		Versions: []app.ManifestVersion{{
			Name:   "v1alpha1",
			Served: true,
			Kinds: []app.ManifestVersionKind{{
				Kind:   "TestKind",
				Plural: "TestKinds",
				Scope:  "Namespaced",
				Schema: &schema,
				// Declared search fields are what enrol a kind in the
				// generic search endpoint.
				SearchFields: []app.ManifestVersionKindSearchField{{
					Name: "testField", Path: "spec.testField", Type: "string",
				}},
			}},
			OpenAPI: app.ManifestVersionOpenAPI{Paths: map[string]spec3.PathProps{
				"/namespaces/{namespace}/testkinds/{name}/reload": {Post: &spec3.Operation{OperationProps: spec3.OperationProps{
					OperationId: "reloadTestKind",
					Responses: &spec3.Responses{ResponsesProps: spec3.ResponsesProps{
						Default: &spec3.Response{ResponseProps: spec3.ResponseProps{Description: "OK"}},
					}},
				}}},
			}},
		}},
	}
}
