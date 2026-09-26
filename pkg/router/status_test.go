package router

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

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
			{Source: sourceSingleTenant, LastError: "discovery unavailable", Failures: 2},
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

func TestCloudLoaderReportsShadowedGroupsAndSourceStatus(t *testing.T) {
	st := newTestSingleTenantFallback(t)
	st.discoveryHost = testFallbackURL(t, "https://discovery.example.com")
	fail := false
	st.transport = testFallbackTransport(func(*http.Request) (*http.Response, error) {
		if fail {
			return nil, errors.New("discovery unavailable")
		}
		return &http.Response{StatusCode: http.StatusOK, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(`{"groups":[{"name":"shared"},{"name":"st-only"}]}`))}, nil
	})
	base, err := url.Parse("https://baas.example.com")
	require.NoError(t, err)
	shared, err := newAggregateBackend("baas_apiserver", metav1.APIGroup{Name: "shared"}, base, &http.Transport{})
	require.NoError(t, err)
	aggregate := priorityAggregate(shared)
	aggregate.name = "baas_apiserver"
	loader, err := newCloudLoader(nil, []*aggregateTarget{aggregate}, nil, st)
	require.NoError(t, err)

	pollDiscovery(t, st)
	backends, err := loader.Load(t.Context())
	require.NoError(t, err)
	require.Len(t, backends, 2)
	require.Equal(t, []shadowedGroup{{Group: "shared", Source: sourceSingleTenant, By: "aggregate:baas_apiserver"}}, loader.shadowedGroups())

	statuses := loader.sourceStatuses()
	require.Len(t, statuses, 2)
	require.Equal(t, sourceSingleTenant, statuses[0].Source)
	require.False(t, statuses[0].LastSuccess.IsZero())
	require.Empty(t, statuses[0].LastError)
	require.Equal(t, uint64(1), statuses[0].Successes)
	require.Equal(t, sourceStatus{Source: "aggregate:baas_apiserver"}, statuses[1], "never polled")

	fail = true
	pollDiscovery(t, st)
	statuses = loader.sourceStatuses()
	require.False(t, statuses[0].LastSuccess.IsZero(), "the last success is kept after a failure")
	require.Contains(t, statuses[0].LastError, "discovery unavailable")
	require.Equal(t, uint64(1), statuses[0].Failures)
}
