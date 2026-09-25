package router

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestSingleTenantBreakersIsolateGroupsOnSameHost(t *testing.T) {
	for _, registered := range []bool{false, true} {
		for _, status := range []int{http.StatusBadGateway, http.StatusServiceUnavailable, http.StatusGatewayTimeout} {
			t.Run(fmt.Sprintf("registered=%t/status=%d", registered, status), func(t *testing.T) {
				st := newTestSingleTenantFallback(t)
				st.resolveHost = func(context.Context, int64) (singleTenantStack, error) {
					return singleTenantStack{URL: "https://tenant.example.com"}, nil
				}
				calls := map[string]int{}
				st.transport = testFallbackTransport(func(req *http.Request) (*http.Response, error) {
					require.Equal(t, "tenant.example.com", req.URL.Host)
					group := GroupFromPath(req.URL.Path)
					calls[group]++
					code := http.StatusNoContent
					if group == "broken" {
						code = status
					}
					return &http.Response{StatusCode: code, Header: make(http.Header), Body: http.NoBody}, nil
				})
				var backends []Backend
				if registered {
					for _, group := range []string{"broken", "healthy"} {
						backends = append(backends, &fallbackBackend{group: metav1.APIGroup{Name: group}, key: group, st: st})
					}
				}
				router := NewGrafanaRouter(staticLoader{backends: backends})
				router.unregisteredGroupHandler = st
				require.NoError(t, router.reconcile(t.Context()))
				request := func(group, version string) int {
					recorder := httptest.NewRecorder()
					path := "/apis/" + group + "/" + version + "/namespaces/stacks-123/widgets"
					router.HandleFunc(recorder, httptest.NewRequest(http.MethodGet, path, nil), http.NotFoundHandler())
					return recorder.Code
				}
				for range 6 {
					require.Equal(t, status, request("broken", "v1"))
				}
				require.Equal(t, http.StatusServiceUnavailable, request("broken", "v1"))
				require.Equal(t, http.StatusServiceUnavailable, request("broken", "v2"))
				require.Equal(t, 6, calls["broken"])
				require.Equal(t, http.StatusNoContent, request("healthy", "v1"))
				require.Equal(t, 1, calls["healthy"])
				require.Equal(t, http.StatusServiceUnavailable, request("broken", "v1"))
				require.Equal(t, 6, calls["broken"])
			})
		}
	}
}

func TestSingleTenantDiscoveryBreakerIsSeparateOnSameHost(t *testing.T) {
	st := newTestSingleTenantFallback(t)
	st.discoveryHost = testFallbackURL(t, "https://tenant.example.com")
	st.resolveHost = func(context.Context, int64) (singleTenantStack, error) {
		return singleTenantStack{URL: st.discoveryHost.String()}, nil
	}
	discoveryCalls := 0
	tenantCalls := 0
	st.transport = testFallbackTransport(func(req *http.Request) (*http.Response, error) {
		code := http.StatusNoContent
		if req.URL.Path == "/apis" {
			discoveryCalls++
			code = http.StatusBadGateway
		} else {
			tenantCalls++
		}
		return &http.Response{StatusCode: code, Header: make(http.Header), Body: http.NoBody}, nil
	})
	request := func(path string) int {
		recorder := httptest.NewRecorder()
		st.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path, nil))
		return recorder.Code
	}
	for range 6 {
		require.Equal(t, http.StatusBadGateway, request("/apis"))
	}
	require.Equal(t, http.StatusServiceUnavailable, request("/apis"))
	require.Equal(t, http.StatusNoContent, request("/apis/%3Cdisco%3E/v1/namespaces/stacks-123/widgets"))
	require.Equal(t, 6, discoveryCalls)
	require.Equal(t, 1, tenantCalls)
}

func TestSingleTenantBreakersIsolateDestinations(t *testing.T) {
	for _, discoveryPath := range []string{"/apis/example/v1", "/openapi/v3/apis/example/v1", "/apis"} {
		t.Run(discoveryPath, func(t *testing.T) {
			st := newTestSingleTenantFallback(t)
			st.discoveryHost = testFallbackURL(t, "https://discovery.example.com")
			st.resolveHost = func(_ context.Context, stackID int64) (singleTenantStack, error) {
				if stackID == 1 {
					return singleTenantStack{URL: "https://first.example.com"}, nil
				}
				return singleTenantStack{URL: "https://second.example.com"}, nil
			}
			discoveryFailed := false
			tenantFailed := false
			st.transport = testFallbackTransport(func(req *http.Request) (*http.Response, error) {
				if req.URL.Host == "discovery.example.com" {
					if discoveryFailed {
						return nil, errors.New("discovery unavailable")
					}
					return &http.Response{StatusCode: http.StatusOK, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(`{"groups":[{"name":"example","versions":[{"version":"v1","groupVersion":"example/v1"}]}]}`))}, nil
				}
				if tenantFailed && req.URL.Host == "first.example.com" {
					return nil, errors.New("tenant unavailable")
				}
				return &http.Response{StatusCode: http.StatusNoContent, Header: make(http.Header), Body: http.NoBody}, nil
			})
			router := NewGrafanaRouter(st)
			pollDiscovery(t, st)
			require.NoError(t, router.reconcile(t.Context()))
			discoveryFailed = true
			request := func(path string) int {
				recorder := httptest.NewRecorder()
				req := httptest.NewRequest(http.MethodGet, path, nil)
				if path == "/apis" {
					req.Header.Set("Accept", aggregatedDiscoveryJSON)
				}
				router.HandleFunc(recorder, req, http.NotFoundHandler())
				return recorder.Code
			}
			for range 8 {
				request(discoveryPath)
			}
			require.Equal(t, http.StatusNoContent, request("/apis/example/v1/namespaces/stacks-1/widgets"))
			tenantFailed = true
			for range 6 {
				require.Equal(t, http.StatusBadGateway, request("/apis/example/v1/namespaces/stacks-1/widgets"))
			}
			require.Equal(t, http.StatusServiceUnavailable, request("/apis/example/v1/namespaces/stacks-1/widgets"))
			require.Equal(t, http.StatusNoContent, request("/apis/example/v1/namespaces/stacks-2/widgets"))
		})
	}
}
