package router

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// metricsService serves group through a real forward proxy to upstream.
func metricsService(t *testing.T, group, upstream string) *Service {
	t.Helper()
	backend, err := NewForwardBackend(metav1.APIGroup{Name: group}, forwardSpec(upstream), "1", &http.Transport{})
	require.NoError(t, err)
	svc := newService(&mutableLoader{backends: []Backend{backend}}, prometheus.NewRegistry())
	require.NoError(t, svc.router.reconcile(t.Context()))
	return svc
}

func instrumented(svc *Service, target string) int {
	recorder := httptest.NewRecorder()
	svc.metrics.instrument(svc.router, recorder, httptest.NewRequest(http.MethodGet, target, nil), http.NotFoundHandler())
	return recorder.Code
}

func requestCount(t *testing.T, svc *Service, labels ...string) uint64 {
	t.Helper()
	return histogramCount(t, svc.metrics.duration.WithLabelValues(labels...))
}

func TestRequestMetricsRouteLabel(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) }))
	t.Cleanup(upstream.Close)
	svc := metricsService(t, "test-app", upstream.URL)

	for _, tc := range []struct {
		target, group, verb, route, status string
	}{
		{"/apis/test-app/v1/namespaces/ns/things", "test-app", "list", routeBackend, "204"},
		{"/apis/other-app/v1/namespaces/ns/things", unknownGroupLabel, "list", routeNext, "404"},
		{"/apis", "", "get", routeDiscovery, "200"},
		{"/apis//v1/things", "", "list", routeInvalid, "400"},
		{"/version", "", "get", routeNext, "404"},
	} {
		instrumented(svc, tc.target)
		require.Equal(t, uint64(1), requestCount(t, svc, tc.group, tc.verb, tc.route, tc.status), tc.target)
	}
}

func TestBackendFailureReasons(t *testing.T) {
	t.Run("transport, then breaker_open", func(t *testing.T) {
		closed := httptest.NewServer(http.NotFoundHandler())
		closed.Close()
		svc := metricsService(t, "test-app", closed.URL)
		for range 6 {
			require.Equal(t, http.StatusBadGateway, instrumented(svc, "/apis/test-app/v1/things"))
		}
		require.Equal(t, http.StatusServiceUnavailable, instrumented(svc, "/apis/test-app/v1/things"))
		require.Equal(t, 6.0, testutil.ToFloat64(svc.metrics.backendFailures.WithLabelValues("test-app", failureTransport)))
		require.Equal(t, 1.0, testutil.ToFloat64(svc.metrics.backendFailures.WithLabelValues("test-app", failureBreakerOpen)))
		require.Equal(t, 1.0, testutil.ToFloat64(svc.metrics.breakerTransitions.WithLabelValues("test-app", "open")))
	})
	t.Run("redirect_rejected", func(t *testing.T) {
		upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			http.Redirect(w, req, "https://elsewhere.example.com", http.StatusFound)
		}))
		t.Cleanup(upstream.Close)
		svc := metricsService(t, "test-app", upstream.URL)
		require.Equal(t, http.StatusBadGateway, instrumented(svc, "/apis/test-app/v1/things"))
		require.Equal(t, 1.0, testutil.ToFloat64(svc.metrics.backendFailures.WithLabelValues("test-app", failureRedirectRejected)))
	})
}

func TestMiddlewareCountsOnlyRequestsTheRouterOwns(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) }))
	t.Cleanup(upstream.Close)
	svc := metricsService(t, "test-app", upstream.URL)
	svc.middleware = true
	embedded := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusTeapot) })
	serve := func(target string) int {
		recorder := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, target, nil)
		req = req.WithContext(identity.WithRequester(req.Context(), &identity.StaticRequester{}))
		svc.HandleFunc(recorder, req, embedded)
		return recorder.Code
	}

	require.Equal(t, http.StatusTeapot, serve("/apis/dashboard.grafana.app/v1/namespaces/ns/dashboards"))
	require.Equal(t, http.StatusTeapot, serve("/livez"))
	require.Zero(t, testutil.CollectAndCount(svc.metrics.duration), "the embedded API server's requests are not the router's")

	require.Equal(t, http.StatusNoContent, serve("/apis/test-app/v1/namespaces/ns/things"))
	require.Equal(t, uint64(1), requestCount(t, svc, "test-app", "list", routeBackend, "204"))
}

func TestDiscoveryResultMetrics(t *testing.T) {
	svc := newService(&mutableLoader{backends: []Backend{
		&providerBackend{
			fakeBackend: fakeBackend{group: metav1.APIGroup{Name: "provided.ext.grafana.app"}, key: "1"},
			discovery:   thingsDiscovery("provided.ext.grafana.app"),
		},
		&fakeBackend{group: metav1.APIGroup{Name: cachedGroup}, key: "1", handler: &countingDiscoveryBackend{group: cachedGroup}},
	}}, prometheus.NewRegistry())
	require.NoError(t, svc.router.reconcile(t.Context()))

	aggregatedDiscovery(t, svc.router)
	aggregatedDiscovery(t, svc.router)
	results := svc.metrics.discoveryResults
	require.Equal(t, 2.0, testutil.ToFloat64(results.WithLabelValues("provided.ext.grafana.app", discoveryProvided)))
	require.Equal(t, 1.0, testutil.ToFloat64(results.WithLabelValues(cachedGroup, discoveryFetched)))
	require.Equal(t, 1.0, testutil.ToFloat64(results.WithLabelValues(cachedGroup, discoveryCached)))
}

func TestStackLookupCounts(t *testing.T) {
	st, err := newSingleTenantFallback(singleTenantFallbackOptions{
		cacheSize: 10, lookupRate: 0.001, lookupBurst: 2,
		resolveHost: func(_ context.Context, stackID int64) (singleTenantStack, error) {
			if stackID == 1 {
				return singleTenantStack{URL: "https://tenant.example.com"}, nil
			}
			return singleTenantStack{}, nil
		},
	})
	require.NoError(t, err)
	for _, namespace := range []string{"stacks-1", "stacks-1", "stacks-2", "stacks-3"} {
		_, _ = st.hostForNamespace(t.Context(), namespace)
	}
	require.Equal(t, map[string]uint64{
		"cache_hit": 1, "resolved": 1, "not_found": 1, "throttled": 1, "error": 0,
	}, st.lookupsBy.byResult())
}
