package router

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"testing/synctest"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestDurationStats(t *testing.T) {
	var stats durationStats
	stats.observe(time.Millisecond)
	stats.observe(200 * time.Millisecond)
	stats.observe(time.Minute)
	snap := stats.snapshot()
	require.Equal(t, uint64(3), snap.count)
	require.InDelta(t, 60.201, snap.sum, 0.001)
	require.Equal(t, uint64(1), snap.buckets[0.005])
	require.Equal(t, uint64(2), snap.buckets[0.25])
	require.Equal(t, uint64(2), snap.buckets[30], "the minute is only in +Inf")
}

func TestReconcileAndPollDurationsAreReported(t *testing.T) {
	reg := prometheus.NewRegistry()
	svc := newService(NewGrafanaRouter(&mutableLoader{}, nil), reg)
	require.NoError(t, svc.router.reconcile(t.Context()))

	families, err := reg.Gather()
	require.NoError(t, err)
	var found bool
	for _, family := range families {
		if family.GetName() == "grafana_router_reconcile_duration_seconds" {
			found = true
			require.Equal(t, uint64(1), family.GetMetric()[0].GetHistogram().GetSampleCount())
		}
	}
	require.True(t, found)

	source := &polledSource{source: "test", fetcher: failingFetcher{}, cooldown: newCooldown(time.Minute, time.Second, time.Minute)}
	source.poll(t.Context(), make(chan struct{}, 1))
	require.Equal(t, uint64(1), source.status.status("test").Duration.count, "a failed poll is measured too")
}

type failingFetcher struct{}

func (failingFetcher) fetch(context.Context) ([]Backend, int, error) {
	return nil, 0, errors.New("down")
}

// A removed group's series are deleted, and another group's are not.
func TestRemovedGroupsLoseTheirSeries(t *testing.T) {
	const kept, removed = "kept.grafana.app", "removed.grafana.app"
	loader := &mutableLoader{backends: []Backend{
		&fakeBackend{group: metav1.APIGroup{Name: kept}, key: "1"},
		&fakeBackend{group: metav1.APIGroup{Name: removed}, key: "1"},
	}}
	svc := newService(NewGrafanaRouter(loader, nil), prometheus.NewRegistry())
	require.NoError(t, svc.router.reconcile(t.Context()))
	m := svc.metrics
	for _, group := range []string{kept, removed} {
		m.backendFailure(group, "", failureTimeout)
		m.breakerChanged(group, 2)
		m.discoveryResult(group, discoveryCached)
		m.watchEnded(group, watchEndedShutdown)
		m.longRunning.WithLabelValues(group).Inc()
	}

	loader.backends = loader.backends[:1]
	require.NoError(t, svc.router.reconcile(t.Context()))
	for name, collector := range map[string]prometheus.Collector{
		"backend_failures": m.backendFailures, "breaker_transitions": m.breakerTransitions, "discovery_results": m.discoveryResults,
		"watches_ended": m.watchesEnded, "longrunning": m.longRunning,
	} {
		require.Equal(t, 1, testutil.CollectAndCount(collector), name)
	}
	require.Equal(t, 1.0, testutil.ToFloat64(m.longRunning.WithLabelValues(kept)))
}

// A watch the router ends is counted by why, and one the client ends is not.
func TestWatchesEndedByTheRouterAreCounted(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		backend := newWatchBackend()
		loader := &mutableLoader{backends: []Backend{&fakeBackend{group: metav1.APIGroup{Name: watchGroup}, key: "1", handler: backend}}}
		router := NewGrafanaRouter(loader, nil)
		svc := newService(router, prometheus.NewRegistry())
		require.NoError(t, router.reconcile(t.Context()))
		server := httptest.NewTestServer(t, http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			svc.metrics.instrumentRequest(router, w, req.WithContext(authenticatedTestContext(req.Context())))
		}))
		client := server.Client()
		t.Cleanup(func() {
			select {
			case <-backend.release:
			default:
				close(backend.release)
			}
		})
		ended := func(reason string) float64 {
			return testutil.ToFloat64(svc.metrics.watchesEnded.WithLabelValues(watchGroup, reason))
		}

		// The client leaves.
		ctx, cancel := context.WithCancel(t.Context())
		events := openWatchWithClient(ctx, t, server.URL+watchPath+"?watch=true", client)
		requireEvent(t, events, addedEvent)
		cancel()
		synctest.Wait()
		require.Zero(t, ended(watchEndedRouteChanged)+ended(watchEndedShutdown))

		// The backend changes.
		events = openWatchWithClient(t.Context(), t, server.URL+watchPath+"?watch=true", client)
		requireEvent(t, events, addedEvent)
		loader.backends = []Backend{&fakeBackend{group: metav1.APIGroup{Name: watchGroup}, key: "2", handler: backend}}
		require.NoError(t, router.reconcile(t.Context()))
		requireCleanEnd(t, events)
		synctest.Wait()
		require.Equal(t, 1.0, ended(watchEndedRouteChanged))

		// The router shuts down.
		events = openWatchWithClient(t.Context(), t, server.URL+watchPath+"?watch=true", client)
		requireEvent(t, events, addedEvent)
		router.closeWatches()
		requireCleanEnd(t, events)
		synctest.Wait()
		require.Equal(t, 1.0, ended(watchEndedShutdown))
	})
}

// A failure the backend reports while its discovery is read is counted under
// the group, and is not attributed to the request that caused the read.
func TestDiscoveryReadReportsBackendFailures(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		setPluginID(req, "test-app")
		setFailure(req, failureTransport)
		w.WriteHeader(http.StatusBadGateway)
	})
	req, outcome := withRequestOutcome(httptest.NewRequest(http.MethodGet, "/apis", nil))
	var gotPlugin, gotReason string
	status, err := readDiscoveryReporting(req, handler, apisPrefix, "application/json", &struct{}{}, func(pluginID, reason string) {
		gotPlugin, gotReason = pluginID, reason
	})
	require.Error(t, err)
	require.Equal(t, http.StatusBadGateway, status)
	require.Equal(t, "test-app", gotPlugin)
	require.Equal(t, failureTransport, gotReason)
	require.Empty(t, outcome.failure)
	require.Empty(t, outcome.pluginID)
}

func TestBackendDiscoveryFailuresReachTheRouter(t *testing.T) {
	entry := servingEntry{
		group:   metav1.APIGroup{Name: "test.grafana.app", Versions: []metav1.GroupVersionForDiscovery{{GroupVersion: "test.grafana.app/v1", Version: "v1"}}},
		key:     "1",
		breaker: newGroupBreaker("test.grafana.app"),
		handler: http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			setFailure(req, failureTimeout)
			w.WriteHeader(http.StatusGatewayTimeout)
		}),
	}
	var failures []string
	_, complete := backendDiscovery(httptest.NewRequest(http.MethodGet, "/apis", nil), "test.grafana.app", entry, func(_, reason string) {
		failures = append(failures, reason)
	})
	require.False(t, complete)
	require.Equal(t, []string{failureTimeout}, failures, "the failed /apis read stops the per-version reads")
}

func TestOverdueDiscoveryFetches(t *testing.T) {
	c := &discoveryCache{deadlines: map[string]time.Time{
		"stuck": time.Now().Add(-time.Second),
		"slow":  time.Now().Add(time.Hour),
	}}
	require.Equal(t, 1, c.overdue())
	c.fetchDone("stuck")
	require.Zero(t, c.overdue())
}

func TestStackBreakersAndCachesAreCounted(t *testing.T) {
	st, err := newSingleTenantFallback(singleTenantFallbackOptions{cacheSize: 1, breakerCacheSize: 1, resolveHost: func(_ context.Context, id int64) (singleTenantStack, error) {
		return singleTenantStack{URL: "http://stack.invalid", Slug: "s"}, nil
	}})
	require.NoError(t, err)
	counter := func(metric, result string) uint64 {
		for _, c := range st.counters() {
			if c.Metric == metric {
				return c.ByResult[result]
			}
		}
		t.Fatalf("no counter %s", metric)
		return 0
	}

	host := &url.URL{Scheme: "http", Host: "a.invalid"}
	breaker := st.breakerForDestination(host, "g")
	for range breakerOpenAfter {
		done, err := breaker.Allow()
		require.NoError(t, err)
		done(errors.New("down"))
	}
	require.Equal(t, uint64(1), counter("stack_breaker_transitions_total", "open"))

	st.breakerForDestination(&url.URL{Scheme: "http", Host: "b.invalid"}, "g")
	require.Equal(t, uint64(1), counter("stack_cache_evictions_total", "breaker"))

	_, err = st.hostForNamespace(t.Context(), "stacks-1")
	require.NoError(t, err)
	_, err = st.hostForNamespace(t.Context(), "stacks-2")
	require.NoError(t, err)
	require.Equal(t, uint64(1), counter("stack_cache_evictions_total", "host"))
}

func TestStackLookupDurations(t *testing.T) {
	results := map[int64]struct {
		stack singleTenantStack
		err   error
	}{
		1: {stack: singleTenantStack{URL: "http://stack.invalid", Slug: "s"}},
		2: {},
		3: {err: errors.New("down")},
	}
	st, err := newSingleTenantFallback(singleTenantFallbackOptions{cacheSize: 10, resolveHost: func(_ context.Context, id int64) (singleTenantStack, error) {
		return results[id].stack, results[id].err
	}})
	require.NoError(t, err)
	for _, namespace := range []string{"stacks-1", "stacks-2", "stacks-3"} {
		_, _ = st.hostForNamespace(t.Context(), namespace)
	}
	_, _ = st.hostForNamespace(t.Context(), "stacks-1") // cached: not measured

	durations := st.durations()
	require.Len(t, durations, 1)
	for result, want := range map[string]uint64{"resolved": 1, "not_found": 1, "error": 1} {
		require.Equal(t, want, durations[0].ByResult[result].count, result)
	}

	reg := prometheus.NewRegistry()
	loader := newSingleTenantResourcesLoader(t, "http://mt.invalid", "http://stack.invalid")
	for _, collector := range newLoaderDurationCollectors(loader) {
		reg.MustRegister(collector)
	}
	families, err := reg.Gather()
	require.NoError(t, err)
	require.Len(t, families, 1)
	require.Equal(t, "grafana_router_stack_lookup_duration_seconds", families[0].GetName())
	require.Len(t, families[0].GetMetric(), 3)
}
