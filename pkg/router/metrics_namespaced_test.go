package router

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
)

func TestNamespacedGroupsAreLabelledByTheirOwner(t *testing.T) {
	reg := prometheus.NewRegistry()
	backend := func(group, namespace string) Backend {
		return &fakeNamespacedBackend{
			fakeBackend: fakeBackend{key: group + "-key", group: testAPIGroup(group, "v1"), handler: &countingDiscoveryBackend{group: group}},
			namespace:   namespace,
		}
	}
	svc := newService(&mutableLoader{backends: []Backend{
		backend(stack1TestGroup, "stacks-1"),
		backend(stack2TestGroup, "stacks-2"),
	}}, nil, reg)
	require.NoError(t, svc.router.reconcile(t.Context()))

	for _, tc := range []struct{ target, namespace string }{
		{"/apis/" + stack1TestGroup + "/v1", "stacks-1"},
		{"/apis/" + stack2TestGroup + "/v1", "stacks-2"},
		{"/apis/" + stack2TestGroup + "/v1", "stacks-1"}, // unknown to this caller, but a served group
	} {
		svc.metrics.instrument(svc.router, httptest.NewRecorder(), namespacedRequest(http.MethodGet, tc.target, tc.namespace), http.NotFoundHandler())
	}
	require.Equal(t, 2.0, testutil.ToFloat64(svc.metrics.requests.WithLabelValues(testOwnerGroup, "get", routeBackend, "200")))
	require.Equal(t, 1.0, testutil.ToFloat64(svc.metrics.requests.WithLabelValues(testOwnerGroup, "get", routeNext, "404")))

	for _, namespace := range []string{"stacks-1", "stacks-2"} {
		req := namespacedRequest(http.MethodGet, "/apis", namespace)
		req.Header.Set("Accept", aggregatedDiscoveryJSON)
		svc.router.HandleFunc(httptest.NewRecorder(), req, http.NotFoundHandler())
	}
	require.Equal(t, 2.0, testutil.ToFloat64(svc.metrics.discoveryResults.WithLabelValues(testOwnerGroup, discoveryFetched)))

	for range breakerOpenAfter {
		tripBreaker(svc.router.served[stack1TestGroup].breaker)
	}
	expected := `
# HELP grafana_router_breaker_state Circuit breaker state of each group: 1 for its current state (closed, half-open or open), 0 for the others. Namespaced groups count under their owner group, whose value is the number of its groups in each state.
# TYPE grafana_router_breaker_state gauge
grafana_router_breaker_state{group="gas.ext.grafana.app",state="closed"} 1
grafana_router_breaker_state{group="gas.ext.grafana.app",state="half-open"} 0
grafana_router_breaker_state{group="gas.ext.grafana.app",state="open"} 1
# HELP grafana_router_breaker_transitions_total Circuit breaker state changes, by group and the state entered: closed, half-open or open.
# TYPE grafana_router_breaker_transitions_total counter
grafana_router_breaker_transitions_total{group="gas.ext.grafana.app",state="open"} 1
`
	require.NoError(t, testutil.GatherAndCompare(reg, strings.NewReader(expected),
		"grafana_router_breaker_state", "grafana_router_breaker_transitions_total"))
}

func TestBackendMetricGroup(t *testing.T) {
	require.Equal(t, sharedTestGroup, backendMetricGroup(&fakeBackend{group: testAPIGroup(sharedTestGroup, "v1")}))
	require.Equal(t, testOwnerGroup, backendMetricGroup(&fakeNamespacedBackend{fakeBackend: fakeBackend{group: testAPIGroup(stack1TestGroup, "v1")}}))
}
