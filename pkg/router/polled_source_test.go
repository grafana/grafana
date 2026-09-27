package router

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/k8s"
)

func TestPolledSourceWakesOnlyWhenItsResultChanges(t *testing.T) {
	var backends []Backend
	var fetchErr error
	source := newPolledSource("test", newCooldown(time.Minute, time.Second, time.Minute), func(context.Context) ([]Backend, error) {
		return backends, fetchErr
	})
	woke := func() bool {
		t.Helper()
		dirty := make(chan struct{}, 1)
		source.poll(t.Context(), dirty)
		return len(dirty) == 1
	}

	_, err := source.current()
	require.ErrorIs(t, err, errPollPending)

	backends = []Backend{priorityBackend("a.ext.grafana.app", "1")}
	require.True(t, woke(), "the first poll")
	require.False(t, woke(), "same key set")

	backends = []Backend{priorityBackend("a.ext.grafana.app", "2")}
	require.True(t, woke(), "a key changed")

	fetchErr = errors.New("unavailable")
	require.True(t, woke(), "polls started failing")
	got, err := source.current()
	require.ErrorIs(t, err, fetchErr)
	require.Equal(t, "2", got[0].Key(), "a failed poll keeps the last-known-good backends")
	fetchErr = errors.New("still unavailable")
	require.False(t, woke(), "still failing")

	fetchErr = nil
	require.True(t, woke(), "polls recovered")
	_, err = source.current()
	require.NoError(t, err)
	require.Equal(t, uint64(4), source.sourceStatus().Successes)
	require.Equal(t, uint64(2), source.sourceStatus().Failures)
}

func TestCloudLoaderSourceOrder(t *testing.T) {
	st := newTestSingleTenantFallback(t)
	first := priorityAggregate()
	second := priorityAggregate()
	plugins := &pluginManifestsTarget{polledSource: newPolledSource(sourcePluginsURL, nil, nil)}
	loader := &cloudLoader{
		singleTenantFallback: st,
		aggregateTargets:     []*aggregateTarget{first, second},
		routeBackends:        &routeBackendSource{},
		pluginsTarget:        plugins,
	}
	var order []any
	for _, source := range loader.sources() {
		if polled, ok := source.(polledRouteSource); ok {
			order = append(order, polled.source)
			continue
		}
		order = append(order, source)
	}
	require.Equal(t, []any{st, first, second, loader.routeBackends, plugins}, order)
}

func TestCloudLoaderFailsWhenARouteBackendListFails(t *testing.T) {
	loader := &cloudLoader{
		aggregateTargets: []*aggregateTarget{priorityAggregate(priorityBackend("a.ext.grafana.app", "1"))},
	}
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer api.Close()
	routeBackends, err := newRouteBackendSource(k8s.NewClientRegistry(rest.Config{Host: api.URL}, k8s.ClientConfig{}), make(chan struct{}, 1))
	require.NoError(t, err)
	loader.routeBackends = routeBackends
	_, err = loader.Load(t.Context())
	require.Error(t, err, "a CR source without last-known-good routes fails the load, so the router keeps its routes")

	loader.routeBackends = nil
	backends, err := loader.Load(t.Context())
	require.NoError(t, err)
	require.Equal(t, []metav1.APIGroup{{Name: "a.ext.grafana.app"}}, []metav1.APIGroup{backends[0].Group()})
}
