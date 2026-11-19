package router

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"sync"
	"testing"
	"testing/synctest"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/stretchr/testify/require"
	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/kube-openapi/pkg/handler3"
)

func TestSingleTenantDiscoveryRefreshesWithoutOtherSources(t *testing.T) {
	for _, useCloud := range []bool{false, true} {
		name := "direct loader"
		if useCloud {
			name = "cloud loader"
		}
		t.Run(name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				ctx, cancel := context.WithCancel(t.Context())
				defer cancel()
				st := newTestSingleTenantFallback(t)
				st.discoveryHost = testFallbackURL(t, "https://discovery.example.com")
				var mu sync.Mutex
				fail := true
				body := `{"groups":[{"name":"first"}]}`
				calls := 0
				st.transport = testFallbackTransport(func(*http.Request) (*http.Response, error) {
					mu.Lock()
					defer mu.Unlock()
					calls++
					if fail {
						return nil, errors.New("discovery unavailable")
					}
					return &http.Response{StatusCode: http.StatusOK, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(body))}, nil
				})
				var loader RoutesLoader = fallbackLoader{st}
				if useCloud {
					cloud, err := newCloudLoader(nil, nil, st)
					require.NoError(t, err)
					require.NoError(t, services.StartAndAwaitRunning(ctx, cloud))
					defer func() { require.NoError(t, services.StopAndAwaitTerminated(context.Background(), cloud)) }()
					loader = cloud
				}
				router := NewGrafanaRouter(loader, nil)
				require.NoError(t, router.Run(ctx))
				synctest.Wait()
				require.Error(t, router.Ready(ctx))
				mu.Lock()
				require.Equal(t, 1, calls)
				mu.Unlock()
				refresh := func() {
					time.Sleep(singleTenantDiscoveryInterval)
					synctest.Wait()
				}
				mu.Lock()
				fail = false
				mu.Unlock()
				refresh()
				require.NoError(t, router.Ready(ctx))
				require.True(t, router.KnownGroup("first"))
				mu.Lock()
				body = `{"groups":[{"name":"second"}]}`
				mu.Unlock()
				refresh()
				require.False(t, router.KnownGroup("first"))
				require.True(t, router.KnownGroup("second"))
				mu.Lock()
				fail = true
				mu.Unlock()
				refresh()
				require.True(t, router.KnownGroup("second"))
				mu.Lock()
				fail = false
				mu.Unlock()
				mu.Lock()
				body = `{"groups":[]}`
				mu.Unlock()
				refresh()
				require.False(t, router.KnownGroup("second"))
				// 0s (fail), 5s, 10m5s, then seven failed polls backing off from
				// 20m5s to 25m20s, and the recovery at 30m20s.
				mu.Lock()
				require.Equal(t, 11, calls)
				mu.Unlock()
			})
		})
	}
}

func TestSingleTenantDiscoveryDoesNotHandleResources(t *testing.T) {
	st := newTestSingleTenantFallback(t)
	st.discoveryHost = testFallbackURL(t, "https://discovery.example.com")
	st.transport = testFallbackTransport(func(*http.Request) (*http.Response, error) {
		t.Error("request must not reach discovery host")
		return nil, errors.New("unexpected forwarding")
	})
	for _, path := range []string{
		"/apis/example/v1/widgets",
		"/apis/example/v1/namespaces",
		"/apis/example/v1/namespaces/",
		"/apis//v1/widgets",
		"/apis/example//namespaces/stacks-1/widgets",
		"/openapi/v3/apis/example/v1/extra",
		"/openapi/unknown",
		"/healthz",
	} {
		t.Run(path, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			st.ServeHTTP(recorder, newAuthenticatedRequest(http.MethodGet, path, nil))
			require.Equal(t, http.StatusNotFound, recorder.Code)
		})
	}
	for _, method := range []string{http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete} {
		for _, path := range []string{"/apis", "/apis/example/v1", "/openapi/v3/apis/example/v1"} {
			recorder := httptest.NewRecorder()
			st.ServeHTTP(recorder, newAuthenticatedRequest(method, path, nil))
			require.Equal(t, http.StatusNotFound, recorder.Code)
		}
	}
}

func TestSingleTenantDiscoveryNotificationsCoalesceAndStop(t *testing.T) {
	for _, configured := range []bool{false, true} {
		synctest.Test(t, func(t *testing.T) {
			st := newTestSingleTenantFallback(t)
			var mu sync.Mutex
			body := `{"groups":[{"name":"first"}]}`
			calls := 0
			if configured {
				st.discoveryHost = testFallbackURL(t, "https://discovery.example.com")
				st.transport = testFallbackTransport(func(*http.Request) (*http.Response, error) {
					mu.Lock()
					defer mu.Unlock()
					calls++
					return &http.Response{StatusCode: http.StatusOK, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(body))}, nil
				})
			}
			ctx, cancel := context.WithCancel(t.Context())
			defer cancel()
			dirty, err := fallbackLoader{st}.Notify(ctx)
			require.NoError(t, err)
			synctest.Wait()
			// The first poll always wakes the router, even when it finds nothing.
			require.Len(t, dirty, 1)
			<-dirty

			// Unchanged discovery polls on schedule but never wakes the router.
			time.Sleep(3 * singleTenantDiscoveryInterval)
			synctest.Wait()
			require.Empty(t, dirty)

			if configured {
				mu.Lock()
				require.Equal(t, 4, calls)
				body = `{"groups":[{"name":"second"}]}`
				mu.Unlock()
				time.Sleep(singleTenantDiscoveryInterval)
				synctest.Wait()
				require.Len(t, dirty, 1)
			}

			cancel()
			synctest.Wait()
			for range dirty {
			}
			_, open := <-dirty
			require.False(t, open)
		})
	}
}

func TestSingleTenantDiscoveryIsScopedToTheCallersStack(t *testing.T) {
	groupVersion := func(group string) []metav1.GroupVersionForDiscovery {
		return []metav1.GroupVersionForDiscovery{{GroupVersion: group + "/v1", Version: "v1"}}
	}
	// Each host advertises its groups, and serves each group's OpenAPI
	// document as its own host name.
	hosts := map[string][]string{
		"discovery.example.com": {"default.grafana.app"},
		"stack.example.com":     {"stack.grafana.app", "mt.grafana.app"},
	}
	var mu sync.Mutex
	var calls []string
	st := newTestSingleTenantFallback(t)
	st.discoveryHost = testFallbackURL(t, "https://discovery.example.com")
	st.resolveHost = func(_ context.Context, stackID int64) (singleTenantStack, error) {
		if stackID == 123 {
			return singleTenantStack{URL: "https://stack.example.com"}, nil
		}
		return singleTenantStack{}, nil
	}
	st.transport = testFallbackTransport(func(req *http.Request) (*http.Response, error) {
		mu.Lock()
		calls = append(calls, req.URL.Host+req.URL.Path)
		mu.Unlock()
		groups := hosts[req.URL.Host]
		header := http.Header{"Content-Type": {"application/json"}}
		var body any
		switch {
		case req.URL.Path == apisPrefix && strings.Contains(req.Header.Get("Accept"), "apidiscovery.k8s.io"):
			header.Set("Content-Type", aggregatedDiscoveryJSON)
			list := apidiscoveryv2.APIGroupDiscoveryList{TypeMeta: metav1.TypeMeta{Kind: "APIGroupDiscoveryList", APIVersion: "apidiscovery.k8s.io/v2"}}
			for _, g := range groups {
				list.Items = append(list.Items, apidiscoveryv2.APIGroupDiscovery{
					ObjectMeta: metav1.ObjectMeta{Name: g},
					Versions:   []apidiscoveryv2.APIVersionDiscovery{{Version: "v1", Freshness: apidiscoveryv2.DiscoveryFreshnessCurrent}},
				})
			}
			body = list
		case req.URL.Path == apisPrefix:
			list := metav1.APIGroupList{TypeMeta: metav1.TypeMeta{Kind: "APIGroupList", APIVersion: "v1"}}
			for _, g := range groups {
				list.Groups = append(list.Groups, metav1.APIGroup{Name: g, Versions: groupVersion(g)})
			}
			body = list
		case req.URL.Path == openapiV3Prefix:
			index := handler3.OpenAPIV3Discovery{Paths: map[string]handler3.OpenAPIV3DiscoveryGroupVersion{}}
			for _, g := range groups {
				index.Paths["apis/"+g+"/v1"] = handler3.OpenAPIV3DiscoveryGroupVersion{ServerRelativeURL: "/openapi/v3/apis/" + g + "/v1?hash=" + req.URL.Host}
			}
			body = index
		default:
			body = req.URL.Host
		}
		data, err := json.Marshal(body)
		require.NoError(t, err)
		return &http.Response{StatusCode: http.StatusOK, Header: header, Body: io.NopCloser(strings.NewReader(string(data)))}, nil
	})

	router := NewGrafanaRouter(fallbackLoader{st}, nil)
	router.unregisteredGroupHandler = st
	pollDiscovery(t, st)
	require.NoError(t, router.reconcile(t.Context()))
	// A multi-tenant group always wins over the stack's own copy.
	mt := &fakeBackend{key: "mt", group: metav1.APIGroup{Name: "mt.grafana.app", Versions: []metav1.GroupVersionForDiscovery{{GroupVersion: "mt.grafana.app/v2", Version: "v2"}}}}
	router.served[mt.group.Name] = &handlerEntry{backend: mt, handler: http.NotFoundHandler(), lastKey: mt.key, breaker: newGroupBreaker(mt.group.Name)}
	router.publish(t.Context())

	serve := func(namespace, path, accept string) *httptest.ResponseRecorder {
		mu.Lock()
		calls = nil
		mu.Unlock()
		req := requestWithNamespace(http.MethodGet, path, namespace)
		if accept != "" {
			req.Header.Set("Accept", accept)
		}
		res := httptest.NewRecorder()
		router.HandleFunc(res, req)
		require.Equal(t, http.StatusOK, res.Code, res.Body.String())
		if isRootDiscoveryPath(path) {
			require.Equal(t, "private", res.Header().Get("Cache-Control"))
		}
		return res
	}
	groupList := func(namespace string) []string {
		var list metav1.APIGroupList
		require.NoError(t, json.Unmarshal(serve(namespace, apisPrefix, "application/json").Body.Bytes(), &list))
		names := make([]string, 0, len(list.Groups))
		for _, g := range list.Groups {
			names = append(names, g.Name)
			if g.Name == "mt.grafana.app" {
				require.Equal(t, "v2", g.Versions[0].Version)
			}
		}
		return names
	}
	aggregated := func(namespace string) []string {
		var list apidiscoveryv2.APIGroupDiscoveryList
		require.NoError(t, json.Unmarshal(serve(namespace, apisPrefix, aggregatedDiscoveryJSON).Body.Bytes(), &list))
		names := make([]string, 0, len(list.Items))
		for _, g := range list.Items {
			names = append(names, g.Name)
		}
		slices.Sort(names)
		return names
	}
	openAPIIndex := func(namespace string) []string {
		var index handler3.OpenAPIV3Discovery
		require.NoError(t, json.Unmarshal(serve(namespace, openapiV3Prefix, "").Body.Bytes(), &index))
		paths := make([]string, 0, len(index.Paths))
		for path := range index.Paths {
			paths = append(paths, path)
		}
		slices.Sort(paths)
		return paths
	}

	for _, namespace := range []string{"*", "default", "stacks-404"} {
		t.Run(namespace, func(t *testing.T) {
			// discovery is the router's own group, so it is always listed.
			require.Equal(t, []string{"default.grafana.app", "discovery", "mt.grafana.app"}, groupList(namespace))
			require.Equal(t, []string{"default.grafana.app", "discovery", "mt.grafana.app"}, aggregated(namespace))
			require.Equal(t, []string{"apis/default.grafana.app/v1", "apis/discovery/v1alpha2", "apis/mt.grafana.app/v2"}, openAPIIndex(namespace))
			require.Empty(t, calls, "the defaults come from the discovery poll")
		})
	}
	t.Run("stacks-123", func(t *testing.T) {
		require.Equal(t, []string{"discovery", "mt.grafana.app", "stack.grafana.app"}, groupList("stacks-123"))
		require.Equal(t, []string{"discovery", "mt.grafana.app", "stack.grafana.app"}, aggregated("stacks-123"))
		require.Equal(t, []string{"apis/discovery/v1alpha2", "apis/mt.grafana.app/v2", "apis/stack.grafana.app/v1"}, openAPIIndex("stacks-123"))
	})

	t.Run("OpenAPI documents are not shared across callers", func(t *testing.T) {
		const path = "/openapi/v3/apis/default.grafana.app/v1"
		for _, tc := range []struct{ namespace, host string }{
			{"*", "discovery.example.com"},
			{"*", "discovery.example.com"},
			{"stacks-123", "stack.example.com"},
		} {
			res := serve(tc.namespace, path, "")
			require.JSONEq(t, `"`+tc.host+`"`, res.Body.String())
			require.Equal(t, []string{tc.host + path}, calls)
		}
	})
}

func TestCallerScopedGroupsStayAdvertisedWithoutFallback(t *testing.T) {
	st := &fallbackBackend{
		group: metav1.APIGroup{Name: "st.grafana.app", Versions: []metav1.GroupVersionForDiscovery{{GroupVersion: "st.grafana.app/v1", Version: "v1"}}},
		discovery: &apidiscoveryv2.APIGroupDiscovery{
			ObjectMeta: metav1.ObjectMeta{Name: "st.grafana.app"},
			Versions:   []apidiscoveryv2.APIVersionDiscovery{{Version: "v1", Freshness: apidiscoveryv2.DiscoveryFreshnessCurrent}},
		},
		key: "st:1",
		st:  http.NotFoundHandler(),
	}
	router := NewGrafanaRouter(stubLoader{}, nil)
	router.served[st.group.Name] = &handlerEntry{backend: st, handler: http.NotFoundHandler(), lastKey: st.key, breaker: newGroupBreaker(st.group.Name)}
	router.publish(t.Context())

	// Without an unregistered-group handler, nothing answers for the caller,
	// so the defaults stay advertised.
	serve := func(path, accept string) string {
		req := requestWithNamespace(http.MethodGet, path, "stacks-123")
		if accept != "" {
			req.Header.Set("Accept", accept)
		}
		res := httptest.NewRecorder()
		router.HandleFunc(res, req)
		require.Equal(t, http.StatusOK, res.Code, res.Body.String())
		return res.Body.String()
	}
	require.Contains(t, serve(apisPrefix, "application/json"), "st.grafana.app")
	require.Contains(t, serve(apisPrefix, aggregatedDiscoveryJSON), "st.grafana.app")
	require.Contains(t, serve(openapiV3Prefix, ""), "apis/st.grafana.app/v1")
}

func TestSingleTenantDiscoveryFromLegacyOnlyStack(t *testing.T) {
	st := newTestSingleTenantFallback(t)
	st.discoveryHost = testFallbackURL(t, "https://discovery.example.com")
	st.resolveHost = func(context.Context, int64) (singleTenantStack, error) {
		return singleTenantStack{URL: "https://legacy.example.com"}, nil
	}
	st.transport = testFallbackTransport(func(req *http.Request) (*http.Response, error) {
		group := "default.grafana.app"
		if req.URL.Host == "legacy.example.com" {
			// An older stack ignores the aggregated discovery Accept header.
			group = "legacy.grafana.app"
		}
		body, err := json.Marshal(metav1.APIGroupList{
			TypeMeta: metav1.TypeMeta{Kind: "APIGroupList", APIVersion: "v1"},
			Groups:   []metav1.APIGroup{{Name: group, Versions: []metav1.GroupVersionForDiscovery{{GroupVersion: group + "/v1", Version: "v1"}}}},
		})
		require.NoError(t, err)
		return &http.Response{StatusCode: http.StatusOK, Header: http.Header{"Content-Type": {"application/json"}}, Body: io.NopCloser(strings.NewReader(string(body)))}, nil
	})
	router := NewGrafanaRouter(fallbackLoader{st}, nil)
	router.unregisteredGroupHandler = st
	pollDiscovery(t, st)
	require.NoError(t, router.reconcile(t.Context()))

	serve := func(accept string) *httptest.ResponseRecorder {
		req := requestWithNamespace(http.MethodGet, apisPrefix, "stacks-123")
		req.Header.Set("Accept", accept)
		res := httptest.NewRecorder()
		router.HandleFunc(res, req)
		return res
	}

	// client-go offers plain JSON as a fallback, and reads legacy discovery from it.
	res := serve(aggregatedDiscoveryJSON + ",application/json")
	require.Equal(t, http.StatusOK, res.Code, res.Body.String())
	require.Equal(t, "application/json", res.Header().Get("Content-Type"))
	require.Equal(t, "private", res.Header().Get("Cache-Control"))
	var list metav1.APIGroupList
	require.NoError(t, json.Unmarshal(res.Body.Bytes(), &list))
	require.Equal(t, "APIGroupList", list.Kind)
	names := make([]string, 0, len(list.Groups))
	for _, g := range list.Groups {
		names = append(names, g.Name)
	}
	// discovery is the router's own group, so it is always listed.
	require.Equal(t, []string{"discovery", "legacy.grafana.app"}, names, "never the defaults from the discovery host")

	require.Equal(t, http.StatusNotAcceptable, serve(aggregatedDiscoveryJSON).Code)
}
