package appsettings

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/definition"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

const exampleApp = "example-app"

// upstream records the requests the proxy forwards to it.
type upstream struct {
	*httptest.Server
	forwarded []string
}

func newUpstream(t *testing.T) *upstream {
	u := &upstream{}
	u.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u.forwarded = append(u.forwarded, r.Method+" "+r.URL.Path)
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(u.Close)
	return u
}

// proxyServer serves a plugin's settings subresources, as the settings API
// server does once a request is authenticated and authorized.
type proxyServer struct {
	t       *testing.T
	builder *Builder
	handler http.Handler
}

func newProxyServer(t *testing.T, plugin definition.PluginDefinition, openAPIRoutes bool) *proxyServer {
	b, err := NewBuilder(plugin, struct{ PluginClient }{}, settingsContextFunc(
		func(ctx context.Context, _ string, _ *backend.AppInstanceSettings) (context.Context, backend.PluginContext, error) {
			return ctx, backend.PluginContext{}, nil
		}), nil, nil, Options{RegisterProxy: true, OpenAPIProxyRoutes: openAPIRoutes},
		tracing.InitializeTracerForTest(), featuremgmt.WithFeatures())
	require.NoError(t, err)
	b.getter = func(context.Context, schema.GroupVersionResource, string) (runtime.Object, error) {
		return &apppluginV0.Settings{Spec: apppluginV0.SettingsSpec{Enabled: true}}, nil
	}
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) })
	return &proxyServer{t: t, builder: b, handler: b.SubresourceHandler(next)}
}

func (s *proxyServer) serve(user identity.Requester, method, path string) int {
	req := httptest.NewRequest(method, "/apis/"+exampleApp+"/v0alpha1/namespaces/default/app/instance/proxy/"+path, nil)
	ctx := request.WithRequestInfo(req.Context(), &request.RequestInfo{
		IsResourceRequest: true, APIGroup: exampleApp, APIVersion: apppluginV0.VERSION, Namespace: "default",
		Resource: apppluginV0.APP_RESOURCE_NAME, Name: apppluginV0.INSTANCE_NAME, Subresource: "proxy",
	})
	res := httptest.NewRecorder()
	s.handler.ServeHTTP(res, req.WithContext(identity.WithRequester(ctx, user)))
	return res.Code
}

var (
	admin  = &identity.StaticRequester{OrgID: 1, OrgRole: identity.RoleAdmin}
	viewer = &identity.StaticRequester{OrgID: 1, OrgRole: identity.RoleViewer}
)

// exampleRoutes are declared most specific first, as plugins usually do, so
// matching by declaration order and by specificity agree.
func exampleRoutes(url string) []*plugins.Route {
	return []*plugins.Route{
		{Path: "api/admin", Method: http.MethodPost, ReqRole: identity.RoleAdmin, URL: url + "/admin"},
		{Path: "api/items/:id", Method: http.MethodGet, URL: url + "/items"},
		{Path: "api/*", URL: url + "/api"},
		{Path: "health", Method: http.MethodGet, URL: url + "/health"},
	}
}

// pluginWithRoutes is an app as the loaders return it, with its settings
// manifest. Proxy routes the settings manifest leaves out are matched in the
// order plugin.json declares them.
func pluginWithRoutes(routes []*plugins.Route, manifests ...*app.ManifestData) definition.PluginDefinition {
	p := definition.PluginDefinition{
		JSONData:  plugins.JSONData{ID: exampleApp, Type: plugins.TypeApp, Routes: routes},
		Manifests: manifests,
	}
	_ = p.LoadSettings()
	return p
}

// manifestDeclaring is a manifest whose v1 declares paths.
func manifestDeclaring(paths map[string]spec3.PathProps) *app.ManifestData {
	return &app.ManifestData{Group: "example.ext.grafana.app", Versions: []app.ManifestVersion{{
		Name: "v1", Served: true, OpenAPI: app.ManifestVersionOpenAPI{Paths: paths},
	}}}
}

func proxyOperation(target definition.ProxyTarget) *spec3.Operation {
	op := &spec3.Operation{}
	op.AddExtension(definition.ExtensionProxy, target)
	return op
}

func TestPluginJSONRoutesAreServedAsBefore(t *testing.T) {
	up := newUpstream(t)
	plugin := pluginWithRoutes(exampleRoutes(up.URL))
	for _, openAPIRoutes := range []bool{false, true} {
		s := newProxyServer(t, plugin, openAPIRoutes)
		require.Equal(t, openAPIRoutes, s.builder.proxyRoutes() != nil, "the routes compile when enabled")

		up.forwarded = nil
		for _, path := range []string{"api/items/1", "api/items/1/", "api/items/1/more", "api/admin", "health", "health/"} {
			require.Equal(t, http.StatusOK, s.serve(viewer, http.MethodGet, path), "GET %s with openAPIRoutes=%v", path, openAPIRoutes)
		}
		require.Equal(t, http.StatusOK, s.serve(admin, http.MethodPost, "api/admin"))
		require.Equal(t, http.StatusOK, s.serve(viewer, http.MethodDelete, "api/items/1"))
		require.Equal(t, []string{
			"GET /items",
			"GET /items",
			"GET /api/items/1/more",
			"GET /api/admin",
			"GET /health",
			"GET /health",
			"POST /admin",
			"DELETE /api/items/1",
		}, up.forwarded, "openAPIRoutes=%v", openAPIRoutes)

		require.Equal(t, http.StatusForbidden, s.serve(viewer, http.MethodPost, "api/admin"),
			"the route's role is still required")
		require.Equal(t, http.StatusNotFound, s.serve(admin, http.MethodGet, "other"))
		require.Equal(t, http.StatusNotFound, s.serve(admin, http.MethodGet, "api/"))
	}
}

// The one intended difference from the plugin proxy, which gives HEAD to the
// first route that names no method.
func TestOpenAPIRoutesAnswerHeadAsGet(t *testing.T) {
	up := newUpstream(t)
	s := newProxyServer(t, pluginWithRoutes(exampleRoutes(up.URL)), true)
	require.Equal(t, http.StatusOK, s.serve(viewer, http.MethodHead, "api/items/1"))
	require.Equal(t, http.StatusOK, s.serve(viewer, http.MethodHead, "health"))
	require.Equal(t, []string{"HEAD /items", "HEAD /health"}, up.forwarded)
}

func TestRoutesMatchedDifferentlyKeepThePluginProxy(t *testing.T) {
	// The plugin proxy never reaches the second route, since the first matches
	// its requests, but ServeMux would choose it as the more specific path.
	up := newUpstream(t)
	routes := []*plugins.Route{
		{Path: "api/*", URL: up.URL + "/api"},
		{Path: "api/special", URL: up.URL + "/special"},
	}
	s := newProxyServer(t, pluginWithRoutes(routes), true)
	require.Nil(t, s.builder.proxyRoutes())
	require.Equal(t, http.StatusOK, s.serve(viewer, http.MethodGet, "api/special"))
	require.Equal(t, []string{"GET /api/special"}, up.forwarded, "the plugin.json routes are matched as before")
}

func TestManifestDeclaredProxyRoutes(t *testing.T) {
	up := newUpstream(t)
	manifest := manifestDeclaring(map[string]spec3.PathProps{
		definition.SettingsProxyPrefix + "v2/{path:*}": {
			Get:  proxyOperation(definition.ProxyTarget{URL: up.URL + "/v2"}),
			Post: proxyOperation(definition.ProxyTarget{URL: up.URL + "/v2", ReqRole: identity.RoleAdmin}),
		},
		"/other": {Get: &spec3.Operation{}},
	})

	t.Run("replace the plugin.json routes", func(t *testing.T) {
		s := newProxyServer(t, pluginWithRoutes(exampleRoutes(up.URL), manifest), true)
		up.forwarded = nil
		require.Equal(t, http.StatusOK, s.serve(viewer, http.MethodGet, "v2/a/b"))
		require.Equal(t, http.StatusForbidden, s.serve(viewer, http.MethodPost, "v2/a"))
		require.Equal(t, http.StatusNotFound, s.serve(viewer, http.MethodGet, "health"))
		require.Equal(t, []string{"GET /v2/a/b"}, up.forwarded)
	})

	t.Run("mount the proxy without plugin.json routes", func(t *testing.T) {
		s := newProxyServer(t, pluginWithRoutes(nil, manifest), true)
		up.forwarded = nil
		require.Equal(t, http.StatusOK, s.serve(viewer, http.MethodGet, "v2/x"))
		require.Equal(t, []string{"GET /v2/x"}, up.forwarded)
		require.Equal(t, http.StatusMethodNotAllowed, s.serve(admin, http.MethodDelete, "v2/x"),
			"an undeclared method is refused as on any manifest route")
	})

	t.Run("are not served while the flag is off", func(t *testing.T) {
		s := newProxyServer(t, pluginWithRoutes(nil, manifest), false)
		require.Equal(t, http.StatusNoContent, s.serve(viewer, http.MethodGet, "v2/x"), "there is no proxy subresource")
	})

	t.Run("must all declare where they forward to", func(t *testing.T) {
		broken := manifestDeclaring(map[string]spec3.PathProps{
			definition.SettingsProxyPrefix + "v2": {Get: &spec3.Operation{}},
		})
		s := newProxyServer(t, pluginWithRoutes(exampleRoutes(up.URL), broken), true)
		require.Nil(t, s.builder.proxyRoutes(), "the plugin.json routes are matched as before")
		require.Equal(t, http.StatusOK, s.serve(viewer, http.MethodGet, "health"))
	})
}

func TestOpenAPIPublishesProxyRoutes(t *testing.T) {
	const item = "/apis/" + exampleApp + "/v0alpha1/namespaces/{namespace}/app/{name}"
	publish := func(openAPIRoutes bool, plugin definition.PluginDefinition) map[string]*spec3.Path {
		b := &Builder{group: exampleApp, pluginJSON: plugin.JSONData, settings: plugin.Settings,
			opts: Options{RegisterProxy: true, OpenAPIProxyRoutes: openAPIRoutes}}
		oas := &spec3.OpenAPI{
			Paths: &spec3.Paths{Paths: map[string]*spec3.Path{item: {PathProps: spec3.PathProps{
				Parameters: []*spec3.Parameter{
					{ParameterProps: spec3.ParameterProps{Name: "namespace", In: "path", Required: true, Schema: spec.StringProperty()}},
					{ParameterProps: spec3.ParameterProps{Name: "name", In: "path", Required: true, Schema: spec.StringProperty()}},
				},
			}}}},
			Components: &spec3.Components{Schemas: map[string]*spec.Schema{}},
		}
		require.NoError(t, b.addSubresourcePaths(oas, item, apppluginV0.VERSION))
		return oas.Paths.Paths
	}

	paths := publish(true, pluginWithRoutes(exampleRoutes("https://example")))
	require.NotContains(t, paths, item+"/proxy", "the routes replace the opaque proxy path")
	require.NotContains(t, paths, item+"/proxy/health/", "the trailing slash copies are not published")
	items := paths[item+"/proxy/api/items/{id}"]
	require.NotNil(t, items)
	require.NotNil(t, items.Get)
	require.Nil(t, items.Post)
	require.Equal(t, []string{"Settings"}, items.Get.Tags)
	require.Len(t, items.Parameters, 2, "the settings path parameters are documented")
	require.Contains(t, paths, item+"/proxy/api/{path}", "a catch-all is published as an ordinary parameter")
	for path, p := range paths {
		for _, op := range []*spec3.Operation{p.Get, p.Head, p.Post, p.Put, p.Patch, p.Delete, p.Options} {
			if op != nil {
				require.NotContains(t, op.Extensions, definition.ExtensionProxy, "%s publishes where it forwards to", path)
			}
		}
	}

	require.Contains(t, publish(false, pluginWithRoutes(exampleRoutes("https://example"))), item+"/proxy")
	require.Contains(t, publish(true, pluginWithRoutes([]*plugins.Route{{Path: "ids/:id([0-9]+)"}})), item+"/proxy",
		"routes that cannot be served as OpenAPI routes keep the opaque proxy path")

	declared := publish(true, pluginWithRoutes(nil, manifestDeclaring(map[string]spec3.PathProps{
		definition.SettingsProxyPrefix + "v2/{path:*}": {Get: proxyOperation(definition.ProxyTarget{URL: "https://example"})},
	})))
	require.Contains(t, declared, item+"/proxy/v2/{path}")
}
