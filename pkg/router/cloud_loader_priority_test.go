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

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func priorityBackend(group, source string) Backend {
	return &fakeBackend{group: metav1.APIGroup{Name: group}, key: source}
}

func priorityAggregate(backends ...Backend) *aggregateTarget {
	target := testAggregateTarget("")
	storeBackends(&target.polledSource, backends...)
	target.status.recordSuccess(time.Now())
	return target
}

// testAggregateTarget returns a target that is never polled.
func testAggregateTarget(name string) *aggregateTarget {
	target := &aggregateTarget{name: name}
	target.polledSource = polledSource{source: aggregateSource(name), fetcher: target}
	return target
}

// storeBackends stores backends as the latest successful poll.
func storeBackends(source *polledSource, backends ...Backend) {
	source.snapshot.Store(&polledSnapshot{backends: backends})
}

// aggregateTargetsOf returns the loader's aggregate targets, in priority order.
func aggregateTargetsOf(l *cloudLoader) []*aggregateTarget {
	var targets []*aggregateTarget
	for _, source := range l.sources {
		if target, ok := source.fetcher.(*aggregateTarget); ok {
			targets = append(targets, target)
		}
	}
	return targets
}

// pluginManifestsTargetOf returns the loader's plugin manifests target for
// source, or nil.
func pluginManifestsTargetOf(l *cloudLoader, source string) *pluginManifestsTarget {
	for _, s := range l.sources {
		if target, ok := s.fetcher.(*pluginManifestsTarget); ok && target.source == source {
			return target
		}
	}
	return nil
}

func testPluginManifestsTarget(source string, backends ...Backend) *pluginManifestsTarget {
	target := &pluginManifestsTarget{}
	target.polledSource = polledSource{source: source, fetcher: target}
	storeBackends(&target.polledSource, backends...)
	target.status.recordSuccess(time.Now())
	return target
}

func TestCloudLoaderSourcePriority(t *testing.T) {
	st := newTestSingleTenantFallback(t)
	st.discoveryHost = testFallbackURL(t, "https://discovery.example.com")
	st.transport = testFallbackTransport(func(*http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusOK, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(`{"groups":[{"name":"shared"},{"name":"z-st-only"}]}`))}, nil
	})
	first := priorityAggregate(priorityBackend("shared", "first-aggregate"), priorityBackend("a-aggregate-only", "aggregate"))
	second := priorityAggregate(priorityBackend("shared", "second-aggregate"))
	plugins := testPluginManifestsTarget(sourcePluginsURL, priorityBackend("shared", "plugin"), priorityBackend("p-plugin-only", "plugin"))
	core := testPluginManifestsTarget(sourceCoreURL, priorityBackend("shared", "core"), priorityBackend("c-core-only", "core"))
	bridge := testPluginManifestsTarget(sourceBridgeURL, priorityBackend("shared", "bridge"), priorityBackend("b-bridge-only", "bridge"))
	pollDiscovery(t, st)

	loadShared := func(aggregates []*aggregateTarget, targets ...*pluginManifestsTarget) Backend {
		t.Helper()
		loader, err := newCloudLoader(aggregates, targets, st)
		require.NoError(t, err)
		backends, err := loader.Load(t.Context())
		require.NoError(t, err)
		names := make([]string, len(backends))
		var shared Backend
		for i, backend := range backends {
			names[i] = backend.Group().Name
			if backend.Group().Name == "shared" {
				shared = backend
			}
		}
		require.IsIncreasing(t, names)
		require.Contains(t, names, "z-st-only")
		require.Contains(t, names, "a-aggregate-only")
		require.NotNil(t, shared)
		return shared
	}
	aggregates := []*aggregateTarget{first, second}
	require.Equal(t, "plugin", loadShared(aggregates, plugins, core, bridge).Key())
	require.Equal(t, "core", loadShared(aggregates, core, bridge).Key())
	require.Equal(t, "bridge", loadShared(aggregates, bridge).Key())
	require.Equal(t, "first-aggregate", loadShared(aggregates).Key())
	aggregates[0] = priorityAggregate(priorityBackend("a-aggregate-only", "aggregate"))
	require.Equal(t, "second-aggregate", loadShared(aggregates).Key())
	require.IsType(t, &fallbackBackend{}, loadShared(aggregates[:1]))
}

func TestCloudLoaderSingleTenantDiscoveryFailure(t *testing.T) {
	st := newTestSingleTenantFallback(t)
	st.discoveryHost = testFallbackURL(t, "https://discovery.example.com")
	fail := true
	body := `{"groups":[{"name":"st-only"},{"name":"shared"}]}`
	st.transport = testFallbackTransport(func(*http.Request) (*http.Response, error) {
		if fail {
			return nil, errors.New("discovery unavailable")
		}
		return &http.Response{StatusCode: http.StatusOK, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(body))}, nil
	})
	loader, err := newCloudLoader(nil, nil, st)
	require.NoError(t, err)
	_, err = loader.Load(t.Context())
	require.ErrorIs(t, err, errFirstPollPending)
	pollDiscovery(t, st)
	_, err = loader.Load(t.Context())
	require.ErrorContains(t, err, "discovery unavailable")

	mt := priorityAggregate(priorityBackend("shared", "mt-v1"))
	stOnly := loader
	loader, err = newCloudLoader([]*aggregateTarget{mt}, nil, st)
	require.NoError(t, err)
	backends, err := loader.Load(t.Context())
	require.NoError(t, err)
	require.Len(t, backends, 1)
	require.Equal(t, "mt-v1", backends[0].Key())

	fail = false
	pollDiscovery(t, st)
	backends, err = loader.Load(t.Context())
	require.NoError(t, err)
	require.Len(t, backends, 2)
	lastSTKey := backends[1].Key()
	fail = true
	pollDiscovery(t, st)
	storeBackends(&mt.polledSource, priorityBackend("shared", "mt-v2"))
	backends, err = loader.Load(t.Context())
	require.NoError(t, err)
	require.Len(t, backends, 2)
	require.Equal(t, "mt-v2", backends[0].Key())
	require.Equal(t, lastSTKey, backends[1].Key())

	loader = stOnly
	backends, err = loader.Load(t.Context())
	require.NoError(t, err)
	require.Len(t, backends, 2)
	require.IsType(t, &fallbackBackend{}, backends[0])

	fail = false
	body = `{"groups":[]}`
	pollDiscovery(t, st)
	backends, err = loader.Load(context.Background())
	require.NoError(t, err)
	require.Empty(t, backends)
	fail = true
	pollDiscovery(t, st)
	_, err = loader.Load(t.Context())
	require.Error(t, err)
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
	aggregate := testAggregateTarget("baas_apiserver")
	storeBackends(&aggregate.polledSource, shared)
	aggregate.status.recordSuccess(time.Now())
	loader, err := newCloudLoader([]*aggregateTarget{aggregate}, nil, st)
	require.NoError(t, err)

	pollDiscovery(t, st)
	backends, err := loader.Load(t.Context())
	require.NoError(t, err)
	require.Len(t, backends, 2)
	// The aggregate target overriding the fallback is expected, not shadowing.
	require.Empty(t, loader.shadowedGroups())

	// Statuses are listed in priority order, highest first.
	statuses := loader.sourceStatuses()
	require.Len(t, statuses, 2)
	require.Equal(t, "aggregate:baas_apiserver", statuses[0].Source)
	require.Equal(t, uint64(1), statuses[0].Successes, "Load serves only once every source has polled")
	require.Equal(t, sourceSingleTenant, statuses[1].Source)
	require.False(t, statuses[1].LastSuccess.IsZero())
	require.Equal(t, uint64(1), statuses[1].Successes)

	fail = true
	pollDiscovery(t, st)
	statuses = loader.sourceStatuses()
	require.False(t, statuses[1].LastSuccess.IsZero(), "the last success is kept after a failure")
	require.Equal(t, uint64(1), statuses[1].Failures)
}

// The router isn't ready until every source has polled once: a source that
// hasn't has an empty snapshot that is not an error, and serving it would
// leave its groups out of discovery. A failed first poll ends the wait too.
func TestCloudLoaderWaitsForEverySourcesFirstPoll(t *testing.T) {
	polled := testAggregateTarget("polled")
	storeBackends(&polled.polledSource, priorityBackend("polled.ext.grafana.app", "polled"))
	polled.status.recordSuccess(time.Now())
	slow := testAggregateTarget("slow")
	loader, err := newCloudLoader([]*aggregateTarget{polled, slow}, nil, nil)
	require.NoError(t, err)
	router := NewGrafanaRouter(loader, nil)

	err = router.reconcile(t.Context())
	require.ErrorIs(t, err, errFirstPollPending)
	require.ErrorContains(t, err, "aggregate:slow")
	require.Error(t, router.Ready(t.Context()))

	require.True(t, slow.status.recordFailure(), "the first failed attempt is reported")
	require.False(t, slow.status.recordFailure())
	err = router.reconcile(t.Context())
	require.NoError(t, err)
	require.NoError(t, router.Ready(t.Context()))
	require.Contains(t, router.served, "polled.ext.grafana.app")
}
