package router

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
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
