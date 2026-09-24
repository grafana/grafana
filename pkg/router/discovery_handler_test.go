package router

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/kube-openapi/pkg/handler3"
)

func discoveryRouter(t *testing.T, group string, handler http.Handler) *GrafanaRouter {
	t.Helper()
	backend := &fakeBackend{
		key: "plugin-revision",
		group: metav1.APIGroup{
			Name:             group,
			Versions:         []metav1.GroupVersionForDiscovery{{GroupVersion: group + "/v1", Version: "v1"}},
			PreferredVersion: metav1.GroupVersionForDiscovery{GroupVersion: group + "/v1", Version: "v1"},
		},
	}
	router := NewGrafanaRouter(stubLoader{})
	router.served[group] = &handlerEntry{
		backend: backend, handler: handler, lastKey: backend.key, breaker: newGroupBreaker(group),
	}
	router.publish()
	return router
}

func TestDiscoveryIncludesFallbackGroups(t *testing.T) {
	const group = "plugin.ext.grafana.app"
	backend := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		require.Equal(t, "/apis", req.URL.Path)
		require.Equal(t, aggregatedDiscoveryJSON, req.Header.Get("Accept"))
		require.Equal(t, "Bearer caller", req.Header.Get("Authorization"))
		require.Empty(t, req.Header.Get("If-None-Match"))
		require.NoError(t, json.NewEncoder(w).Encode(apidiscoveryv2.APIGroupDiscoveryList{
			TypeMeta: metav1.TypeMeta{Kind: "APIGroupDiscoveryList", APIVersion: "apidiscovery.k8s.io/v2"},
			Items: []apidiscoveryv2.APIGroupDiscovery{{
				ObjectMeta: metav1.ObjectMeta{Name: group},
				Versions:   []apidiscoveryv2.APIVersionDiscovery{{Version: "v1", Freshness: apidiscoveryv2.DiscoveryFreshnessCurrent}},
			}},
		}))
	})
	router := discoveryRouter(t, group, backend)
	fallback := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		require.Equal(t, "Bearer caller", req.Header.Get("Authorization"))
		require.Empty(t, req.Header.Get("If-None-Match"))
		if req.Header.Get("Accept") == aggregatedDiscoveryJSON {
			require.NoError(t, json.NewEncoder(w).Encode(apidiscoveryv2.APIGroupDiscoveryList{
				TypeMeta: metav1.TypeMeta{Kind: "APIGroupDiscoveryList", APIVersion: "apidiscovery.k8s.io/v2"},
				Items: []apidiscoveryv2.APIGroupDiscovery{
					{ObjectMeta: metav1.ObjectMeta{Name: "core.grafana.app"}, Versions: []apidiscoveryv2.APIVersionDiscovery{{Version: "v1"}}},
					{ObjectMeta: metav1.ObjectMeta{Name: group}, Versions: []apidiscoveryv2.APIVersionDiscovery{{Version: "v2"}}},
				},
			}))
			return
		}
		require.NoError(t, json.NewEncoder(w).Encode(metav1.APIGroupList{
			TypeMeta: metav1.TypeMeta{Kind: "APIGroupList", APIVersion: "v1"},
			Groups: []metav1.APIGroup{
				{Name: "core.grafana.app", Versions: []metav1.GroupVersionForDiscovery{{GroupVersion: "core.grafana.app/v1", Version: "v1"}}},
				{Name: group, Versions: []metav1.GroupVersionForDiscovery{{GroupVersion: group + "/v2", Version: "v2"}}},
			},
		}))
	})
	for _, accept := range []string{"application/json", aggregatedDiscoveryJSON + ",application/json", "application/vnd.kubernetes.protobuf;g=apidiscovery.k8s.io;v=v2;as=APIGroupDiscoveryList"} {
		t.Run(accept, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/apis/", nil)
			req.Header.Set("Accept", accept)
			req.Header.Set("Authorization", "Bearer caller")
			res := httptest.NewRecorder()
			router.HandleFunc(res, req, fallback)
			require.Equal(t, http.StatusOK, res.Code, res.Body.String())
			require.Equal(t, "Accept", res.Header().Get("Vary"))
			if accept == "application/json" {
				var list metav1.APIGroupList
				require.NoError(t, json.Unmarshal(res.Body.Bytes(), &list))
				require.Len(t, list.Groups, 2)
				require.Equal(t, "core.grafana.app", list.Groups[0].Name)
				require.Equal(t, router.served[group].backend.Group(), list.Groups[1])
			} else {
				var list apidiscoveryv2.APIGroupDiscoveryList
				_, _, err := discoveryCodecs.UniversalDeserializer().Decode(res.Body.Bytes(), nil, &list)
				require.NoError(t, err)
				require.Len(t, list.Items, 2)
				require.Equal(t, "core.grafana.app", list.Items[0].Name)
				require.Equal(t, group, list.Items[1].Name)
				require.Equal(t, []apidiscoveryv2.APIVersionDiscovery{{Version: "v1", Freshness: apidiscoveryv2.DiscoveryFreshnessCurrent}}, list.Items[1].Versions)
			}

			req.Header.Set("If-None-Match", res.Header().Get("ETag"))
			cached := httptest.NewRecorder()
			router.HandleFunc(cached, req, fallback)
			require.Equal(t, http.StatusNotModified, cached.Code)
			require.Empty(t, cached.Body.String())
			require.NotEmpty(t, req.Header.Get("If-None-Match"), "the original request must not be mutated")
		})
	}
}

func TestAggregatedDiscoverySupportsLegacyBackends(t *testing.T) {
	const group = "plugin.ext.grafana.app"
	backend := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if req.URL.Path == "/apis" {
			http.NotFound(w, req)
			return
		}
		require.Equal(t, "/apis/"+group+"/v1", req.URL.Path)
		require.NoError(t, json.NewEncoder(w).Encode(metav1.APIResourceList{
			TypeMeta: metav1.TypeMeta{Kind: "APIResourceList", APIVersion: "v1"}, GroupVersion: group + "/v1",
			APIResources: []metav1.APIResource{
				{Name: "things", Kind: "Thing", Namespaced: true, Verbs: []string{"get", "list"}},
				{Name: "things/status", Kind: "Thing", Namespaced: true, Verbs: []string{"get", "update"}},
			},
		}))
	})
	router := discoveryRouter(t, group, backend)
	broken := discoveryRouter(t, "broken.ext.grafana.app", http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	router.served["broken.ext.grafana.app"] = broken.served["broken.ext.grafana.app"]
	router.publish()
	req := httptest.NewRequest(http.MethodGet, "/apis", nil)
	req.Header.Set("Accept", aggregatedDiscoveryJSON)
	res := httptest.NewRecorder()
	router.HandleFunc(res, req, http.NotFoundHandler())
	require.Equal(t, http.StatusOK, res.Code)
	var list apidiscoveryv2.APIGroupDiscoveryList
	require.NoError(t, json.Unmarshal(res.Body.Bytes(), &list))
	require.Len(t, list.Items, 2)
	versions := map[string]apidiscoveryv2.APIVersionDiscovery{}
	for _, item := range list.Items {
		require.Len(t, item.Versions, 1)
		versions[item.Name] = item.Versions[0]
	}
	require.Equal(t, apidiscoveryv2.DiscoveryFreshnessStale, versions["broken.ext.grafana.app"].Freshness)
	require.Equal(t, apidiscoveryv2.DiscoveryFreshnessCurrent, versions[group].Freshness)
	require.Len(t, versions[group].Resources, 1)
	resource := versions[group].Resources[0]
	require.Equal(t, "things", resource.Resource)
	require.Equal(t, apidiscoveryv2.ScopeNamespace, resource.Scope)
	require.Len(t, resource.Subresources, 1)
	require.Equal(t, "status", resource.Subresources[0].Subresource)
}

func TestOpenAPIIndexIncludesFallbackAndTracksItsChanges(t *testing.T) {
	const group = "plugin.ext.grafana.app"
	router := discoveryRouter(t, group, http.NotFoundHandler())
	revision := "one"
	fallback := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		require.Equal(t, "/openapi/v3", req.URL.Path)
		require.Empty(t, req.Header.Get("If-None-Match"))
		require.Empty(t, req.Header.Get("If-Modified-Since"))
		require.NoError(t, json.NewEncoder(w).Encode(handler3.OpenAPIV3Discovery{
			Paths: map[string]handler3.OpenAPIV3DiscoveryGroupVersion{
				"apis/core.grafana.app/v1": {ServerRelativeURL: "/openapi/v3/apis/core.grafana.app/v1?hash=" + revision},
				"apis/" + group + "/v2":    {ServerRelativeURL: "/openapi/v3/apis/" + group + "/v2?hash=old"},
			},
		}))
	})
	req := httptest.NewRequest(http.MethodGet, "/openapi/v3", nil)
	res := httptest.NewRecorder()
	router.HandleFunc(res, req, fallback)
	require.Equal(t, http.StatusOK, res.Code)
	var index handler3.OpenAPIV3Discovery
	require.NoError(t, json.Unmarshal(res.Body.Bytes(), &index))
	require.Len(t, index.Paths, 2)
	require.Contains(t, index.Paths, "apis/core.grafana.app/v1")
	require.Equal(t, "/openapi/v3/apis/"+group+"/v1?hash=plugin-revision", index.Paths["apis/"+group+"/v1"].ServerRelativeURL)
	req.Header.Set("If-None-Match", res.Header().Get("ETag"))
	req.Header.Set("If-Modified-Since", "Mon, 14 Sep 2026 00:00:00 GMT")
	unchanged := httptest.NewRecorder()
	router.HandleFunc(unchanged, req, fallback)
	require.Equal(t, http.StatusNotModified, unchanged.Code)
	revision = "two"
	changed := httptest.NewRecorder()
	router.HandleFunc(changed, req, fallback)
	require.Equal(t, http.StatusOK, changed.Code)
	require.NotEqual(t, res.Header().Get("ETag"), changed.Header().Get("ETag"))
}
