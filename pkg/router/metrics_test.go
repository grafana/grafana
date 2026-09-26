package router

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

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

	// The router rejects a non-canonical path itself, so it is the router's to count.
	invalid := "/apis/dashboard.grafana.app/../test-app/v1/things"
	require.Equal(t, http.StatusBadRequest, serve(invalid))
	verb := requestVerb(httptest.NewRequest(http.MethodGet, invalid, nil))
	require.Equal(t, uint64(1), requestCount(t, svc, unknownGroupLabel, verb, routeInvalid, "400"))
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

// statusLoader is a loader that reports fixed source status.
type statusLoader struct {
	backends []Backend
	err      error
	shadowed []shadowedGroup
	sources  []sourceStatus
}

func (l *statusLoader) Load(context.Context) ([]Backend, error) { return l.backends, l.err }
func (l *statusLoader) Notify(context.Context) (<-chan struct{}, error) {
	return make(chan struct{}), nil
}
func (l *statusLoader) shadowedGroups() []shadowedGroup { return l.shadowed }
func (l *statusLoader) sourceStatuses() []sourceStatus  { return l.sources }
func (l *statusLoader) stackLookups() map[string]uint64 {
	return map[string]uint64{"cache_hit": 3, "resolved": 1}
}

func newStatusService(t *testing.T) (*Service, *statusLoader, *prometheus.Registry) {
	t.Helper()
	first, err := NewForwardBackend(metav1.APIGroup{Name: "first.ext.grafana.app"}, forwardSpec("https://first.example.com:8443/base"), "rv-1", &http.Transport{})
	require.NoError(t, err)
	second, err := NewForwardBackend(metav1.APIGroup{Name: "second.ext.grafana.app"}, forwardSpec("https://second.example.com"), "rv-2", &http.Transport{})
	require.NoError(t, err)
	loader := &statusLoader{
		backends: []Backend{first, second, &dummyBackend{group: "dummy.ext.grafana.app"}},
		shadowed: []shadowedGroup{{Group: "first.ext.grafana.app", Source: sourceSingleTenant, By: sourceRouteBackend}},
		sources: []sourceStatus{
			{Source: sourceRouteBackend, LastSuccess: time.Unix(1700000000, 0).UTC(), Successes: 4},
			{Source: sourceSingleTenant, Failures: 2},
		},
	}
	reg := prometheus.NewRegistry()
	svc := newService(loader, reg)
	svc.router.storeServing(t.Context(), svc.router.reconcile(t.Context()))
	return svc, loader, reg
}

func TestRouterCollector(t *testing.T) {
	svc, loader, reg := newStatusService(t)
	loader.err = errors.New("load failed")
	svc.router.storeServing(t.Context(), svc.router.reconcile(t.Context()))
	for range 6 { // the default breaker opens after more than five consecutive failures
		tripBreaker(svc.router.served["second.ext.grafana.app"].breaker)
	}

	expected := `
# HELP grafana_router_breaker_state Circuit breaker state of each group: 1 for its current state (closed, half-open or open), 0 for the others.
# TYPE grafana_router_breaker_state gauge
grafana_router_breaker_state{group="dummy.ext.grafana.app",state="closed"} 1
grafana_router_breaker_state{group="dummy.ext.grafana.app",state="half-open"} 0
grafana_router_breaker_state{group="dummy.ext.grafana.app",state="open"} 0
grafana_router_breaker_state{group="first.ext.grafana.app",state="closed"} 1
grafana_router_breaker_state{group="first.ext.grafana.app",state="half-open"} 0
grafana_router_breaker_state{group="first.ext.grafana.app",state="open"} 0
grafana_router_breaker_state{group="second.ext.grafana.app",state="closed"} 0
grafana_router_breaker_state{group="second.ext.grafana.app",state="half-open"} 0
grafana_router_breaker_state{group="second.ext.grafana.app",state="open"} 1
# HELP grafana_router_breaker_transitions_total Circuit breaker state changes, by group and the state entered: closed, half-open or open.
# TYPE grafana_router_breaker_transitions_total counter
grafana_router_breaker_transitions_total{group="second.ext.grafana.app",state="open"} 1
# HELP grafana_router_groups Number of API groups the router serves, by route source.
# TYPE grafana_router_groups gauge
grafana_router_groups{source="dummy"} 1
grafana_router_groups{source="routebackend"} 2
# HELP grafana_router_ready Whether the router is ready to serve traffic: 1 ready, 0 not.
# TYPE grafana_router_ready gauge
grafana_router_ready 1
# HELP grafana_router_reconcile_errors_total Number of route reconciles that completed with errors.
# TYPE grafana_router_reconcile_errors_total counter
grafana_router_reconcile_errors_total 1
# HELP grafana_router_reconciles_total Number of completed route reconciles.
# TYPE grafana_router_reconciles_total counter
grafana_router_reconciles_total 2
# HELP grafana_router_shadowed_groups Number of API groups a source offered that a higher-priority source serves instead, in the latest load.
# TYPE grafana_router_shadowed_groups gauge
grafana_router_shadowed_groups{source="single-tenant"} 1
# HELP grafana_router_source_last_success_timestamp_seconds When each route source last loaded successfully, in seconds since the Unix epoch.
# TYPE grafana_router_source_last_success_timestamp_seconds gauge
grafana_router_source_last_success_timestamp_seconds{source="routebackend"} 1.7e+09
# HELP grafana_router_source_polls_total Load or poll attempts of each route source, by result: success or failure.
# TYPE grafana_router_source_polls_total counter
grafana_router_source_polls_total{result="failure",source="routebackend"} 0
grafana_router_source_polls_total{result="failure",source="single-tenant"} 2
grafana_router_source_polls_total{result="success",source="routebackend"} 4
grafana_router_source_polls_total{result="success",source="single-tenant"} 0
# HELP grafana_router_stack_lookups_total Single-tenant stack lookups, by result: cache_hit, resolved, not_found, throttled or error.
# TYPE grafana_router_stack_lookups_total counter
grafana_router_stack_lookups_total{result="cache_hit"} 3
grafana_router_stack_lookups_total{result="resolved"} 1
`
	require.NoError(t, testutil.GatherAndCompare(reg, strings.NewReader(expected),
		"grafana_router_breaker_state", "grafana_router_breaker_transitions_total", "grafana_router_groups",
		"grafana_router_ready", "grafana_router_reconcile_errors_total", "grafana_router_reconciles_total",
		"grafana_router_shadowed_groups", "grafana_router_source_last_success_timestamp_seconds",
		"grafana_router_source_polls_total", "grafana_router_stack_lookups_total"))
	require.Equal(t, 1, testutil.CollectAndCount(reg, "grafana_router_last_reconcile_timestamp_seconds"))
}
