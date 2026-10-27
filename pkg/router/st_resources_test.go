package router

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestParseSingleTenantResources(t *testing.T) {
	got, err := parseSingleTenantResources(defaultSingleTenantResources)
	require.NoError(t, err)
	require.Equal(t, map[string][]singleTenantResource{
		"dashboard.grafana.app": {
			{version: "v0alpha1", resource: "librarypanels"},
			{version: "v0alpha1", resource: "snapshots"},
		},
	}, got)

	got, err = parseSingleTenantResources(" , ")
	require.NoError(t, err)
	require.Empty(t, got)

	for _, raw := range []string{"dashboard.grafana.app", "dashboard.grafana.app/v0alpha1", "a/b/c/d", "/v0alpha1/snapshots", "a//c"} {
		_, err := parseSingleTenantResources(raw)
		require.Error(t, err, raw)
	}
}

func TestMatchesSingleTenantResource(t *testing.T) {
	resources := []singleTenantResource{{version: "v0alpha1", resource: "librarypanels"}}
	for path, want := range map[string]bool{
		"/apis/dashboard.grafana.app/v0alpha1/namespaces/stacks-1/librarypanels":           true,
		"/apis/dashboard.grafana.app/v0alpha1/namespaces/stacks-1/librarypanels/abc":       true,
		"/apis/dashboard.grafana.app/v0alpha1/namespaces/stacks-1/librarypanels/abc/usage": true,
		"/apis/dashboard.grafana.app/v0alpha1/librarypanels":                               true,
		"/apis/dashboard.grafana.app/v0alpha1/namespaces/stacks-1/dashboards":              false,
		"/apis/dashboard.grafana.app/v1/namespaces/stacks-1/librarypanels":                 false,
		"/apis/dashboard.grafana.app/v0alpha1/namespaces//librarypanels":                   false,
		"/apis/dashboard.grafana.app/v0alpha1/namespaces/stacks-1":                         false,
		"/apis/dashboard.grafana.app/v0alpha1":                                             false,
		"/apis/dashboard.grafana.app":                                                      false,
		"/openapi/v3/apis/dashboard.grafana.app/v0alpha1":                                  false,
	} {
		require.Equal(t, want, matchesSingleTenantResource(resources, path), path)
	}
}

func TestProvideCloudRoutesLoaderFactory_SingleTenantResources(t *testing.T) {
	load := func(t *testing.T, kv map[string]string) (*cloudLoader, error) {
		kv["st_discovery_url"] = "https://play.grafana.org/"
		loader, err := ProvideCloudRoutesLoaderFactory(cfgWithCloudRouterSection(t, kv), PluginDependencies{})
		if err != nil {
			return nil, err
		}
		return loader.(*cloudLoader), nil
	}

	t.Run("defaults", func(t *testing.T) {
		loader, err := load(t, map[string]string{})
		require.NoError(t, err)
		require.Len(t, loader.singleTenantResources["dashboard.grafana.app"], 2)
	})
	t.Run("empty disables", func(t *testing.T) {
		loader, err := load(t, map[string]string{"st_resources": ""})
		require.NoError(t, err)
		require.Empty(t, loader.singleTenantResources)
	})
	t.Run("configured", func(t *testing.T) {
		loader, err := load(t, map[string]string{"st_resources": "folder.grafana.app/v1/folders"})
		require.NoError(t, err)
		require.Equal(t, map[string][]singleTenantResource{
			"folder.grafana.app": {{version: "v1", resource: "folders"}},
		}, loader.singleTenantResources)
	})
	t.Run("invalid", func(t *testing.T) {
		_, err := load(t, map[string]string{"st_resources": "dashboard.grafana.app/snapshots"})
		require.ErrorContains(t, err, "st_resources")
	})
}

// newSingleTenantResourcesLoader returns a cloud loader whose aggregate
// target serves dashboard.grafana.app and folder.grafana.app from mt, with
// the default resources on the stack at stack.
func newSingleTenantResourcesLoader(t *testing.T, mt, stack string) *cloudLoader {
	t.Helper()
	target, err := newAggregateTarget(aggregateTargetConfig{Name: "baas_apiserver", URL: mt}, http.DefaultClient, http.DefaultTransport)
	require.NoError(t, err)
	dashboards := proxyBackend(t, "dashboard.grafana.app", mt, http.DefaultTransport).(*aggregateBackend)
	dashboards.discovery = &apidiscoveryv2.APIGroupDiscovery{ObjectMeta: metav1.ObjectMeta{Name: "dashboard.grafana.app"}}
	backends := []Backend{dashboards, proxyBackend(t, "folder.grafana.app", mt, http.DefaultTransport)}
	target.snapshot.Store(&backends)

	st, err := newSingleTenantFallback(singleTenantFallbackOptions{cacheSize: 10, resolveHost: func(context.Context, int64) (singleTenantStack, error) {
		return singleTenantStack{URL: stack}, nil
	}})
	require.NoError(t, err)
	loader, err := newCloudLoader([]*aggregateTarget{target}, nil, nil, st)
	require.NoError(t, err)
	loader.singleTenantResources, err = parseSingleTenantResources(defaultSingleTenantResources)
	require.NoError(t, err)
	return loader
}

func TestCloudLoaderWrapsSingleTenantResources(t *testing.T) {
	loader := newSingleTenantResourcesLoader(t, "http://mt.invalid", "http://stack.invalid")
	backends, err := loader.Load(t.Context())
	require.NoError(t, err)
	require.Len(t, backends, 2)

	dashboards, ok := backends[0].(*singleTenantResourcesBackend)
	require.True(t, ok, "dashboard.grafana.app must be wrapped")
	inner := dashboards.Backend.(*aggregateBackend)
	require.Equal(t, inner.Key(), dashboards.Key())
	require.Equal(t, inner.Source(), dashboards.Source())
	discovery, ok := dashboards.Discovery()
	require.True(t, ok, "discovery comes from the multi-tenant backend")
	require.Equal(t, "dashboard.grafana.app", discovery.Name)

	_, wrapped := backends[1].(*singleTenantResourcesBackend)
	require.False(t, wrapped, "folder.grafana.app has no single-tenant resources")

	loader.singleTenantFallback = nil
	backends, err = loader.Load(t.Context())
	require.NoError(t, err)
	_, wrapped = backends[0].(*singleTenantResourcesBackend)
	require.False(t, wrapped, "nothing is wrapped without the ST fallback")
}

func TestSingleTenantResourcesBackendForwardsRestrictedGroup(t *testing.T) {
	for _, restricted := range []bool{false, true} {
		wrapped := &singleTenantResourcesBackend{Backend: newRestrictedTestBackend(hiddenGroup, restricted)}
		require.Equal(t, restricted, restrictedBackend(wrapped))
	}
	require.False(t, restrictedBackend(&singleTenantResourcesBackend{Backend: &fakeBackend{}}))
}

func TestRouterServesSingleTenantResourcesFromStack(t *testing.T) {
	mt := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// #nosec G705 -- test-only upstream echoing the path; never rendered by a browser.
		_, _ = w.Write([]byte("mt:" + r.URL.Path))
	}))
	t.Cleanup(mt.Close)
	stack := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
		// #nosec G705 -- test-only upstream echoing the path; never rendered by a browser.
		_, _ = w.Write([]byte("st:" + r.URL.Path))
	}))
	t.Cleanup(stack.Close)

	backends, err := newSingleTenantResourcesLoader(t, mt.URL, stack.URL).Load(t.Context())
	require.NoError(t, err)
	r := NewGrafanaRouter(staticLoader{backends: backends}, nil)
	require.NoError(t, r.reconcile(t.Context()))

	serve := func(path string) *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		r.HandleFunc(rec, newAuthenticatedRequest(http.MethodGet, path, nil), http.NotFoundHandler())
		return rec
	}

	require.Equal(t, "st:/apis/dashboard.grafana.app/v0alpha1/namespaces/stacks-1/snapshots/abc",
		serve("/apis/dashboard.grafana.app/v0alpha1/namespaces/stacks-1/snapshots/abc").Body.String())
	// Enough failures to open the stack's own breaker, which then answers.
	for range breakerOpenAfter - 1 {
		rec := serve("/apis/dashboard.grafana.app/v0alpha1/namespaces/stacks-1/librarypanels")
		require.Equal(t, http.StatusServiceUnavailable, rec.Code)
		require.Equal(t, "st:/apis/dashboard.grafana.app/v0alpha1/namespaces/stacks-1/librarypanels", rec.Body.String())
	}
	require.Equal(t, "backend unavailable\n", serve("/apis/dashboard.grafana.app/v0alpha1/namespaces/stacks-1/librarypanels").Body.String())

	// The stack's failures never reach the multi-tenant group breaker.
	require.Zero(t, r.served["dashboard.grafana.app"].breaker.Counts().Requests)
	for _, path := range []string{
		"/apis/dashboard.grafana.app/v0alpha1/namespaces/stacks-1/dashboards",
		"/apis/dashboard.grafana.app/v1/namespaces/stacks-1/librarypanels",
		"/apis/dashboard.grafana.app/v0alpha1",
	} {
		rec := serve(path)
		require.Equal(t, http.StatusOK, rec.Code, path)
		require.Equal(t, "mt:"+path, rec.Body.String())
	}
	require.Equal(t, uint32(3), r.served["dashboard.grafana.app"].breaker.Counts().Requests)
}
