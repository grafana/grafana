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

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/app"
	manifestroutes "github.com/grafana/grafana-app-sdk/routes"
	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/api/pluginproxy"
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

func newProxyServer(t *testing.T, plugin definition.PluginDefinition) *proxyServer {
	b, err := NewBuilder(plugin, struct{ PluginClient }{}, settingsContextFunc(
		func(ctx context.Context, _ string, _ *backend.AppInstanceSettings) (context.Context, backend.PluginContext, error) {
			return ctx, backend.PluginContext{}, nil
		}), nil, nil, Options{RegisterProxy: true},
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
	admin  = &identity.StaticRequester{OrgID: 1, OrgRole: authlib.RoleAdmin}
	viewer = &identity.StaticRequester{OrgID: 1, OrgRole: authlib.RoleViewer}
)

// exampleRoutes are declared most specific first, as plugins usually do, so
// matching by declaration order and by specificity agree.
func exampleRoutes(url string) []*plugins.Route {
	return []*plugins.Route{
		{Path: "api/admin", Method: http.MethodPost, ReqRole: authlib.RoleAdmin, URL: url + "/admin"},
		{Path: "api/items/:id", Method: http.MethodGet, URL: url + "/items"},
		{Path: "api/*", URL: url + "/api"},
		{Path: "health", Method: http.MethodGet, URL: url + "/health"},
	}
}

// pluginWithRoutes is an app as the loaders return it, with its settings
// manifest. Proxy routes the settings manifest leaves out are matched in the
// order plugin.json declares them.
func pluginWithRoutes(routes []*plugins.Route, manifests ...*app.ManifestData) definition.PluginDefinition {
	p := definition.PluginDefinition{JSONData: plugins.JSONData{ID: exampleApp, Type: plugins.TypeApp, Routes: routes}}
	for _, m := range manifests {
		if m.Group == exampleApp { // as the loader does
			p.Settings = m
		} else {
			p.Manifests = append(p.Manifests, m)
		}
	}
	_ = p.LoadSettings(pluginproxy.MatchRoute)
	return p
}

// manifestDeclaring is the app manifest the settings manifest is founded on.
func manifestDeclaring(paths map[string]spec3.PathProps) *app.ManifestData {
	return &app.ManifestData{Group: exampleApp, Versions: []app.ManifestVersion{{
		Name: apppluginV0.VERSION, Served: true, OpenAPI: app.ManifestVersionOpenAPI{Paths: paths},
	}}}
}

// The settings object as an app manifest names it in its paths.
const (
	declaredProxy     = "/namespaces/{namespace}/app/instance/proxy/"
	declaredResources = "/namespaces/{namespace}/app/instance/resources/"
)

func proxyOperation(target manifestroutes.ProxyTarget) *spec3.Operation {
	op := &spec3.Operation{}
	op.AddExtension(manifestroutes.ExtensionProxy, target)
	return op
}

// plugin.json routes are served from the settings manifest they are
// converted into, forwarded as the plugin proxy forwards them.
func TestPluginJSONRoutesAreServedAsBefore(t *testing.T) {
	up := newUpstream(t)
	s := newProxyServer(t, pluginWithRoutes(exampleRoutes(up.URL)))
	require.NotNil(t, s.builder.proxyRoutes())

	for _, path := range []string{"api/items/1", "api/items/1/", "api/items/1/more", "api/admin", "health", "health/"} {
		require.Equal(t, http.StatusOK, s.serve(viewer, http.MethodGet, path), "GET %s", path)
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
	}, up.forwarded)

	require.Equal(t, http.StatusForbidden, s.serve(viewer, http.MethodPost, "api/admin"),
		"the route's role is still required")
	require.Equal(t, http.StatusNotFound, s.serve(admin, http.MethodGet, "other"))
	require.Equal(t, http.StatusNotFound, s.serve(admin, http.MethodGet, "api/"))
}

// The one intended difference from the plugin proxy, which gives HEAD to the
// first route that names no method.
func TestOpenAPIRoutesAnswerHeadAsGet(t *testing.T) {
	up := newUpstream(t)
	s := newProxyServer(t, pluginWithRoutes(exampleRoutes(up.URL)))
	require.Equal(t, http.StatusOK, s.serve(viewer, http.MethodHead, "api/items/1"))
	require.Equal(t, http.StatusOK, s.serve(viewer, http.MethodHead, "health"))
	require.Equal(t, []string{"HEAD /items", "HEAD /health"}, up.forwarded)
}

// The proxy serves only the routes the settings manifest declares, so a
// plugin whose plugin.json routes are left out of it has no proxy.
func TestRoutesLeftOutOfTheSettingsManifestAreNotServed(t *testing.T) {
	up := newUpstream(t)
	for name, routes := range map[string][]*plugins.Route{
		// The plugin proxy never reaches the second route, since the first matches
		// its requests, but ServeMux would choose it as the more specific path.
		"matched differently": {
			{Path: "api/*", URL: up.URL + "/api"},
			{Path: "api/special", URL: up.URL + "/special"},
		},
		"cannot be converted": {{Path: "ids/:id([0-9]+)", URL: up.URL}},
	} {
		s := newProxyServer(t, pluginWithRoutes(routes))
		require.Nil(t, s.builder.proxyRoutes(), name)
		require.Equal(t, http.StatusNoContent, s.serve(viewer, http.MethodGet, "api/special"), "%s: there is no proxy subresource", name)
	}
	require.Empty(t, up.forwarded)
}

func TestManifestDeclaredProxyRoutes(t *testing.T) {
	up := newUpstream(t)
	manifest := manifestDeclaring(map[string]spec3.PathProps{
		declaredProxy + "v2/{path:*}": {
			Get:  proxyOperation(manifestroutes.ProxyTarget{URL: up.URL + "/v2"}),
			Post: proxyOperation(manifestroutes.ProxyTarget{URL: up.URL + "/v2", ReqRole: authlib.RoleAdmin}),
		},
		declaredResources + "things": {Get: &spec3.Operation{}},
	})

	t.Run("replace the plugin.json routes", func(t *testing.T) {
		s := newProxyServer(t, pluginWithRoutes(exampleRoutes(up.URL), manifest))
		up.forwarded = nil
		require.Equal(t, http.StatusOK, s.serve(viewer, http.MethodGet, "v2/a/b"))
		require.Equal(t, http.StatusForbidden, s.serve(viewer, http.MethodPost, "v2/a"))
		require.Equal(t, http.StatusNotFound, s.serve(viewer, http.MethodGet, "health"))
		require.Equal(t, []string{"GET /v2/a/b"}, up.forwarded)
	})

	t.Run("mount the proxy without plugin.json routes", func(t *testing.T) {
		s := newProxyServer(t, pluginWithRoutes(nil, manifest))
		up.forwarded = nil
		require.Equal(t, http.StatusOK, s.serve(viewer, http.MethodGet, "v2/x"))
		require.Equal(t, []string{"GET /v2/x"}, up.forwarded)
		require.Equal(t, http.StatusMethodNotAllowed, s.serve(admin, http.MethodDelete, "v2/x"),
			"an undeclared method is refused as on any manifest route")
	})

	t.Run("match the rest of the path with a last {path}, as app-sdk does", func(t *testing.T) {
		s := newProxyServer(t, pluginWithRoutes(nil, manifestDeclaring(map[string]spec3.PathProps{
			declaredProxy + "files/{path}": {Get: proxyOperation(manifestroutes.ProxyTarget{URL: up.URL + "/files"})},
		})))
		up.forwarded = nil
		require.Equal(t, http.StatusOK, s.serve(viewer, http.MethodGet, "files/a/b"))
		require.Equal(t, []string{"GET /files/a/b"}, up.forwarded)
	})

	t.Run("must all declare where they forward to", func(t *testing.T) {
		broken := manifestDeclaring(map[string]spec3.PathProps{
			declaredProxy + "v2": {Get: &spec3.Operation{}},
		})
		s := newProxyServer(t, pluginWithRoutes(exampleRoutes(up.URL), broken))
		require.Nil(t, s.builder.proxyRoutes())
		require.Equal(t, http.StatusNoContent, s.serve(viewer, http.MethodGet, "health"),
			"there is no proxy subresource, and plugin.json's routes are not used instead")
	})
}

func TestOpenAPIPublishesProxyRoutes(t *testing.T) {
	const item = "/apis/" + exampleApp + "/v0alpha1/namespaces/{namespace}/app/{name}"
	publish := func(plugin definition.PluginDefinition) map[string]*spec3.Path {
		b := &Builder{group: exampleApp, pluginJSON: plugin.JSONData, settings: plugin.Settings,
			opts: Options{RegisterProxy: true}}
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

	paths := publish(pluginWithRoutes(exampleRoutes("https://example")))
	require.NotContains(t, paths, item+"/proxy", "the routes replace the opaque proxy path")
	require.NotContains(t, paths, item+"/proxy/health/", "the trailing slash copies are not published")
	items := paths[item+"/proxy/api/items/{id}"]
	require.NotNil(t, items)
	require.NotNil(t, items.Get)
	require.Nil(t, items.Post)
	require.Equal(t, []string{"Settings"}, items.Get.Tags)
	require.Len(t, items.Parameters, 2, "the settings path parameters are documented")
	require.Contains(t, paths, item+"/proxy/api/{path}", "a catch-all is published as an ordinary parameter")
	require.Equal(t, "proxyGetApiItemsId", items.Get.OperationId, "an unnamed operation is named by its route")
	require.Equal(t, "proxyDeleteApiPath", paths[item+"/proxy/api/{path}"].Delete.OperationId)
	for path, p := range paths {
		for _, op := range []*spec3.Operation{p.Get, p.Head, p.Post, p.Put, p.Patch, p.Delete, p.Options} {
			if op != nil {
				require.NotContains(t, op.Extensions, manifestroutes.ExtensionProxy, "%s publishes where it forwards to", path)
			}
		}
	}

	for path := range publish(pluginWithRoutes([]*plugins.Route{{Path: "ids/:id([0-9]+)"}})) {
		require.NotContains(t, path, "/proxy", "a plugin with no proxy routes publishes no proxy")
	}

	declared := publish(pluginWithRoutes(nil, manifestDeclaring(map[string]spec3.PathProps{
		declaredProxy + "v2/{path:*}": {Get: proxyOperation(manifestroutes.ProxyTarget{URL: "https://example"})},
	})))
	require.Contains(t, declared, item+"/proxy/v2/{path}")
}

func TestSubresourceOperationID(t *testing.T) {
	require.Equal(t, "proxyPostFleetManagementApiSetK8sInstrumentation",
		subresourceOperationID(http.MethodPost, "proxy", "/fleet-management-api/set-k8s-instrumentation"))
	require.Equal(t, "resourcesGetThingsIdPath", subresourceOperationID(http.MethodGet, "resources", "things/{id}/{path:*}"))
}

func TestOpenAPIPublishesResourceRoutes(t *testing.T) {
	const item = "/apis/" + exampleApp + "/v0alpha1/namespaces/{namespace}/app/{name}"
	b := &Builder{group: exampleApp}
	newSpec := func() *spec3.OpenAPI {
		return &spec3.OpenAPI{
			Paths: &spec3.Paths{Paths: map[string]*spec3.Path{item: {PathProps: spec3.PathProps{
				Parameters: []*spec3.Parameter{
					{ParameterProps: spec3.ParameterProps{Name: "namespace", In: "path", Required: true, Schema: spec.StringProperty()}},
					{ParameterProps: spec3.ParameterProps{Name: "name", In: "path", Required: true, Schema: spec.StringProperty()}},
				},
			}}}},
			Components: &spec3.Components{Schemas: map[string]*spec.Schema{}},
		}
	}

	oas := newSpec()
	require.NoError(t, b.addSubresourcePaths(oas, item, apppluginV0.VERSION))
	require.Contains(t, oas.Paths.Paths, item+"/resources", "without declared routes, the opaque resources path is published")

	plugin := pluginWithRoutes(nil, manifestDeclaring(map[string]spec3.PathProps{
		declaredResources + "things/{id}": {Get: &spec3.Operation{OperationProps: spec3.OperationProps{OperationId: "getThing"}}},
	}))
	b = &Builder{group: exampleApp, pluginJSON: plugin.JSONData, settings: plugin.Settings}
	oas = newSpec()
	require.NoError(t, b.addSubresourcePaths(oas, item, apppluginV0.VERSION))
	require.NotContains(t, oas.Paths.Paths, item+"/resources", "the routes replace the opaque resources path")
	thing := oas.Paths.Paths[item+"/resources/things/{id}"]
	require.NotNil(t, thing)
	require.Equal(t, "getThing", thing.Get.OperationId)
	require.Equal(t, []string{"Settings"}, thing.Get.Tags)
	require.Len(t, thing.Parameters, 3, "the settings path parameters are documented with the route's own")
}

func TestOpenAPIPublishesSettingsManifestComponents(t *testing.T) {
	const item = "/apis/" + exampleApp + "/v0alpha1/namespaces/{namespace}/app/{name}"
	base := manifestDeclaring(map[string]spec3.PathProps{
		declaredResources + "things": {Get: &spec3.Operation{OperationProps: spec3.OperationProps{
			Responses: &spec3.Responses{ResponsesProps: spec3.ResponsesProps{StatusCodeResponses: map[int]*spec3.Response{
				http.StatusOK: {Refable: spec.Refable{Ref: spec.MustCreateRef("#/components/responses/Things")}},
			}}},
		}}},
	})
	things := &spec3.Response{ResponseProps: spec3.ResponseProps{Description: "things"}}
	base.Versions[0].OpenAPI.Components = app.ManifestVersionOpenAPIComponents{
		Schemas:   map[string]spec.Schema{"Thing": *spec.StringProperty(), "Settings": *spec.StringProperty()},
		Responses: map[string]*spec3.Response{"Things": things},
	}
	plugin := pluginWithRoutes(nil, base)
	b := &Builder{group: exampleApp, pluginJSON: plugin.JSONData, settings: plugin.Settings}

	generated := &spec.Schema{SchemaProps: spec.SchemaProps{Type: []string{"object"}}}
	oas := &spec3.OpenAPI{
		Paths: &spec3.Paths{Paths: map[string]*spec3.Path{item: {PathProps: spec3.PathProps{
			Parameters: []*spec3.Parameter{
				{ParameterProps: spec3.ParameterProps{Name: "namespace", In: "path", Required: true, Schema: spec.StringProperty()}},
				{ParameterProps: spec3.ParameterProps{Name: "name", In: "path", Required: true, Schema: spec.StringProperty()}},
			},
		}}}},
		Components: &spec3.Components{Schemas: map[string]*spec.Schema{"Settings": generated}},
	}
	require.NoError(t, b.addSubresourcePaths(oas, item, apppluginV0.VERSION))
	require.Contains(t, oas.Paths.Paths, item+"/resources/things")
	require.Contains(t, oas.Components.Schemas, "Thing")
	require.Same(t, things, oas.Components.Responses["Things"], "the route's reference resolves")
	require.Same(t, generated, oas.Components.Schemas["Settings"], "a generated component is not replaced")
}

// A route declared with a trailing slash is published with it, so it does not
// replace a route declared without one.
func TestOpenAPIKeepsDeclaredTrailingSlashes(t *testing.T) {
	const item = "/apis/" + exampleApp + "/v0alpha1/namespaces/{namespace}/app/{name}"
	get := &spec3.Operation{OperationProps: spec3.OperationProps{Responses: &spec3.Responses{}}}
	base := manifestDeclaring(map[string]spec3.PathProps{
		declaredResources + "things/": {Get: get},
		declaredResources + "things":  {Post: get},
	})
	plugin := pluginWithRoutes(nil, base)
	b := &Builder{group: exampleApp, pluginJSON: plugin.JSONData, settings: plugin.Settings}
	oas := &spec3.OpenAPI{
		Paths:      &spec3.Paths{Paths: map[string]*spec3.Path{item: {}}},
		Components: &spec3.Components{Schemas: map[string]*spec.Schema{}},
	}

	require.NoError(t, b.addSubresourcePaths(oas, item, apppluginV0.VERSION))
	require.NotNil(t, oas.Paths.Paths[item+"/resources/things/"].Get)
	require.NotNil(t, oas.Paths.Paths[item+"/resources/things"].Post)
}

// The definition module cannot import the settings API's types, so it repeats
// their names.
func TestSettingsManifestNamesMatchTheSettingsAPI(t *testing.T) {
	require.Equal(t, apppluginV0.VERSION, definition.SettingsAPIVersion)
	require.Equal(t, apppluginV0.APP_RESOURCE_NAME, definition.SettingsAPIResource)
	require.Equal(t, apppluginV0.INSTANCE_NAME, definition.SettingsAPIInstance)
}
