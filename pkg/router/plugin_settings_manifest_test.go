package router

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-app-sdk/app"
	appmanifestv1alpha2 "github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha2"
	appclientv3 "github.com/grafana/grafana-app-sdk/plugin/client/v3"
	"github.com/grafana/grafana-app-sdk/routes"
	manifestroutes "github.com/grafana/grafana-app-sdk/routes"
	"github.com/grafana/grafana/pkg/api/pluginproxy"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/definition"
)

// The published settings manifest can replace the plugin.json routes it was
// converted from: a plugin that declares it, and no routes, serves the same
// proxy routes.
func TestPublishedSettingsManifestReplacesPluginJSONRoutes(t *testing.T) {
	client := func(context.Context, string) (plugins.Client, appclientv3.Client, error) { return nil, nil, nil }
	legacy := definition.PluginDefinition{JSONData: plugins.JSONData{ID: "example-app", Type: plugins.TypeApp, Routes: []*plugins.Route{
		{Path: "/api/items", Method: http.MethodGet, URL: "https://{{.JsonData.host}}/items", ReqRole: authlib.RoleEditor},
		{Path: "/api/items/*", Method: http.MethodDelete, URL: "https://{{.JsonData.host}}/items", ReqAction: "example-app.items:write"},
		{
			Path:      "token",
			Method:    http.MethodPost,
			URL:       "https://login.example.com",
			Headers:   []routes.ProxyHeader{{Name: "Authorization", Content: "Bearer {{.SecureJsonData.token}}"}},
			URLParams: []routes.ProxyURLParam{{Name: "key", Content: "{{.SecureJsonData.key}}"}},
			TokenAuth: &routes.ProxyTokenAuth{URL: "https://login.example.com/{{.JsonData.tenant}}", Scopes: []string{"a"}},
			Body:      json.RawMessage(`{"grant_type": "client_credentials"}`),
		},
	}}}
	require.NoError(t, legacy.LoadSettings(pluginproxy.MatchRoute))

	backend, err := newPluginSettingsBackend(legacy, client, PluginDependencies{})
	require.NoError(t, err)
	published, ok := backend.Manifest()
	require.True(t, ok)
	body, err := appManifestJSON(published)
	require.NoError(t, err)
	require.Contains(t, string(body), manifestroutes.ExtensionProxy, "the proxy routes are published with where they forward to")

	var decoded appmanifestv1alpha2.AppManifest
	require.NoError(t, json.Unmarshal(body, &decoded))
	data, err := decoded.Spec.ToManifestData()
	require.NoError(t, err)
	migrated := definition.PluginDefinition{JSONData: plugins.JSONData{ID: "example-app", Type: plugins.TypeApp}, Settings: &data}
	require.NoError(t, migrated.LoadSettings(pluginproxy.MatchRoute))

	require.Equal(t, proxyRoutesOf(t, legacy.Settings), proxyRoutesOf(t, migrated.Settings))
}

// proxyRoutesOf returns the plugin route each method of each proxy path
// forwards with.
func proxyRoutesOf(t *testing.T, manifest *app.ManifestData) map[string]*plugins.Route {
	t.Helper()
	require.NotNil(t, manifest)
	out := map[string]*plugins.Route{}
	for path, props := range manifest.Versions[0].OpenAPI.Paths {
		specPath, ok := strings.CutPrefix(path, definition.SettingsProxyRoot)
		if !ok {
			continue
		}
		for method, op := range manifestroutes.Operations(&props) {
			route, ok, err := definition.ProxyRouteFromOperation(specPath, method, op)
			require.NoError(t, err)
			require.True(t, ok, "%s %s", method, path)
			if route.Body != nil {
				// Encoding the manifest compacts the body template.
				var v any
				require.NoError(t, json.Unmarshal(route.Body, &v))
				route.Body, _ = json.Marshal(v)
			}
			if route.TokenAuth != nil && len(route.TokenAuth.Params) == 0 {
				route.TokenAuth.Params = nil // decoded as an empty map, which is the same
			}
			out[method+" "+specPath] = route
		}
	}
	require.NotEmpty(t, out)
	return out
}
