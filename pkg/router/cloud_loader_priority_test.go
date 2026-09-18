package router

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

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
	require.ErrorContains(t, err, "discovery unavailable")

	mt := priorityAggregate(priorityBackend("shared", "mt-v1"))
	loader.aggregateTargets = []*aggregateTarget{mt}
	backends, err := loader.Load(t.Context())
	require.NoError(t, err)
	require.Len(t, backends, 1)
	require.Equal(t, "mt-v1", backends[0].Key())

	fail = false
	backends, err = loader.Load(t.Context())
	require.NoError(t, err)
	require.Len(t, backends, 2)
	lastSTKey := backends[1].Key()
	fail = true
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
	backends, err = loader.Load(context.Background())
	require.NoError(t, err)
	require.Empty(t, backends)
	fail = true
	_, err = loader.Load(t.Context())
	require.Error(t, err)
}
