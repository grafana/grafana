package definition

import (
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana/pkg/plugins"
)

func appWithRoutes(routes []*plugins.Route, manifests ...*app.ManifestData) PluginDefinition {
	return PluginDefinition{
		JSONData:  plugins.JSONData{ID: "example-app", Type: plugins.TypeApp, Routes: routes},
		Manifests: manifests,
	}
}

func settingsPaths(t *testing.T, manifest *app.ManifestData) map[string]spec3.PathProps {
	t.Helper()
	require.NotNil(t, manifest)
	require.Equal(t, "example-app", manifest.Group, "the settings API is served under the plugin ID")
	require.Len(t, manifest.Versions, 1)
	version := manifest.Versions[0]
	require.Equal(t, "v0alpha1", version.Name)
	require.True(t, version.Served)
	require.Equal(t, []app.ManifestVersionKind{settingsKind}, version.Kinds)
	return version.OpenAPI.Paths
}

func TestNewSettingsManifest(t *testing.T) {
	t.Run("only apps have one", func(t *testing.T) {
		manifest, err := NewSettingsManifest(PluginDefinition{JSONData: plugins.JSONData{ID: "ds", Type: plugins.TypeDataSource}}, testMatcher)
		require.NoError(t, err)
		require.Nil(t, manifest)
	})

	t.Run("an app without routes serves only its settings", func(t *testing.T) {
		manifest, err := NewSettingsManifest(appWithRoutes(nil), testMatcher)
		require.NoError(t, err)
		require.Empty(t, settingsPaths(t, manifest))
	})

	t.Run("plugin.json routes are declared below the proxy subresource", func(t *testing.T) {
		manifest, err := NewSettingsManifest(appWithRoutes([]*plugins.Route{
			{Path: "api/items/:id", Method: http.MethodGet, URL: "https://items"},
			{Path: "api/*", URL: "https://api"},
		}), testMatcher)
		require.NoError(t, err)
		paths := settingsPaths(t, manifest)
		require.Contains(t, paths, SettingsProxyRoot+"/api/items/{id}")
		require.Contains(t, paths, SettingsProxyRoot+"/api/{path:*}")

		// The plugin proxy also matches a route's path with a trailing slash.
		require.Contains(t, paths, SettingsProxyRoot+"/api/items/{id}/")
		require.True(t, IsTrailingSlashCopy(manifest.Versions[0], SettingsProxyRoot+"/api/items/{id}/"))
		require.False(t, IsTrailingSlashCopy(manifest.Versions[0], SettingsProxyRoot+"/api/items/{id}"))
		require.NotContains(t, paths, SettingsProxyRoot+"/api/{path:*}/")
	})

	t.Run("plugin.json routes matched differently are left out", func(t *testing.T) {
		// The plugin proxy never reaches the second route, since the first
		// matches its requests, but ServeMux would choose it as the more specific path.
		manifest, err := NewSettingsManifest(appWithRoutes([]*plugins.Route{
			{Path: "api/*", URL: "https://api"},
			{Path: "api/special", URL: "https://special"},
		}), testMatcher)
		require.ErrorContains(t, err, `GET "api/special" would be forwarded with route "api/special", not route "api/*"`)
		require.Empty(t, settingsPaths(t, manifest))
	})

	t.Run("plugin.json routes that cannot be converted are left out", func(t *testing.T) {
		manifest, err := NewSettingsManifest(appWithRoutes([]*plugins.Route{{Path: "ids/:id([0-9]+)"}}), testMatcher)
		require.Error(t, err)
		require.Empty(t, settingsPaths(t, manifest))
	})

	declaring := func(paths map[string]spec3.PathProps) *app.ManifestData {
		return &app.ManifestData{Group: "example.ext.grafana.app", Versions: []app.ManifestVersion{{
			Name: "v1", Served: true, OpenAPI: app.ManifestVersionOpenAPI{Paths: paths},
		}}}
	}
	proxy := &spec3.Operation{}
	proxy.AddExtension(ExtensionProxy, ProxyTarget{URL: "https://v2"})

	t.Run("a manifest's proxy routes replace plugin.json's", func(t *testing.T) {
		manifest, err := NewSettingsManifest(appWithRoutes(
			[]*plugins.Route{{Path: "api/*", URL: "https://api"}},
			declaring(map[string]spec3.PathProps{SettingsProxyPrefix + "v2/{path:*}": {Get: proxy}, "/other": {Get: proxy}}),
		), testMatcher)
		require.NoError(t, err)
		paths := settingsPaths(t, manifest)
		require.Len(t, paths, 1)
		require.Contains(t, paths, SettingsProxyRoot+"/v2/{path:*}")
	})

	t.Run("a manifest's proxy routes must declare where they forward to", func(t *testing.T) {
		manifest, err := NewSettingsManifest(appWithRoutes(nil, declaring(map[string]spec3.PathProps{
			SettingsProxyPrefix + "v2": {Get: &spec3.Operation{}},
		})), testMatcher)
		require.ErrorContains(t, err, "must declare "+ExtensionProxy)
		require.Empty(t, settingsPaths(t, manifest))
	})
}

func TestLoadSettings(t *testing.T) {
	p := appWithRoutes([]*plugins.Route{{Path: "ids/:id([0-9]+)"}})
	require.Error(t, p.LoadSettings(testMatcher))
	require.NotNil(t, p.Settings, "the settings API is described even without its proxy routes")
}

func TestNewSettingsManifestNeedsAMatcherForPluginJSONRoutes(t *testing.T) {
	manifest, err := NewSettingsManifest(appWithRoutes([]*plugins.Route{{Path: "api/*", URL: "https://api"}}), nil)
	require.ErrorContains(t, err, "route matcher")
	require.Empty(t, settingsPaths(t, manifest), "unchecked routes are left out")
}

// testMatcher stands in for the plugin proxy's matcher, which this module
// cannot import, for the patterns these tests use: literal segments, a :name
// segment, and a final * that matches at least one more segment. The settings
// API's tests check the real one.
func testMatcher(routes []*plugins.Route, method, path string) (*plugins.Route, string, bool) {
	path = strings.TrimSuffix(strings.TrimPrefix(path, "/"), "/")
	got := strings.Split(path, "/")
	for _, route := range routes {
		if route.Method != "" && route.Method != "*" && route.Method != method {
			continue
		}
		want := strings.Split(strings.TrimSuffix(route.Path, "/"), "/")
		for i, segment := range want {
			if segment == "*" && i == len(want)-1 {
				if len(got) > i && path != "" {
					return route, strings.Join(got[i:], "/"), true
				}
				break
			}
			if i >= len(got) || (got[i] != segment && !strings.HasPrefix(segment, ":") && segment != "*") {
				break
			}
			if i == len(want)-1 && len(got) == len(want) {
				return route, "", false
			}
		}
	}
	return nil, "", false
}

func TestProxyProbesCoverEachRoute(t *testing.T) {
	require.ElementsMatch(t, []string{"", "api/v/v", "api/v/v/", "api/v/v/v", "api/v/v/v/v", "api/v"},
		proxyProbes([]*plugins.Route{{Path: "api/:id/*"}}))
}
