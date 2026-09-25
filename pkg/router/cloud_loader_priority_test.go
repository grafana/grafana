package router

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/k8s"
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
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case strings.HasSuffix(req.URL.Path, "/routebackends"):
			_, _ = io.WriteString(w, `{"apiVersion":"apps.grafana.app/v1alpha2","kind":"RouteBackendList","items":[{"metadata":{"name":"example","resourceVersion":"1"},"spec":{"mode":"forward","forward":{"url":"https://explicit.example.com","tls":{}}}}]}`)
		case strings.HasSuffix(req.URL.Path, "/appmanifests"):
			_, _ = io.WriteString(w, `{"apiVersion":"apps.grafana.app/v1alpha2","kind":"AppManifestList","items":[{"metadata":{"name":"example","resourceVersion":"1"},"spec":{"appName":"example","group":"shared","versions":[{"name":"v1"}]}}]}`)
		default:
			http.NotFound(w, req)
		}
	}))
	defer api.Close()

	st := newTestSingleTenantFallback(t)
	st.discoveryHost = testFallbackURL(t, "https://discovery.example.com")
	st.transport = testFallbackTransport(func(*http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusOK, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(`{"groups":[{"name":"shared"},{"name":"z-st-only"}]}`))}, nil
	})
	clients := k8s.NewClientRegistry(rest.Config{Host: api.URL}, k8s.ClientConfig{})
	loader, err := newCloudLoader(clients, []*aggregateTarget{
		priorityAggregate(priorityBackend("shared", "first-aggregate"), priorityBackend("a-aggregate-only", "aggregate")),
		priorityAggregate(priorityBackend("shared", "second-aggregate")),
	}, &pluginManifestsTarget{}, st)
	require.NoError(t, err)
	plugins := []Backend{priorityBackend("shared", "plugin"), priorityBackend("p-plugin-only", "plugin")}
	loader.pluginsTarget.snapshot.Store(&plugins)
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
	require.IsType(t, &forwardBackend{}, loadShared())
	loader.routeBackendClient = nil
	require.Equal(t, "second-aggregate", loadShared().Key())
	loader.aggregateTargets = loader.aggregateTargets[:1]
	require.Equal(t, "first-aggregate", loadShared().Key())
	loader.aggregateTargets[0] = priorityAggregate(priorityBackend("a-aggregate-only", "aggregate"))
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

func TestCloudLoaderReadsRouteResourcesFromInformerCache(t *testing.T) {
	items := map[string]struct{ kind, item string }{
		"routebackends": {"RouteBackend", `{"apiVersion":"apps.grafana.app/v1alpha2","kind":"RouteBackend","metadata":{"name":"example","resourceVersion":"1"},"spec":{"mode":"forward","forward":{"url":"https://example.com","tls":{}}}}`},
		"appmanifests":  {"AppManifest", `{"apiVersion":"apps.grafana.app/v1alpha2","kind":"AppManifest","metadata":{"name":"example","resourceVersion":"1"},"spec":{"appName":"example","group":"example.grafana.app","versions":[{"name":"v1"}]}}`},
	}
	var lists atomic.Int32
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		resource, ok := items[req.URL.Path[strings.LastIndex(req.URL.Path, "/")+1:]]
		if !ok {
			http.NotFound(w, req)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		if req.URL.Query().Get("watch") == "" {
			lists.Add(1)
			_, _ = io.WriteString(w, `{"apiVersion":"apps.grafana.app/v1alpha2","kind":"`+resource.kind+`List","metadata":{"resourceVersion":"1"},"items":[`+resource.item+`]}`)
			return
		}
		// A watch-list stream: the initial objects, then the bookmark that
		// marks the end of them. After that the watch stays idle.
		if req.URL.Query().Get("sendInitialEvents") == "true" {
			_, _ = io.WriteString(w, `{"type":"ADDED","object":`+resource.item+"}\n")
			_, _ = io.WriteString(w, `{"type":"BOOKMARK","object":{"apiVersion":"apps.grafana.app/v1alpha2","kind":"`+resource.kind+`","metadata":{"resourceVersion":"1","annotations":{"k8s.io/initial-events-end":"true"}}}}`+"\n")
		}
		w.(http.Flusher).Flush()
		<-req.Context().Done()
	}))
	t.Cleanup(api.Close)

	clients := k8s.NewClientRegistry(rest.Config{Host: api.URL}, k8s.ClientConfig{})
	loader, err := newCloudLoader(clients, nil, nil, nil)
	require.NoError(t, err)

	requireExampleGroup := func() {
		t.Helper()
		backends, err := loader.Load(t.Context())
		require.NoError(t, err)
		require.Len(t, backends, 1)
		require.Equal(t, "example.grafana.app", backends[0].Group().Name)
		require.Equal(t, "1-1", backends[0].Key())
	}

	// Before the informers sync, Load lists both kinds directly.
	requireExampleGroup()
	require.EqualValues(t, 2, lists.Load())

	require.NoError(t, services.StartAndAwaitRunning(t.Context(), loader))
	t.Cleanup(func() {
		require.NoError(t, services.StopAndAwaitTerminated(context.Background(), loader))
	})
	require.Eventually(t, func() bool {
		return loader.rbInformer.SharedIndexInformer.HasSynced() && loader.amInformer.SharedIndexInformer.HasSynced()
	}, 5*time.Second, 10*time.Millisecond)

	// Once synced, reconciles are served from the caches.
	listsAfterSync := lists.Load()
	for range 5 {
		requireExampleGroup()
	}
	require.Equal(t, listsAfterSync, lists.Load())
}
