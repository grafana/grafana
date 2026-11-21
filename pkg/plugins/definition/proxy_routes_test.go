package definition

import (
	"encoding/json"
	"maps"
	"net/http"
	"reflect"
	"slices"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana-app-sdk/routes"
	manifestroutes "github.com/grafana/grafana-app-sdk/routes"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/plugins"
)

func methodsOf(props spec3.PathProps) []string {
	var methods []string
	for _, m := range proxyMethods {
		if *operationFor(&props, m) != nil {
			methods = append(methods, m)
		}
	}
	return methods
}

func TestProxyRoutesToOpenAPIPaths(t *testing.T) {
	paths, err := ProxyRoutesToOpenAPI([]*plugins.Route{
		{Path: "api/admin", Method: http.MethodPost},
		{Path: "api/*"},
		{Path: "items/:id/", Method: http.MethodGet},
		{Path: "a/*/b", Method: "*"},
		{Path: "orgs/:name/users/:path", Method: http.MethodDelete},
		{Path: "/rooted/*", Method: http.MethodGet},
	})
	require.NoError(t, err)

	require.ElementsMatch(t, []string{
		"/api/admin",
		"/api/{path:*}",
		"/items/{id}",
		"/a/{segment_1}/b",
		"/orgs/{name_}/users/{path_}",
		"/rooted/{path:*}",
	}, slices.Collect(maps.Keys(paths)), "one leading slash is dropped, as the plugin proxy does")

	require.Equal(t, []string{http.MethodPost}, methodsOf(paths["/api/admin"]))
	require.Equal(t, anyMethods, methodsOf(paths["/api/{path:*}"]), "a route without a method serves every method, and HEAD through GET")
	require.Equal(t, anyMethods, methodsOf(paths["/a/{segment_1}/b"]))
	require.Equal(t, []string{http.MethodGet}, methodsOf(paths["/items/{id}"]))

	params := paths["/orgs/{name_}/users/{path_}"].Delete.Parameters
	names := make([]string, 0, len(params))
	for _, p := range params {
		require.Equal(t, "path", p.In)
		require.True(t, p.Required)
		names = append(names, p.Name)
	}
	require.Equal(t, []string{"name_", "path_"}, names, "every path parameter is documented")
}

func TestProxyRoutesToOpenAPIKeepsTheFirstRouteForARequest(t *testing.T) {
	first := &plugins.Route{Path: "api/:id", Method: http.MethodGet, URL: "https://first"}
	paths, err := ProxyRoutesToOpenAPI([]*plugins.Route{
		first,
		{Path: "api/:other", URL: "https://second"},
	})
	require.NoError(t, err)
	require.Len(t, paths, 1, "paths that differ only in parameter names are one path")

	props := paths["/api/{id}"]
	get, _, err := ProxyRouteFromOperation("/api/{id}", http.MethodGet, props.Get)
	require.NoError(t, err)
	require.Equal(t, "https://first", get.URL, "the second route never received GET requests")

	post, _, err := ProxyRouteFromOperation("/api/{id}", http.MethodPost, props.Post)
	require.NoError(t, err)
	require.Equal(t, "https://second", post.URL)
}

func TestProxyRoutesToOpenAPIRefusesWhatItCannotConvert(t *testing.T) {
	for _, route := range []*plugins.Route{
		{Path: ""},
		{Path: "/"},
		{Path: "//api"},
		{Path: "a//b"},
		{Path: "ids/:id([0-9]+)"},
		{Path: "ids/:id:int"},
		{Path: "ids/:int"},
		{Path: "files/*.*"},
		{Path: "a/?optional"},
		{Path: "a/b:c"},
		{Path: "a/{x}"},
		{Path: "a/../b"},
		{Path: "a", Method: "get"},
		{Path: "a", Method: http.MethodTrace},
	} {
		t.Run(route.Path+" "+route.Method, func(t *testing.T) {
			paths, err := ProxyRoutesToOpenAPI([]*plugins.Route{{Path: "fine"}, route})
			require.Error(t, err)
			require.Nil(t, paths, "a plugin is converted completely or not at all")
		})
	}
}

func fullRoute() *plugins.Route {
	return &plugins.Route{
		Path:      "api/*",
		Method:    http.MethodPost,
		ReqRole:   identity.RoleEditor,
		ReqAction: "example-app.api:write",
		URL:       "https://{{.JsonData.host}}/v1",
		URLParams: []plugins.URLParam{{Name: "key", Content: "{{.SecureJsonData.key}}"}},
		Headers:   []plugins.Header{{Name: "X-Token", Content: "{{.SecureJsonData.token}}"}},
		AuthType:  "azure",
		TokenAuth: &plugins.JWTTokenAuth{
			Url:    "https://login.example.com/{{.JsonData.tenant}}",
			Scopes: []string{"a", "b"},
			Params: map[string]string{"client_secret": "{{.SecureJsonData.secret}}"},
		},
		JwtTokenAuth: &plugins.JWTTokenAuth{Url: "https://oauth2.example.com", Scopes: []string{"c"}},
		Body:         json.RawMessage(`{ "grant_type": "client_credentials",  "id": "{{.JsonData.id}}" }`),
	}
}

func TestProxyRouteFromOperationRoundTrips(t *testing.T) {
	route := fullRoute()
	paths, err := ProxyRoutesToOpenAPI([]*plugins.Route{route})
	require.NoError(t, err)
	props := paths["/api/{path:*}"]

	got, ok, err := ProxyRouteFromOperation("/api/{path:*}", http.MethodPost, props.Post)
	require.NoError(t, err)
	require.True(t, ok)
	require.Equal(t, route, got, "the converted route is the declared one, body byte for byte")
}

func TestProxyRouteFromOperationReadsJSON(t *testing.T) {
	route := fullRoute()
	// What JSON can represent: a compact body.
	route.Body = json.RawMessage(`{"grant_type":"client_credentials","id":"{{.JsonData.id}}"}`)
	paths, err := ProxyRoutesToOpenAPI([]*plugins.Route{route})
	require.NoError(t, err)

	// As a manifest declaring the route itself would be read.
	raw, err := json.Marshal(paths)
	require.NoError(t, err)
	var decoded map[string]spec3.PathProps
	require.NoError(t, json.Unmarshal(raw, &decoded))
	require.IsType(t, map[string]any{}, decoded["/api/{path:*}"].Post.Extensions[routes.ExtensionProxy])

	got, ok, err := ProxyRouteFromOperation("/api/{path:*}", http.MethodPost, decoded["/api/{path:*}"].Post)
	require.NoError(t, err)
	require.True(t, ok)
	require.Equal(t, route, got)
}

func TestProxyRouteFromOperation(t *testing.T) {
	t.Run("a route can still name HEAD", func(t *testing.T) {
		paths, err := ProxyRoutesToOpenAPI([]*plugins.Route{{Path: "a", Method: http.MethodHead}})
		require.NoError(t, err)
		require.Equal(t, []string{http.MethodHead}, methodsOf(paths["/a"]))
	})

	t.Run("an operation without the extension is not a proxy route", func(t *testing.T) {
		_, ok, err := ProxyRouteFromOperation("/a", http.MethodGet, &spec3.Operation{})
		require.NoError(t, err)
		require.False(t, ok)
	})

	t.Run("a malformed extension is an error", func(t *testing.T) {
		op := &spec3.Operation{}
		op.AddExtension(manifestroutes.ExtensionProxy, map[string]any{"headers": "not a list"})
		_, ok, err := ProxyRouteFromOperation("/a", http.MethodGet, op)
		require.Error(t, err)
		require.True(t, ok)
	})

	t.Run("paths are rebuilt in the plugin proxy's syntax", func(t *testing.T) {
		op := &spec3.Operation{}
		op.AddExtension(manifestroutes.ExtensionProxy, routes.ProxyTarget{URL: "https://x"})
		for specPath, want := range map[string]string{
			"/a/{id}/b/{rest:*}": "a/:p1/b/*",
			"/a/{rest...}":       "a/*",
			"/static":            "static",
		} {
			got, _, err := ProxyRouteFromOperation(specPath, http.MethodGet, op)
			require.NoError(t, err)
			require.Equal(t, want, got.Path)
		}
		_, _, err := ProxyRouteFromOperation("/{rest:*}/a", http.MethodGet, op)
		require.Error(t, err)
	})
}

// A field added to plugins.Route must be carried by ProxyTarget, or converted
// routes would silently drop it.
func TestProxyTargetCarriesEveryRouteField(t *testing.T) {
	target := reflect.TypeOf(routes.ProxyTarget{})
	route := reflect.TypeOf(plugins.Route{})
	for i := range route.NumField() {
		f := route.Field(i)
		if f.Name == "Path" || f.Name == "Method" {
			continue
		}
		_, ok := target.FieldByName(f.Name)
		require.True(t, ok, "ProxyTarget is missing %s", f.Name)
	}
	require.Equal(t, route.NumField()-2, target.NumField())
}

func TestWithoutProxyExtension(t *testing.T) {
	paths, err := ProxyRoutesToOpenAPI([]*plugins.Route{{Path: "api", Method: http.MethodGet}})
	require.NoError(t, err)
	props := paths["/api"]
	props.Get.AddExtension("x-other", true)

	published := WithoutProxyExtension(props)
	require.NotContains(t, published.Get.Extensions, routes.ExtensionProxy)
	require.Equal(t, true, published.Get.Extensions["x-other"])
	require.Contains(t, props.Get.Extensions, routes.ExtensionProxy, "the served operation keeps it")
}
