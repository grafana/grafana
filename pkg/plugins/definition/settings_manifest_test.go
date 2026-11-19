package definition

import (
	"maps"
	"net/http"
	"slices"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana/pkg/plugins"
)

// appWithRoutes is an app loaded with routes and manifests, where, as the
// loader does, the manifest of the plugin ID's group is the settings manifest.
func appWithRoutes(routes []*plugins.Route, manifests ...*app.ManifestData) PluginDefinition {
	p := PluginDefinition{JSONData: plugins.JSONData{ID: "example-app", Type: plugins.TypeApp, Routes: routes}}
	for _, m := range manifests {
		if m.Group == p.JSONData.ID {
			p.Settings = m
		} else {
			p.Manifests = append(p.Manifests, m)
		}
	}
	return p
}

func settingsPaths(t *testing.T, manifest *app.ManifestData) map[string]spec3.PathProps {
	t.Helper()
	require.NotNil(t, manifest)
	require.Equal(t, "example-app", manifest.Group, "the settings API is served under the plugin ID")
	require.Len(t, manifest.Versions, 1)
	version := manifest.Versions[0]
	require.Equal(t, "v0alpha1", version.Name)
	require.True(t, version.Served)
	require.Len(t, version.Kinds, 1)
	kind := version.Kinds[0]
	require.Equal(t, "Settings", kind.Kind)
	require.Equal(t, SettingsAPIResource, kind.Resource)
	require.NotNil(t, kind.FolderScoped)
	require.False(t, *kind.FolderScoped, "settings are not in a folder")
	require.False(t, kind.HasSearchEndpoint())
	require.False(t, kind.HasTrashEndpoint())
	require.Equal(t, []string{SettingsAPIInstance}, kind.FixedNames)
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
			{Path: "/rooted", Method: http.MethodGet, URL: "https://rooted"},
		}), testMatcher)
		require.NoError(t, err)
		paths := settingsPaths(t, manifest)
		require.Contains(t, paths, SettingsProxyRoot+"/api/items/{id}")
		require.Contains(t, paths, SettingsProxyRoot+"/api/{path:*}")
		require.Contains(t, paths, SettingsProxyRoot+"/rooted", "the plugin proxy ignores a leading slash")

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

	foundation := func(paths map[string]spec3.PathProps, versions ...app.ManifestVersion) *app.ManifestData {
		return &app.ManifestData{AppName: "example", Group: "example-app", Versions: append([]app.ManifestVersion{{
			Name: "v0alpha1", Served: true, OpenAPI: app.ManifestVersionOpenAPI{Paths: paths},
		}}, versions...)}
	}
	proxy := &spec3.Operation{}
	proxy.AddExtension(ExtensionProxy, ProxyTarget{URL: "https://v2"})
	resource := &spec3.Operation{OperationProps: spec3.OperationProps{Description: "list things"}}

	t.Run("the manifest of the plugin ID's group is the foundation", func(t *testing.T) {
		manifest, err := NewSettingsManifest(appWithRoutes(
			[]*plugins.Route{{Path: "api/*", URL: "https://api"}},
			&app.ManifestData{Group: "example.ext.grafana.app", Versions: []app.ManifestVersion{{
				Name: "v1", Served: true, OpenAPI: app.ManifestVersionOpenAPI{Paths: map[string]spec3.PathProps{"/other": {Get: proxy}}},
			}}},
			foundation(map[string]spec3.PathProps{
				"/namespaces/{namespace}/app/instance/proxy/v2/{path:*}": {Get: proxy},
				SettingsResourcesRoot + "/things":                        {Get: resource},
			}),
		), testMatcher)
		require.NoError(t, err)
		require.Equal(t, "example", manifest.AppName)
		paths := settingsPaths(t, manifest)
		require.Len(t, paths, 2, "the manifest's proxy routes replace plugin.json's")
		require.Contains(t, paths, SettingsProxyRoot+"/v2/{path:*}", "the instance is named as on any settings path")
		require.Same(t, resource, paths[SettingsResourcesRoot+"/things"].Get)
	})

	t.Run("the components its routes refer to are kept", func(t *testing.T) {
		components := app.ManifestVersionOpenAPIComponents{Schemas: map[string]spec.Schema{"Thing": *spec.StringProperty()}}
		base := foundation(map[string]spec3.PathProps{SettingsResourcesRoot + "/things": {Get: resource}})
		base.Versions[0].OpenAPI.Components = components
		manifest, err := NewSettingsManifest(appWithRoutes(nil, base), testMatcher)
		require.NoError(t, err)
		require.Equal(t, components, manifest.Versions[0].OpenAPI.Components)
	})

	t.Run("plugin.json routes are used when the foundation declares no proxy routes", func(t *testing.T) {
		manifest, err := NewSettingsManifest(appWithRoutes(
			[]*plugins.Route{{Path: "api/*", URL: "https://api"}},
			foundation(map[string]spec3.PathProps{SettingsResourcesRoot + "/things": {Get: resource}}),
		), testMatcher)
		require.NoError(t, err)
		paths := settingsPaths(t, manifest)
		require.Contains(t, paths, SettingsResourcesRoot+"/things")
		require.Contains(t, paths, SettingsProxyRoot+"/api/{path:*}")
	})

	t.Run("what the settings API does not serve is left out", func(t *testing.T) {
		manifest, err := NewSettingsManifest(appWithRoutes(nil, foundation(map[string]spec3.PathProps{
			"/namespaces/{namespace}/other":    {Get: resource},
			SettingsResourcesRoot + "/proxied": {Get: proxy},
			SettingsResourcesRoot + "/things":  {Get: resource},
		}, app.ManifestVersion{Name: "v1", Served: true})), testMatcher)
		require.ErrorContains(t, err, "/namespaces/{namespace}/other is not served")
		require.ErrorContains(t, err, "version v1 is not served")
		require.ErrorContains(t, err, ExtensionProxy+" is only served below the proxy subresource")
		paths := settingsPaths(t, manifest)
		require.ElementsMatch(t, []string{SettingsResourcesRoot + "/proxied", SettingsResourcesRoot + "/things"}, slices.Collect(maps.Keys(paths)))
		require.NotContains(t, paths[SettingsResourcesRoot+"/proxied"].Get.Extensions, ExtensionProxy)
	})

	t.Run("a manifest's proxy routes must declare where they forward to", func(t *testing.T) {
		manifest, err := NewSettingsManifest(appWithRoutes(nil, foundation(map[string]spec3.PathProps{
			SettingsProxyRoot + "/v2":         {Get: &spec3.Operation{}},
			SettingsResourcesRoot + "/things": {Get: resource},
		})), testMatcher)
		require.ErrorContains(t, err, "must declare "+ExtensionProxy)
		require.Equal(t, []string{SettingsResourcesRoot + "/things"}, slices.Collect(maps.Keys(settingsPaths(t, manifest))),
			"the resource routes are kept")
	})
}

func TestLoadSettings(t *testing.T) {
	p := appWithRoutes([]*plugins.Route{{Path: "ids/:id([0-9]+)"}})
	require.Error(t, p.LoadSettings(testMatcher))
	require.NotNil(t, p.Settings, "the settings API is described even without its proxy routes")

	// The loader sets the manifest the settings manifest is founded on.
	resource := &spec3.Operation{}
	p = appWithRoutes(nil)
	p.Settings = &app.ManifestData{AppName: "example", Group: "example-app", Versions: []app.ManifestVersion{{
		Name: "v0alpha1", Served: true, OpenAPI: app.ManifestVersionOpenAPI{Paths: map[string]spec3.PathProps{
			"/namespaces/{namespace}/app/instance/resources/things": {Get: resource},
		}},
	}}}
	require.NoError(t, p.LoadSettings(testMatcher))
	require.Equal(t, "example", p.Settings.AppName)
	require.Same(t, resource, settingsPaths(t, p.Settings)[SettingsResourcesRoot+"/things"].Get)
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
		want := strings.Split(strings.TrimSuffix(strings.TrimPrefix(route.Path, "/"), "/"), "/")
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
