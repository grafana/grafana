package router

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func priorityBackend(group, source string) Backend {
	return &fakeBackend{group: metav1.APIGroup{Name: group}, key: source}
}

func priorityAggregate(backends ...Backend) *aggregateTarget {
	target := &aggregateTarget{}
	target.snapshot.Store(&backends)
	return target
}

func TestCloudLoaderSourcePriority(t *testing.T) {
	st := newTestSingleTenantFallback(t)
	st.discoveryHost = testFallbackURL(t, "https://discovery.example.com")
	st.transport = testFallbackTransport(func(*http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusOK, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(`{"groups":[{"name":"shared"},{"name":"z-st-only"}]}`))}, nil
	})
	loader, err := newCloudLoader([]*aggregateTarget{
		priorityAggregate(priorityBackend("shared", "first-aggregate"), priorityBackend("a-aggregate-only", "aggregate")),
		priorityAggregate(priorityBackend("shared", "second-aggregate")),
	}, &pluginManifestsTarget{}, &pluginManifestsTarget{}, st)
	require.NoError(t, err)
	plugins := []Backend{priorityBackend("shared", "plugin"), priorityBackend("p-plugin-only", "plugin")}
	loader.pluginsTarget.snapshot.Store(&plugins)
	core := []Backend{priorityBackend("shared", "core"), priorityBackend("c-core-only", "core")}
	loader.coreTarget.snapshot.Store(&core)
	pollDiscovery(t, st)

	loadShared := func() Backend {
		t.Helper()
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
	require.Equal(t, "plugin", loadShared().Key())
	loader.pluginsTarget = nil
	require.Equal(t, "core", loadShared().Key())
	loader.coreTarget = nil
	require.Equal(t, "first-aggregate", loadShared().Key())
	loader.aggregateTargets[0] = priorityAggregate(priorityBackend("a-aggregate-only", "aggregate"))
	require.Equal(t, "second-aggregate", loadShared().Key())
	loader.aggregateTargets = loader.aggregateTargets[:1]
	require.IsType(t, &fallbackBackend{}, loadShared())
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
	loader, err := newCloudLoader(nil, nil, nil, st)
	require.NoError(t, err)
	_, err = loader.Load(t.Context())
	require.ErrorIs(t, err, errSingleTenantDiscoveryPending)
	pollDiscovery(t, st)
	_, err = loader.Load(t.Context())
	require.ErrorContains(t, err, "discovery unavailable")

	mt := priorityAggregate(priorityBackend("shared", "mt-v1"))
	loader.aggregateTargets = []*aggregateTarget{mt}
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
	updated := []Backend{priorityBackend("shared", "mt-v2")}
	mt.snapshot.Store(&updated)
	backends, err = loader.Load(t.Context())
	require.NoError(t, err)
	require.Len(t, backends, 2)
	require.Equal(t, "mt-v2", backends[0].Key())
	require.Equal(t, lastSTKey, backends[1].Key())

	loader.aggregateTargets = nil
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
	aggregate := priorityAggregate(shared)
	aggregate.name = "baas_apiserver"
	loader, err := newCloudLoader([]*aggregateTarget{aggregate}, nil, nil, st)
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
	require.Equal(t, uint64(1), statuses[0].Successes)
	require.Equal(t, sourceStatus{Source: "aggregate:baas_apiserver"}, statuses[1], "never polled")

	fail = true
	pollDiscovery(t, st)
	statuses = loader.sourceStatuses()
	require.False(t, statuses[0].LastSuccess.IsZero(), "the last success is kept after a failure")
	require.Equal(t, uint64(1), statuses[0].Failures)
}
