package router

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// The multi-tenant router, asked by a stack to skip stacks, answers with only
// the groups it serves: the single-tenant defaults and the stack are not read.
func TestRouterTargetSkipsSingleTenantDiscoveryWhenAsked(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{"st_discovery_url": "https://discovery.example.com"})
	cfg.Target = []string{"router"}
	cfg.ExtJWTAuth.JWKSUrl = "https://jwks.invalid/keys"
	cfg.ExtJWTAuth.Audiences = []string{"grafana"}
	loader, err := ProvideCloudRoutesLoaderFactory(cfg, PluginDependencies{})
	require.NoError(t, err)
	cloud := loader.(*cloudLoader)
	var calls int
	cloud.singleTenantFallback.transport = testFallbackTransport(func(*http.Request) (*http.Response, error) {
		calls++
		return &http.Response{StatusCode: http.StatusOK, Header: http.Header{"Content-Type": {"application/json"}}, Body: io.NopCloser(strings.NewReader(`{"kind":"APIGroupList","apiVersion":"v1","groups":[{"name":"fallback.example.com","versions":[],"preferredVersion":{"groupVersion":"","version":""}}]}`))}, nil
	})
	svc, err := provideTestService(cfg, featuremgmt.WithFeatures(), loader)
	require.NoError(t, err)
	httpRouter := mux.NewRouter()
	require.NoError(t, svc.RegisterTargetRoutes(httpRouter, nil))
	pollDiscovery(t, cloud.singleTenantFallback)
	require.NoError(t, svc.router.reconcile(t.Context()))
	polls := calls

	get := func(header string) string {
		req := newAuthenticatedRequest(http.MethodGet, "/apis", nil)
		req.Header.Set("Accept", "application/json")
		if header != "" {
			req.Header.Set(routerOriginHeader, header)
		}
		recorder := httptest.NewRecorder()
		httpRouter.ServeHTTP(recorder, req)
		require.Equal(t, http.StatusOK, recorder.Code)
		return recorder.Body.String()
	}
	require.Contains(t, get(""), "fallback.example.com")
	require.NotContains(t, get(originST), "fallback.example.com")
	require.Equal(t, polls, calls, "a request that skips stacks must not reach one")
}

// A stack, asked by the router to skip the router, answers with only its own
// groups, so the router's view of the stack never feeds back into itself.
func TestSingleTenantFallbackAsksStacksForTheirOwnDiscovery(t *testing.T) {
	for _, path := range []string{"/apis", "/apis/example", "/openapi/v3"} {
		t.Run(path, func(t *testing.T) {
			st := newTestSingleTenantFallback(t)
			st.resolveHost = func(context.Context, int64) (singleTenantStack, error) {
				return singleTenantStack{URL: "https://stack.example.com"}, nil
			}
			var sent string
			st.transport = testFallbackTransport(func(req *http.Request) (*http.Response, error) {
				sent = req.Header.Get(routerOriginHeader)
				return &http.Response{StatusCode: http.StatusOK, Header: make(http.Header), Body: io.NopCloser(strings.NewReader("discovery"))}, nil
			})
			recorder := httptest.NewRecorder()
			st.ServeHTTP(recorder, requestWithNamespace(http.MethodGet, path, "stacks-123"))
			require.Equal(t, http.StatusOK, recorder.Code)
			require.Equal(t, originMT, sent)
		})
	}
}

// Resource requests are marked with their origin too.
func TestSingleTenantFallbackMarksResourceRequestsWithTheirOrigin(t *testing.T) {
	st := newTestSingleTenantFallback(t)
	st.resolveHost = func(context.Context, int64) (singleTenantStack, error) {
		return singleTenantStack{URL: "https://stack.example.com"}, nil
	}
	st.transport = testFallbackTransport(func(req *http.Request) (*http.Response, error) {
		require.Equal(t, originMT, req.Header.Get(routerOriginHeader))
		return &http.Response{StatusCode: http.StatusNoContent, Header: make(http.Header), Body: http.NoBody}, nil
	})
	recorder := httptest.NewRecorder()
	st.ServeHTTP(recorder, requestWithNamespace(http.MethodGet, "/apis/example/v1/namespaces/stacks-123/widgets", "stacks-123"))
	require.Equal(t, http.StatusNoContent, recorder.Code)
}
