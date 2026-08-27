package pluginopenapi

import (
	"encoding/json"
	"maps"
	"os"
	"slices"
	"testing"

	"github.com/go-logr/logr"
	"github.com/stretchr/testify/require"
	"k8s.io/klog/v2"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/definition"
)

// TestMain quiets the apiserver machinery's reports about the server each Build
// constructs, which say nothing about the spec under test.
func TestMain(m *testing.M) {
	klog.SetLogger(logr.Discard())
	os.Exit(m.Run())
}

func TestBuildManifestVersion(t *testing.T) {
	oas, err := Build(testPlugin(t), "v1alpha1", Options{BuildVersion: "12.3.4"})
	require.NoError(t, err)

	require.Equal(t, "example-app/v1alpha1", oas.Info.Title)
	require.Equal(t, "12.3.4", oas.Info.Version)
	require.Equal(t, "An example", oas.Info.Description)

	root := "/apis/example-app/v1alpha1/"
	paths := slices.Sorted(maps.Keys(oas.Paths.Paths))
	require.Equal(t, []string{
		root,
		root + "namespaces/{namespace}/app/instance",
		root + "namespaces/{namespace}/app/instance/health",
		root + "namespaces/{namespace}/app/instance/resources",
		// The kind, from resource storage.
		root + "namespaces/{namespace}/testkinds",
		// The routes the manifest declares, plus the generic ones.
		root + "namespaces/{namespace}/testkinds/search",
		root + "namespaces/{namespace}/testkinds/{name}",
		root + "namespaces/{namespace}/testkinds/{name}/reload",
	}, paths, "paths should not include the watch or all-namespace routes the server hides")

	// The kind's schema, and the list wrapper around it, are the response types.
	kind := "example-app.v1alpha1.TestKind"
	require.Contains(t, oas.Components.Schemas, kind)
	require.Contains(t, oas.Components.Schemas, kind+"List")
	require.Equal(t, "#/components/schemas/"+kind+"List",
		responseRef(t, oas.Paths.Paths[root+"namespaces/{namespace}/testkinds"].Get))
	require.Equal(t, "#/components/schemas/"+kind,
		responseRef(t, oas.Paths.Paths[root+"namespaces/{namespace}/testkinds/{name}"].Get))
}

// The settings API is served in every version, including the one a manifest
// never mentions.
func TestBuildSettingsVersion(t *testing.T) {
	oas, err := Build(testPlugin(t), "v0alpha1", Options{BuildVersion: "12.3.4"})
	require.NoError(t, err)

	require.Equal(t, "example-app/v0alpha1", oas.Info.Title)
	root := "/apis/example-app/v0alpha1/"
	require.Equal(t, []string{
		root,
		root + "namespaces/{namespace}/app/instance",
		root + "namespaces/{namespace}/app/instance/health",
		root + "namespaces/{namespace}/app/instance/resources",
	}, slices.Sorted(maps.Keys(oas.Paths.Paths)))
}

func TestBuildVersionSelection(t *testing.T) {
	t.Run("no version renders the preferred one", func(t *testing.T) {
		oas, err := Build(testPlugin(t), "", Options{})
		require.NoError(t, err)
		require.Equal(t, "example-app/v1alpha1", oas.Info.Title)
	})

	t.Run("an unserved version is refused", func(t *testing.T) {
		_, err := Build(testPlugin(t), "v9", Options{})
		require.ErrorContains(t, err, `does not serve version "v9"`)
	})

	t.Run("a plugin without a manifest still serves settings", func(t *testing.T) {
		plugin := testPlugin(t)
		plugin.Manifest = nil
		oas, err := Build(plugin, "", Options{})
		require.NoError(t, err)
		require.Equal(t, "example-app/v0alpha1", oas.Info.Title)
	})
}

// The proxy subresource is only served when the toggle for it is on.
func TestBuildProxyRoute(t *testing.T) {
	proxy := "/apis/example-app/v1alpha1/namespaces/{namespace}/app/instance/proxy"

	oas, err := Build(testPlugin(t), "v1alpha1", Options{})
	require.NoError(t, err)
	require.NotContains(t, oas.Paths.Paths, proxy)

	oas, err = Build(testPlugin(t), "v1alpha1", Options{RegisterProxy: true})
	require.NoError(t, err)
	require.Contains(t, oas.Paths.Paths, proxy)
}

// responseRef returns the schema an operation's 200 response refers to.
func responseRef(t *testing.T, op *spec3.Operation) string {
	t.Helper()

	require.NotNil(t, op)
	content := op.Responses.StatusCodeResponses[200].Content["application/json"]
	require.NotNil(t, content)
	return content.Schema.Ref.String()
}

func testPlugin(t *testing.T) definition.PluginDefinition {
	t.Helper()

	var schema app.VersionSchema
	require.NoError(t, json.Unmarshal([]byte(`{
		"TestKind":{"type":"object","properties":{"spec":{"$ref":"#/components/schemas/spec"}},"required":["spec"]},
		"spec":{"type":"object","additionalProperties":false,"properties":{"testField":{"type":"string"}},"required":["testField"]}
	}`), &schema))

	return definition.PluginDefinition{
		JSONData: plugins.JSONData{
			ID:   "example-app",
			Type: plugins.TypeApp,
			Info: plugins.Info{Description: "An example"},
			// A route makes the plugin proxy available.
			Routes: []*plugins.Route{{Path: "example", URL: "http://example.com"}},
		},
		Manifest: &app.ManifestData{
			AppName:          "example",
			Group:            "example.ext.grafana.com", // replaced by the plugin id
			PreferredVersion: "v1alpha1",
			Versions: []app.ManifestVersion{{
				Name:   "v1alpha1",
				Served: true,
				Kinds: []app.ManifestVersionKind{{
					Kind:   "TestKind",
					Plural: "TestKinds",
					Scope:  "Namespaced",
					Schema: &schema,
					Routes: map[string]spec3.PathProps{
						"/reload": {Post: &spec3.Operation{OperationProps: spec3.OperationProps{
							OperationId: "reloadTestKind",
							Responses: &spec3.Responses{ResponsesProps: spec3.ResponsesProps{
								Default: &spec3.Response{ResponseProps: spec3.ResponseProps{Description: "OK"}},
							}},
						}}},
					},
				}},
			}},
		},
	}
}
