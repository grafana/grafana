package pluginroute

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/definition"
)

// routesOnlyPlugin declares routes but no kinds, so there is nothing to store.
func routesOnlyPlugin() definition.PluginDefinition {
	plugin := testPlugin()
	plugin.Manifests[0].Versions[0].Kinds = nil
	return plugin
}

func TestRoutesOnlyHandler(t *testing.T) {
	plugin := routesOnlyPlugin()
	opts := allowAll(testOptions())
	opts.PluginInfo = plugin.JSONData.Info
	// No storage is needed when there is nothing to store.
	opts.Storage = nil
	handler := withRequester(loadHandler(t, plugin, opts))
	root := "/apis/example.ext.grafana.app/v1alpha1"

	t.Run("serves group discovery", func(t *testing.T) {
		var group metav1.APIGroup
		getJSON(t, handler, "/apis/example.ext.grafana.app", &group)
		require.Equal(t, "APIGroup", group.Kind)
		require.Equal(t, "example.ext.grafana.app", group.Name)
		require.Equal(t, "v1alpha1", group.PreferredVersion.Version)
		require.Len(t, group.Versions, 1, "unserved versions are not listed")
	})

	t.Run("serves version discovery without resources", func(t *testing.T) {
		var resources metav1.APIResourceList
		getJSON(t, handler, root, &resources)
		require.Equal(t, "APIResourceList", resources.Kind)
		require.Equal(t, "example.ext.grafana.app/v1alpha1", resources.GroupVersion)
		require.Empty(t, resources.APIResources)
	})

	t.Run("serves the routes in OpenAPI", func(t *testing.T) {
		// The router only caches a document that is not private, and must not
		// serve this one from cache to a caller who has lost access.
		res := get(t, handler, "/openapi/v3/apis/example.ext.grafana.app/v1alpha1")
		require.Contains(t, res.Header().Get("Cache-Control"), "private")

		var oas spec3.OpenAPI
		getJSON(t, handler, "/openapi/v3/apis/example.ext.grafana.app/v1alpha1", &oas)
		require.Equal(t, "example.ext.grafana.app/v1alpha1", oas.Info.Title)
		require.Equal(t, "12.3.4", oas.Info.Version)
		require.Equal(t, "An example", oas.Info.Description)
		require.Contains(t, oas.Paths.Paths, root+"/things")
		require.Contains(t, oas.Paths.Paths, root+"/namespaces/{namespace}/widgets")
	})

	t.Run("routes reach the plugin", func(t *testing.T) {
		for _, path := range []string{root + "/things", root + "/namespaces/default/widgets"} {
			res := get(t, handler, path)
			require.Contains(t, res.Body.String(), errStubRoute.Error(), "%s did not reach the plugin (%d)", path, res.Code)
		}
	})

	t.Run("an undeclared method is refused", func(t *testing.T) {
		res := httptest.NewRecorder()
		handler.ServeHTTP(res, httptest.NewRequest(http.MethodPost, root+"/things", nil))
		require.Equal(t, http.StatusMethodNotAllowed, res.Code)
		require.Equal(t, "GET, HEAD", res.Header().Get("Allow"))
	})

	t.Run("anything else is not found", func(t *testing.T) {
		for _, path := range []string{root + "/other", "/apis/example.ext.grafana.app/v2alpha1", "/apis/other.ext.grafana.app"} {
			res := get(t, handler, path)
			require.Equal(t, http.StatusNotFound, res.Code, path)
			require.Contains(t, res.Body.String(), `"reason":"NotFound"`, path)
		}
	})
}

// Without an API server the same filters still authenticate and authorize
// every request, documents included.
func TestRoutesOnlyHandlerAuthorization(t *testing.T) {
	paths := []string{
		"/apis/example.ext.grafana.app",
		"/openapi/v3/apis/example.ext.grafana.app/v1alpha1",
		"/apis/example.ext.grafana.app/v1alpha1/things",
	}

	unauthenticated := loadHandler(t, routesOnlyPlugin(), testOptions())
	for _, path := range paths {
		res := get(t, unauthenticated, path)
		require.Equal(t, http.StatusUnauthorized, res.Code, "%s: %s", path, res.Body.String())
	}

	withoutAccess := withRequester(loadHandler(t, routesOnlyPlugin(), testOptions()))
	for _, path := range paths {
		res := get(t, withoutAccess, path)
		require.Equal(t, http.StatusForbidden, res.Code, "%s: %s", path, res.Body.String())
		require.Contains(t, res.Body.String(), "no plugin access checker is configured")
	}
}

// A version without kinds next to one with them has nothing for the API server
// to install, so its documents come from versionDocuments, and discovery lists
// it without any resource.
func TestMixedManifestRoutesOnlyVersion(t *testing.T) {
	plugin := testPlugin()
	plugin.Manifests[0].Versions[1] = app.ManifestVersion{
		Name:   "v2alpha1",
		Served: true,
		OpenAPI: app.ManifestVersionOpenAPI{Paths: map[string]spec3.PathProps{
			"/namespaces/{namespace}/reports": {Get: testOperation("listReports")},
		}},
	}
	handler := withRequester(loadHandler(t, plugin, allowAll(testOptions())))

	var group metav1.APIGroup
	getJSON(t, handler, "/apis/example.ext.grafana.app", &group)
	versions := make([]string, 0, len(group.Versions))
	for _, v := range group.Versions {
		versions = append(versions, v.Version)
	}
	require.ElementsMatch(t, []string{"v1alpha1", "v2alpha1"}, versions)

	var resources metav1.APIResourceList
	getJSON(t, handler, "/apis/example.ext.grafana.app/v2alpha1", &resources)
	require.Empty(t, resources.APIResources, "no placeholder resource is listed")

	// The version with kinds is still the API server's.
	getJSON(t, handler, "/apis/example.ext.grafana.app/v1alpha1", &resources)
	names := make([]string, 0, len(resources.APIResources))
	for _, r := range resources.APIResources {
		names = append(names, r.Name)
	}
	require.Contains(t, names, "testkinds")

	res := get(t, handler, "/openapi/v3/apis/example.ext.grafana.app/v2alpha1")
	require.Equal(t, http.StatusOK, res.Code, res.Body.String())
	require.Contains(t, res.Header().Get("Cache-Control"), "private")
	var oas spec3.OpenAPI
	getJSON(t, handler, "/openapi/v3/apis/example.ext.grafana.app/v2alpha1", &oas)
	require.Contains(t, oas.Paths.Paths, "/apis/example.ext.grafana.app/v2alpha1/namespaces/{namespace}/reports")

	res = get(t, handler, "/apis/example.ext.grafana.app/v2alpha1/namespaces/default/reports")
	require.Contains(t, res.Body.String(), errStubRoute.Error(), "the route reached the plugin (%d)", res.Code)
}

func TestBuildOpenAPIRoutesOnly(t *testing.T) {
	plugin := routesOnlyPlugin()
	oas, err := BuildOpenAPI(plugin.JSONData.ID, plugin.Manifests[0], "", OpenAPIOptions{
		PluginInfo: plugins.Info{Description: "An example"},
	})
	require.NoError(t, err)
	require.Equal(t, "example.ext.grafana.app/v1alpha1", oas.Info.Title)
	require.Contains(t, oas.Paths.Paths, "/apis/example.ext.grafana.app/v1alpha1/things")
}

func TestHasKinds(t *testing.T) {
	require.True(t, hasKinds(testPlugin().Manifests[0]))
	require.False(t, hasKinds(routesOnlyPlugin().Manifests[0]))
	require.False(t, hasKinds(&app.ManifestData{Versions: []app.ManifestVersion{{
		Name: "v1", Served: false, Kinds: []app.ManifestVersionKind{{Kind: "Unserved"}},
	}}}), "kinds of an unserved version are never stored")
}
