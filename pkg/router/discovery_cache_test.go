package router

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sync"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/require"
	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const cachedGroup = "cached.ext.grafana.app"

func thingsDiscovery(group string) apidiscoveryv2.APIGroupDiscovery {
	return apidiscoveryv2.APIGroupDiscovery{
		ObjectMeta: metav1.ObjectMeta{Name: group},
		Versions: []apidiscoveryv2.APIVersionDiscovery{{
			Version:   "v1",
			Freshness: apidiscoveryv2.DiscoveryFreshnessCurrent,
			Resources: []apidiscoveryv2.APIResourceDiscovery{{
				Resource: "things", Scope: apidiscoveryv2.ScopeNamespace, Verbs: []string{"get", "list"},
				ResponseKind: &metav1.GroupVersionKind{Group: group, Version: "v1", Kind: "Thing"},
			}},
		}},
	}
}

// countingDiscoveryBackend answers aggregated discovery for group, counting
// requests; it answers 401 while refuse is set.
type countingDiscoveryBackend struct {
	group  string
	calls  atomic.Int32
	refuse atomic.Bool
	delay  time.Duration
}

func (b *countingDiscoveryBackend) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	b.calls.Add(1)
	if b.delay > 0 {
		time.Sleep(b.delay)
	}
	if b.refuse.Load() {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	_ = json.NewEncoder(w).Encode(apidiscoveryv2.APIGroupDiscoveryList{
		TypeMeta: metav1.TypeMeta{Kind: "APIGroupDiscoveryList", APIVersion: "apidiscovery.k8s.io/v2"},
		Items:    []apidiscoveryv2.APIGroupDiscovery{thingsDiscovery(b.group)},
	})
}

func aggregatedDiscovery(t *testing.T, router *GrafanaRouter) map[string]apidiscoveryv2.APIGroupDiscovery {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/apis", nil)
	req.Header.Set("Accept", aggregatedDiscoveryJSON)
	recorder := httptest.NewRecorder()
	router.HandleFunc(recorder, req, http.NotFoundHandler())
	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	var list apidiscoveryv2.APIGroupDiscoveryList
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &list))
	groups := map[string]apidiscoveryv2.APIGroupDiscovery{}
	for _, group := range list.Items {
		groups[group.Name] = group
	}
	return groups
}

func requireFreshness(t *testing.T, group apidiscoveryv2.APIGroupDiscovery, want apidiscoveryv2.DiscoveryFreshness) {
	t.Helper()
	require.NotEmpty(t, group.Versions)
	for _, version := range group.Versions {
		require.Equal(t, want, version.Freshness, version.Version)
	}
}

type providerBackend struct {
	fakeBackend
	discovery apidiscoveryv2.APIGroupDiscovery
}

func (b *providerBackend) Discovery() (apidiscoveryv2.APIGroupDiscovery, bool) {
	return b.discovery, true
}

func TestAggregatedDiscoveryUsesProviderWithoutRequests(t *testing.T) {
	handler := &countingDiscoveryBackend{group: cachedGroup}
	backend := &providerBackend{
		fakeBackend: fakeBackend{group: metav1.APIGroup{Name: cachedGroup}, key: "1", handler: handler},
		discovery:   thingsDiscovery(cachedGroup),
	}
	router := NewGrafanaRouter(staticLoader{backends: []Backend{backend}})
	require.NoError(t, router.reconcile(t.Context()))

	for range 3 {
		group := aggregatedDiscovery(t, router)[cachedGroup]
		require.Equal(t, "things", group.Versions[0].Resources[0].Resource)
	}
	require.Zero(t, handler.calls.Load())
}

func TestAggregatedDiscoveryCachesBackendFetches(t *testing.T) {
	handler := &countingDiscoveryBackend{group: cachedGroup}
	router := discoveryRouter(t, cachedGroup, handler)

	for range 3 {
		group := aggregatedDiscovery(t, router)[cachedGroup]
		requireFreshness(t, group, apidiscoveryv2.DiscoveryFreshnessCurrent)
		require.Equal(t, "things", group.Versions[0].Resources[0].Resource)
	}
	require.EqualValues(t, 1, handler.calls.Load())

	// A new backend key means a new backend: fetch again.
	router.served[cachedGroup].lastKey = "next-revision"
	router.publish(t.Context())
	aggregatedDiscovery(t, router)
	require.EqualValues(t, 2, handler.calls.Load())
}

func TestAggregatedDiscoveryCacheExpiresAndFallsBackToStale(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		handler := &countingDiscoveryBackend{group: cachedGroup}
		router := discoveryRouter(t, cachedGroup, handler)
		aggregatedDiscovery(t, router)
		require.EqualValues(t, 1, handler.calls.Load())

		time.Sleep(discoveryCacheTTL + time.Second)
		handler.refuse.Store(true)
		group := aggregatedDiscovery(t, router)[cachedGroup]
		require.EqualValues(t, 2, handler.calls.Load())
		requireFreshness(t, group, apidiscoveryv2.DiscoveryFreshnessStale)
		require.Equal(t, "things", group.Versions[0].Resources[0].Resource, "the last good copy is kept")

		handler.refuse.Store(false)
		group = aggregatedDiscovery(t, router)[cachedGroup]
		require.EqualValues(t, 3, handler.calls.Load())
		requireFreshness(t, group, apidiscoveryv2.DiscoveryFreshnessCurrent)
	})
}

func TestAggregatedDiscoveryDoesNotCacheRefusedFetches(t *testing.T) {
	handler := &countingDiscoveryBackend{group: cachedGroup}
	handler.refuse.Store(true)
	router := discoveryRouter(t, cachedGroup, handler)

	requireFreshness(t, aggregatedDiscovery(t, router)[cachedGroup], apidiscoveryv2.DiscoveryFreshnessStale)
	handler.refuse.Store(false)
	requireFreshness(t, aggregatedDiscovery(t, router)[cachedGroup], apidiscoveryv2.DiscoveryFreshnessCurrent)
	aggregatedDiscovery(t, router)
	require.EqualValues(t, 2, handler.calls.Load())
}

func TestAggregatedDiscoverySharesConcurrentFetches(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		handler := &countingDiscoveryBackend{group: cachedGroup, delay: time.Second}
		router := discoveryRouter(t, cachedGroup, handler)
		var wg sync.WaitGroup
		for range 5 {
			wg.Add(1)
			go func() {
				defer wg.Done()
				aggregatedDiscovery(t, router)
			}()
		}
		wg.Wait()
		require.EqualValues(t, 1, handler.calls.Load())
	})
}

func TestAggregatedDiscoveryDoesNotWaitForSlowBackends(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		const slowGroup = "slow.ext.grafana.app"
		fast := &countingDiscoveryBackend{group: cachedGroup}
		slow := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			<-req.Context().Done()
		})
		router := NewGrafanaRouter(staticLoader{backends: []Backend{
			&fakeBackend{group: metav1.APIGroup{Name: cachedGroup, Versions: []metav1.GroupVersionForDiscovery{{GroupVersion: cachedGroup + "/v1", Version: "v1"}}}, key: "1", handler: fast},
			&fakeBackend{group: metav1.APIGroup{Name: slowGroup, Versions: []metav1.GroupVersionForDiscovery{{GroupVersion: slowGroup + "/v1", Version: "v1"}}}, key: "1", handler: slow},
		}})
		require.NoError(t, router.reconcile(t.Context()))

		start := time.Now()
		groups := aggregatedDiscovery(t, router)
		require.Equal(t, discoveryFetchTimeout, time.Since(start))
		requireFreshness(t, groups[cachedGroup], apidiscoveryv2.DiscoveryFreshnessCurrent)
		requireFreshness(t, groups[slowGroup], apidiscoveryv2.DiscoveryFreshnessStale)
	})
}

func TestDiscoveryCacheDropsRemovedGroups(t *testing.T) {
	handler := &countingDiscoveryBackend{group: cachedGroup}
	router := discoveryRouter(t, cachedGroup, handler)
	aggregatedDiscovery(t, router)
	_, found, _ := router.discoveryCache.lookup(cachedGroup, "plugin-revision")
	require.True(t, found)

	delete(router.served, cachedGroup)
	router.publish(t.Context())
	_, found, _ = router.discoveryCache.lookup(cachedGroup, "plugin-revision")
	require.False(t, found)
}

func TestAggregateBackendKeepsPolledResources(t *testing.T) {
	resources := thingsDiscovery(cachedGroup)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", aggregatedDiscoveryJSON)
		_ = json.NewEncoder(w).Encode(apidiscoveryv2.APIGroupDiscoveryList{
			TypeMeta: metav1.TypeMeta{Kind: "APIGroupDiscoveryList", APIVersion: "apidiscovery.k8s.io/v2"},
			Items:    []apidiscoveryv2.APIGroupDiscovery{resources},
		})
	}))
	t.Cleanup(upstream.Close)
	base, err := url.Parse(upstream.URL)
	require.NoError(t, err)

	discovered, err := discoverGroupResources(t.Context(), upstream.Client(), upstream.URL)
	require.NoError(t, err)
	require.Len(t, discovered, 1)
	backend, err := newDiscoveredAggregateBackend("target", discovered[0], base, http.DefaultTransport)
	require.NoError(t, err)
	d, ok := backend.(DiscoveryProvider).Discovery()
	require.True(t, ok)
	require.Equal(t, resources, d)

	// Resources are part of the key, so a change on the target republishes discovery.
	changed := discovered[0]
	changedDiscovery := *changed.discovery
	changedDiscovery.Versions = nil
	changed.discovery = &changedDiscovery
	other, err := newDiscoveredAggregateBackend("target", changed, base, http.DefaultTransport)
	require.NoError(t, err)
	require.NotEqual(t, backend.Key(), other.Key())

	// Without resources, the key is unchanged from before resources were kept.
	classic, err := newAggregateBackend("target", discovered[0].group, base, http.DefaultTransport)
	require.NoError(t, err)
	groupJSON, err := json.Marshal(discovered[0].group)
	require.NoError(t, err)
	require.Equal(t, "aggregate:target:"+hashHex(string(groupJSON)), classic.Key())
	_, ok = classic.(DiscoveryProvider).Discovery()
	require.False(t, ok)
}

func TestAggregatedDiscoveryDoesNotCacheFailedFetchWithoutVersions(t *testing.T) {
	handler := &countingDiscoveryBackend{group: cachedGroup}
	handler.refuse.Store(true)
	router := NewGrafanaRouter(staticLoader{backends: []Backend{
		&fakeBackend{group: metav1.APIGroup{Name: cachedGroup}, key: "1", handler: handler},
	}})
	require.NoError(t, router.reconcile(t.Context()))

	aggregatedDiscovery(t, router)
	aggregatedDiscovery(t, router)
	require.EqualValues(t, 2, handler.calls.Load(), "a refused fetch must not be cached")

	handler.refuse.Store(false)
	group := aggregatedDiscovery(t, router)[cachedGroup]
	require.Equal(t, "things", group.Versions[0].Resources[0].Resource)
	aggregatedDiscovery(t, router)
	require.EqualValues(t, 3, handler.calls.Load())
}

func TestAggregatedDiscoveryMixesProvidersAndFetchesSafely(t *testing.T) {
	backends := make([]Backend, 0, 40)
	for i := range 20 {
		provided := fmt.Sprintf("provided%d.ext.grafana.app", i)
		backends = append(backends, &providerBackend{
			fakeBackend: fakeBackend{group: metav1.APIGroup{Name: provided}, key: "1"},
			discovery:   thingsDiscovery(provided),
		})
		fetched := fmt.Sprintf("fetched%d.ext.grafana.app", i)
		backends = append(backends, &fakeBackend{group: metav1.APIGroup{Name: fetched}, key: "1", handler: &countingDiscoveryBackend{group: fetched}})
	}
	router := NewGrafanaRouter(staticLoader{backends: backends})
	require.NoError(t, router.reconcile(t.Context()))

	// Warm the cache so later fetches return at once, while provider entries
	// are still being added on the request goroutine.
	aggregatedDiscovery(t, router)
	for range 20 {
		require.Len(t, aggregatedDiscovery(t, router), 40)
	}
}
