package router

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/mux"
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
			{Source: sourceRouteBackend, LastSuccess: time.Unix(1700000000, 0).UTC()},
			{Source: sourceSingleTenant, LastError: "discovery unavailable"},
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
# HELP grafana_router_breaker_state State of each group's circuit breaker: 0 closed, 1 half-open, 2 open.
# TYPE grafana_router_breaker_state gauge
grafana_router_breaker_state{group="dummy.ext.grafana.app"} 0
grafana_router_breaker_state{group="first.ext.grafana.app"} 0
grafana_router_breaker_state{group="second.ext.grafana.app"} 2
# HELP grafana_router_groups Number of API groups the router serves, by route source.
# TYPE grafana_router_groups gauge
grafana_router_groups{source="dummy"} 1
grafana_router_groups{source="routebackend"} 2
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
`
	require.NoError(t, testutil.GatherAndCompare(reg, strings.NewReader(expected),
		"grafana_router_breaker_state", "grafana_router_groups", "grafana_router_reconcile_errors_total",
		"grafana_router_reconciles_total", "grafana_router_shadowed_groups", "grafana_router_source_last_success_timestamp_seconds"))
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
	require.Equal(t, sourceStatus{Source: "aggregate:baas_apiserver"}, statuses[1], "never polled")

	fail = true
	pollDiscovery(t, st)
	statuses = loader.sourceStatuses()
	require.False(t, statuses[0].LastSuccess.IsZero(), "the last success is kept after a failure")
	require.Contains(t, statuses[0].LastError, "discovery unavailable")
}

func TestDebugEndpoint(t *testing.T) {
	svc, _, _ := newStatusService(t)
	svc.standalone = true
	httpRouter := mux.NewRouter()
	require.NoError(t, svc.RegisterTargetRoutes(httpRouter, nil))
	require.NoError(t, svc.router.reconcile(t.Context()))
	svc.router.storeServing(t.Context(), nil)

	recorder := httptest.NewRecorder()
	httpRouter.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, debugPath, nil))
	require.Equal(t, http.StatusOK, recorder.Code)
	var state routerDebugState
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &state))
	require.True(t, state.Ready)
	require.Equal(t, uint64(2), state.Reconciles)
	require.Equal(t, []debugGroup{
		{Group: "dummy.ext.grafana.app", Versions: []string{"v0alpha1", "v0alpha2"}, BackendDescription: BackendDescription{Source: sourceDummy}, Key: "static", Breaker: "closed"},
		{Group: "first.ext.grafana.app", Versions: []string{}, BackendDescription: BackendDescription{Source: sourceRouteBackend, Target: "https://first.example.com:8443"}, Key: "rv-1", Breaker: "closed"},
		{Group: "second.ext.grafana.app", Versions: []string{}, BackendDescription: BackendDescription{Source: sourceRouteBackend, Target: "https://second.example.com"}, Key: "rv-2", Breaker: "closed"},
	}, state.Groups)
	require.Len(t, state.Shadowed, 1)
	require.Len(t, state.Sources, 2)

	recorder = httptest.NewRecorder()
	httpRouter.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, debugPath, nil))
	require.Equal(t, http.StatusMethodNotAllowed, recorder.Code, "the endpoint is read-only")
}

func TestDebugHandlerOnlyInMiddlewareMode(t *testing.T) {
	for _, tc := range []struct {
		name                   string
		middleware, standalone bool
		mounted                bool
	}{
		{name: "middleware", middleware: true, mounted: true},
		{name: "standalone target (mounted on its own listener instead)", standalone: true},
		{name: "standalone target with the middleware flag", middleware: true, standalone: true},
		{name: "disabled"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			svc, _, _ := newStatusService(t)
			svc.middleware, svc.standalone = tc.middleware, tc.standalone
			path, handler := svc.DebugHandler()
			if !tc.mounted {
				require.Nil(t, handler)
				return
			}
			require.Equal(t, debugPath, path)
			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path, nil))
			require.Equal(t, http.StatusOK, recorder.Code)
			require.Contains(t, recorder.Body.String(), `"group": "first.ext.grafana.app"`)
		})
	}
}
