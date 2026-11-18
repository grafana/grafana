package appplugin

import (
	"context"
	"encoding/json"
	"maps"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/util/testutil"
)

const (
	settingsRoot = "/apis/" + testAppID + "/v0alpha1/"
	proxyRoot    = settingsRoot + "namespaces/" + apis.DefaultNamespace + "/app/" + instanceName + "/proxy/"
)

// proxyUpstream records what the app proxy forwards to it.
type proxyUpstream struct {
	*httptest.Server
	mu        sync.Mutex
	forwarded []string
}

func newProxyUpstream(t *testing.T) *proxyUpstream {
	t.Helper()
	u := &proxyUpstream{}
	u.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u.mu.Lock()
		defer u.mu.Unlock()
		u.forwarded = append(u.forwarded, strings.TrimSpace(r.Method+" "+r.URL.Path+" "+r.Header.Get("X-Upstream")))
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(u.Close)
	return u
}

func (u *proxyUpstream) take() []string {
	u.mu.Lock()
	defer u.mu.Unlock()
	forwarded := u.forwarded
	u.forwarded = nil
	return forwarded
}

// enableTestApp writes the settings the proxy's route templates read.
func enableTestApp(t *testing.T, helper *apis.K8sTestHelper) {
	t.Helper()
	client := helper.GetResourceClient(apis.ResourceClientArgs{User: helper.Org1.Admin, GVR: gvrSettings})
	_, err := client.Resource.Update(context.Background(), &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": testAppID + "/v0alpha1",
		"kind":       "Settings",
		"metadata":   map[string]any{"name": instanceName},
		"spec": map[string]any{
			"enabled":  true,
			"jsonData": map[string]any{"upstream": "from-settings"},
		},
	}}, metav1.UpdateOptions{})
	require.NoError(t, err)
}

func proxyRequest(t *testing.T, helper *apis.K8sTestHelper, user apis.User, method, path string) int {
	t.Helper()
	rsp := apis.DoRequest(helper, apis.RequestParams{User: user, Method: method, Path: proxyRoot + path}, &map[string]any{})
	return rsp.Response.StatusCode
}

// settingsPaths lists the paths the settings API's OpenAPI document describes.
func settingsPaths(t *testing.T, helper *apis.K8sTestHelper) []string {
	t.Helper()
	return openAPIPaths(t, helper, testAppID+"/v0alpha1")
}

// openAPIPaths lists the paths a group version's OpenAPI document describes.
// Where a proxy route forwards to names upstream hosts and secure settings, so
// no document may publish it.
func openAPIPaths(t *testing.T, helper *apis.K8sTestHelper, groupVersion string) []string {
	t.Helper()
	raw, err := helper.NewDiscoveryClient().RESTClient().Get().AbsPath("/openapi/v3/apis/" + groupVersion).DoRaw(context.Background())
	require.NoError(t, err)
	require.NotContains(t, string(raw), "x-grafana-proxy", "the %s OpenAPI document publishes where proxy routes forward to", groupVersion)
	var doc struct {
		Paths map[string]json.RawMessage `json:"paths"`
	}
	require.NoError(t, json.Unmarshal(raw, &doc))
	return slices.Sorted(maps.Keys(doc.Paths))
}

// plugin.json routes are converted into the settings manifest at load, and
// served from it at the URL they have always been served at.
func TestIntegrationAppPluginProxy(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	upstream := newProxyUpstream(t)
	routes := []map[string]any{
		{"path": "api/admin", "method": http.MethodPost, "reqRole": "Admin", "url": upstream.URL + "/admin"},
		{"path": "api/items/:id", "method": http.MethodGet, "url": upstream.URL + "/items"},
		{"path": "api/*", "url": upstream.URL + "/api",
			"headers": []map[string]any{{"name": "X-Upstream", "content": "{{.JsonData.upstream}}"}}},
	}
	helper := setupHelperWithPlugin(t, rest.Mode5, testAppSetup{routes: routes}, featuremgmt.FlagApppluginsHandleProxyRequests)
	enableTestApp(t, helper)
	viewer, admin := helper.Org1.Viewer, helper.Org1.Admin

	require.Equal(t, http.StatusOK, proxyRequest(t, helper, viewer, http.MethodGet, "api/items/1"))
	require.Equal(t, http.StatusOK, proxyRequest(t, helper, viewer, http.MethodGet, "api/items/1/more"))
	require.Equal(t, http.StatusOK, proxyRequest(t, helper, viewer, http.MethodDelete, "api/items/1"))
	require.Equal(t, http.StatusOK, proxyRequest(t, helper, admin, http.MethodPost, "api/admin"))
	require.Equal(t, []string{
		"GET /items",
		"GET /api/items/1/more from-settings",
		"DELETE /api/items/1 from-settings",
		"POST /admin",
	}, upstream.take(), "each request is forwarded with its route, and the route's templates read the settings")

	require.Equal(t, http.StatusForbidden, proxyRequest(t, helper, viewer, http.MethodPost, "api/admin"),
		"the matched route's role is still required")
	require.Equal(t, http.StatusNotFound, proxyRequest(t, helper, viewer, http.MethodGet, "elsewhere"))
	require.Empty(t, upstream.take())

	paths := settingsPaths(t, helper)
	require.Contains(t, paths, settingsRoot+"namespaces/{namespace}/app/instance/proxy/api/items/{id}")
	require.NotContains(t, paths, settingsRoot+"namespaces/{namespace}/app/instance/proxy")
}

// A manifest declares proxy routes in its OpenAPI paths below
// app/instance/proxy. The settings API serves them, at the URL plugin.json
// routes are served at, and they replace the plugin.json routes.
func TestIntegrationAppPluginProxyRoutesFromManifest(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	upstream := newProxyUpstream(t)
	manifest, err := json.Marshal(map[string]any{
		"apiVersion": "apps.grafana.app/v1alpha2",
		"kind":       "AppManifest",
		"metadata":   map[string]any{"name": "test-app-with-sdk-manifest"},
		"spec": map[string]any{
			"appName": "test-app-with-sdk-manifest",
			"group":   testAppGroup,
			"versions": []map[string]any{{
				"name": "v1",
				"routes": map[string]any{"namespaced": map[string]any{
					"/app/instance/proxy/v2/{path:*}": map[string]any{
						"get": map[string]any{
							"x-grafana-proxy": map[string]any{
								"url":     upstream.URL + "/v2",
								"headers": []map[string]any{{"name": "X-Upstream", "content": "{{.JsonData.upstream}}"}},
							},
							"responses": map[string]any{"200": map[string]any{"description": "OK"}},
						},
					},
				}},
			}},
		},
	})
	require.NoError(t, err)

	helper := setupHelperWithPlugin(t, rest.Mode5, testAppSetup{
		manifest: manifest,
		routes:   []map[string]any{{"path": "api/*", "url": upstream.URL + "/api"}},
	}, featuremgmt.FlagApppluginsHandleProxyRequests)
	enableTestApp(t, helper)
	viewer := helper.Org1.Viewer

	require.Equal(t, http.StatusOK, proxyRequest(t, helper, viewer, http.MethodGet, "v2/a/b"))
	require.Equal(t, []string{"GET /v2/a/b from-settings"}, upstream.take())

	require.Equal(t, http.StatusNotFound, proxyRequest(t, helper, viewer, http.MethodGet, "api/x"),
		"the manifest's routes replace the plugin.json routes")
	require.Equal(t, http.StatusMethodNotAllowed, proxyRequest(t, helper, viewer, http.MethodPost, "v2/a"),
		"an undeclared method is refused as on any manifest route")
	require.Empty(t, upstream.take())

	require.Contains(t, settingsPaths(t, helper), settingsRoot+"namespaces/{namespace}/app/instance/proxy/v2/{path}")

	// The manifest's own API leaves the proxy routes to the settings API, and
	// its OpenAPI document does not describe them.
	for _, path := range openAPIPaths(t, helper, testAppGroup+"/v1") {
		require.NotContains(t, path, "/proxy/")
	}
	rsp := apis.DoRequest(helper, apis.RequestParams{
		User: viewer,
		Path: "/apis/" + testAppGroup + "/v1/namespaces/" + apis.DefaultNamespace + "/app/instance/proxy/v2/a",
	}, &map[string]any{})
	require.Equal(t, http.StatusNotFound, rsp.Response.StatusCode)
	require.Empty(t, upstream.take())
}
