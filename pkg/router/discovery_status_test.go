package router

import (
	"encoding/json"
	"errors"
	"maps"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"
	"testing/synctest"
	"time"

	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/sony/gobreaker/v2"
	"github.com/stretchr/testify/require"
	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"

	"github.com/grafana/grafana/pkg/plugins"
)

type fakeStatusBackend struct {
	fakeManifestBackend
	plugin PluginStatus
}

func (b *fakeStatusBackend) PluginStatus() (PluginStatus, bool) { return b.plugin, true }

// failBreaker records n consecutive failures on a group's breaker.
func failBreaker(t *testing.T, cb *groupBreaker, n int) {
	t.Helper()
	for range n {
		done, err := cb.Allow()
		require.NoError(t, err)
		done(errors.New("backend returned status 503"))
	}
}

func readStatus(t *testing.T, r *GrafanaRouter) (routerStatusDoc, map[string]groupStatusDoc) {
	t.Helper()
	rec := httptest.NewRecorder()
	r.HandleFunc(rec, newAuthenticatedRequest(http.MethodGet, "/apis/discovery/v1alpha2/status", nil))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	require.Equal(t, "no-store", rec.Header().Get("Cache-Control"))
	var doc routerStatusDoc
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &doc))
	groups := map[string]groupStatusDoc{}
	for _, g := range doc.Groups {
		groups[g.Group] = g
	}
	return doc, groups
}

func TestRouterStatus(t *testing.T) {
	plugin := &fakeStatusBackend{
		fakeManifestBackend: *testManifestBackends()[0].(*fakeManifestBackend),
		plugin:              PluginStatus{ID: "widgets-app", Version: "1.2.3", HasBackend: true},
	}
	watched := make(chan struct{})
	release := make(chan struct{})
	plugin.handler = http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if requestVerb(req) == "watch" {
			close(watched)
			<-release
		}
	})
	provided := testManifestBackends()[1].(*fakeDiscoveryBackend)
	failing := &fakeBackend{key: "failing", group: testAPIGroup("failing.ext.grafana.app", "v1")}
	broken := &fakeBackend{key: "broken", group: testAPIGroup("broken.ext.grafana.app", "v1")}
	st := &fakeBackend{key: "st", group: testAPIGroup("st.ext.grafana.app", "v1"), handler: &singleTenantFallback{}}

	r := NewGrafanaRouter(staticLoader{backends: []Backend{plugin, provided, failing, broken, st}}, nil)
	before := time.Now().UTC()
	require.NoError(t, r.reconcile(t.Context()))
	failBreaker(t, r.served["failing.ext.grafana.app"].breaker, 2)
	failBreaker(t, r.served["broken.ext.grafana.app"].breaker, breakerOpenAfter)

	doc, groups := readStatus(t, r)
	require.Equal(t, "serving", doc.Reconciler.Phase)
	require.True(t, doc.Ready)
	require.False(t, doc.Reconciler.LastFailed)
	require.Equal(t, uint64(1), doc.Reconciler.Total)
	require.Zero(t, doc.Reconciler.Errors)
	require.NotNil(t, doc.Reconciler.Last)
	require.Equal(t, breakerSettingsDoc{OpenAfterConsecutiveFailures: breakerOpenAfter, OpenFor: "1m0s"}, doc.Breakers)
	require.Len(t, doc.Groups, 5, "discovery is the router's own, not a routed group")

	widgets := groups[manifestTestGroup]
	require.Equal(t, "test", widgets.Source)
	require.Equal(t, "widgets-key", widgets.Key)
	require.True(t, widgets.Manifest)
	require.Equal(t, &PluginStatus{ID: "widgets-app", Version: "1.2.3", HasBackend: true}, widgets.Plugin)
	require.False(t, widgets.LoadedAt.Before(before.Truncate(time.Second)))
	require.Equal(t, "ok", widgets.Health)
	require.Equal(t, breakerStatusDoc{Scope: "requests", State: "closed", FailuresUntilOpen: breakerOpenAfter}, widgets.Breaker)
	require.Equal(t, "not-cached", widgets.Discovery)

	require.Equal(t, "provided", groups["gadgets.example.com"].Discovery)
	require.False(t, groups["gadgets.example.com"].Manifest)
	require.Nil(t, groups["gadgets.example.com"].Plugin, "not a plugin")

	failingStatus := groups["failing.ext.grafana.app"]
	require.Equal(t, "degraded", failingStatus.Health, "failing, but still closed")
	require.Equal(t, uint32(2), failingStatus.Breaker.ConsecutiveFailures)
	require.Equal(t, uint32(breakerOpenAfter-2), failingStatus.Breaker.FailuresUntilOpen)

	brokenStatus := groups["broken.ext.grafana.app"]
	require.Equal(t, "unavailable", brokenStatus.Health)
	require.Equal(t, "open", brokenStatus.Breaker.State)
	require.Zero(t, brokenStatus.Breaker.FailuresUntilOpen)

	require.Equal(t, "unknown", groups["st.ext.grafana.app"].Health)
	require.Equal(t, breakerStatusDoc{Scope: "per-destination"}, groups["st.ext.grafana.app"].Breaker)

	t.Run("counts watches while they run", func(t *testing.T) {
		done := make(chan struct{})
		go func() {
			defer close(done)
			rec := httptest.NewRecorder()
			r.HandleFunc(rec, newAuthenticatedRequest(http.MethodGet, "/apis/"+manifestTestGroup+"/v1/widgets?watch=true", nil))
		}()
		<-watched
		_, groups := readStatus(t, r)
		require.Equal(t, int64(1), groups[manifestTestGroup].Watches)
		close(release)
		<-done
		_, groups = readStatus(t, r)
		require.Zero(t, groups[manifestTestGroup].Watches)
	})

	t.Run("reports cached discovery and OpenAPI", func(t *testing.T) {
		r.discoveryCache.store(manifestTestGroup, "widgets-key", apidiscoveryv2.APIGroupDiscovery{})
		r.storeOpenAPIDoc(manifestTestGroup, manifestTestGroup+"/v1", openapiCacheEntry{key: "widgets-key"})
		_, groups := readStatus(t, r)
		require.Equal(t, "cached", groups[manifestTestGroup].Discovery)
		require.Equal(t, []string{"v1"}, groups[manifestTestGroup].OpenAPICached)
	})

	t.Run("before the first reconcile", func(t *testing.T) {
		doc, _ := readStatus(t, NewGrafanaRouter(stubLoader{}, nil))
		require.Equal(t, "starting", doc.Reconciler.Phase)
		require.False(t, doc.Ready)
		require.Empty(t, doc.Groups)
		require.Nil(t, doc.Reconciler.Last)
	})
}

func TestPluginBackendStatus(t *testing.T) {
	backend := &PluginBackend{pluginID: "widgets-app", info: plugins.Info{Version: "1.2.3"}, hasBackend: true}
	want := PluginStatus{ID: "widgets-app", Version: "1.2.3", HasBackend: true}
	got, ok := backend.PluginStatus()
	require.True(t, ok)
	require.Equal(t, want, got)

	got, ok = (&wrappedBackend{Backend: backend}).PluginStatus()
	require.True(t, ok, "a wrapper forwards it")
	require.Equal(t, want, got)

	_, ok = (&wrappedBackend{Backend: &fakeBackend{}}).PluginStatus()
	require.False(t, ok, "no plugin, so no plugin property")
}

// TestStatusReadsDoNotMoveBreakers checks that reading an open breaker, from
// the status page or a metrics scrape, leaves it for a request to move.
// gobreaker's own State would move it to half-open once its timeout passed.
func TestStatusReadsDoNotMoveBreakers(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		const group = "flaky.ext.grafana.app"
		backend := &fakeBackend{key: "flaky", group: testAPIGroup(group, "v1"), handler: http.HandlerFunc(func(http.ResponseWriter, *http.Request) {})}
		r := NewGrafanaRouter(staticLoader{backends: []Backend{backend}}, nil)
		var transitions []string
		r.onBreakerChange = func(_ string, to gobreaker.State) { transitions = append(transitions, to.String()) }
		require.NoError(t, r.reconcile(t.Context()))
		failBreaker(t, r.served[group].breaker, breakerOpenAfter)
		require.Equal(t, []string{"open"}, transitions)

		time.Sleep(breakerOpenFor + time.Second)
		for range 2 {
			_, groups := readStatus(t, r)
			require.Equal(t, "open", groups[group].Breaker.State)
			require.Equal(t, "unavailable", groups[group].Health)
			require.NotNil(t, groups[group].Breaker.RetryAt)
			require.True(t, groups[group].Breaker.RetryAt.Before(time.Now()), "the next request is the trial")
			_ = testutil.CollectAndCount(newRouterCollector(r))
		}
		require.Equal(t, []string{"open"}, transitions, "reads move nothing")

		rec := httptest.NewRecorder()
		r.HandleFunc(rec, newAuthenticatedRequest(http.MethodGet, "/apis/"+group+"/v1/things", nil))
		require.Equal(t, []string{"open", "half-open", "closed"}, transitions, "the request is the trial, and it succeeded")
		_, groups := readStatus(t, r)
		require.Equal(t, "ok", groups[group].Health)
		require.Nil(t, groups[group].Breaker.RetryAt)
	})
}

// A loader counter with a status field is a field of the status document; the
// others are only metrics.
func TestRouterStatusLoaderCounters(t *testing.T) {
	svc, _, _ := newStatusService(t)
	rec := httptest.NewRecorder()
	svc.router.HandleFunc(rec, newAuthenticatedRequest(http.MethodGet, "/apis/discovery/v1alpha2/status", nil))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	var fields map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &fields))
	require.JSONEq(t, `{"cache_hit": 3, "resolved": 1}`, string(fields["stackLookups"]))
	require.Contains(t, fields, "sources", "the other fields are kept")
	require.NotContains(t, fields, "stack_discovery_cache_total")
	require.ElementsMatch(t, []string{"ready", "reconciler", "breakers", "groups", "sources", "shadowed", "stackLookups"}, slices.Collect(maps.Keys(fields)))
}
