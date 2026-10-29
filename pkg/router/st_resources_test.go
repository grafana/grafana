package router

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/http/httputil"
	"testing"
	"time"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func TestResourceFromPath(t *testing.T) {
	for path, want := range map[string]string{
		"/apis/dashboard.grafana.app/v0alpha1/namespaces/stacks-1/librarypanels":           "librarypanels",
		"/apis/dashboard.grafana.app/v0alpha1/namespaces/stacks-1/librarypanels/abc":       "librarypanels",
		"/apis/dashboard.grafana.app/v0alpha1/namespaces/stacks-1/librarypanels/abc/usage": "librarypanels",
		"/apis/dashboard.grafana.app/v1/librarypanels":                                     "librarypanels",
		"/apis/dashboard.grafana.app/v0alpha1/namespaces/stacks-1/dashboards":              "dashboards",
		"/apis/dashboard.grafana.app/v0alpha1/namespaces//librarypanels":                   "",
		"/apis/dashboard.grafana.app/v0alpha1/namespaces/stacks-1":                         "",
		"/apis/dashboard.grafana.app/v0alpha1/":                                            "",
		"/apis/dashboard.grafana.app/v0alpha1":                                             "",
		"/apis/dashboard.grafana.app":                                                      "",
		"/openapi/v3/apis/dashboard.grafana.app/v0alpha1":                                  "",
	} {
		got, ok := resourceFromPath(path)
		require.Equal(t, want, got, path)
		require.Equal(t, want != "", ok, path)
	}
}

func TestSingleTenantResourcesHandlerFor(t *testing.T) {
	mt, st := &httputil.ReverseProxy{}, &httputil.ReverseProxy{}
	h := &singleTenantResourcesHandler{next: mt, st: st}
	const dashboards = "/apis/dashboard.grafana.app/v1/namespaces/stacks-1/dashboards/abc"
	const snapshots = "/apis/dashboard.grafana.app/v0alpha1/namespaces/stacks-1/snapshots/abc"

	withIdentity := func(req *http.Request, typ types.IdentityType) *http.Request {
		return req.WithContext(identity.WithRequester(req.Context(), &identity.StaticRequester{Type: typ, Namespace: "stacks-1"}))
	}
	for _, tc := range []struct {
		name     string
		method   string
		path     string
		identity types.IdentityType // "" for none
		wantST   bool
	}{
		{name: "user read", method: http.MethodGet, path: dashboards, identity: types.TypeUser},
		{name: "user head", method: http.MethodHead, path: dashboards, identity: types.TypeUser},
		{name: "user discovery", method: http.MethodGet, path: "/apis/dashboard.grafana.app/v1", identity: types.TypeUser},
		{name: "user create", method: http.MethodPost, path: "/apis/dashboard.grafana.app/v1/namespaces/stacks-1/dashboards", identity: types.TypeUser, wantST: true},
		{name: "user update", method: http.MethodPut, path: dashboards, identity: types.TypeUser, wantST: true},
		{name: "user patch", method: http.MethodPatch, path: dashboards, identity: types.TypeUser, wantST: true},
		{name: "user delete", method: http.MethodDelete, path: dashboards, identity: types.TypeUser, wantST: true},
		{name: "access policy read", method: http.MethodGet, path: dashboards, identity: types.TypeAccessPolicy},
		{name: "no identity read", method: http.MethodGet, path: dashboards},
		{name: "access policy write", method: http.MethodPut, path: dashboards, identity: types.TypeAccessPolicy},
		{name: "service account write", method: http.MethodPut, path: dashboards, identity: types.TypeServiceAccount},
		{name: "no identity write", method: http.MethodPut, path: dashboards},
		{name: "user snapshot read", method: http.MethodGet, path: snapshots, identity: types.TypeUser, wantST: true},
		{name: "access policy snapshot read", method: http.MethodGet, path: snapshots, identity: types.TypeAccessPolicy, wantST: true},
		{name: "access policy library panel write", method: http.MethodPost, path: "/apis/dashboard.grafana.app/v1/librarypanels", identity: types.TypeAccessPolicy, wantST: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, tc.path, nil)
			if tc.identity != "" {
				req = withIdentity(req, tc.identity)
			}
			want := mt
			if tc.wantST {
				want = st
			}
			require.Same(t, want, h.handlerFor(req))
		})
	}
}

// newSingleTenantResourcesLoader returns a cloud loader whose aggregate
// target serves dashboard.grafana.app and folder.grafana.app from mt, with
// the ST fallback on the stack at stack.
func newSingleTenantResourcesLoader(t *testing.T, mt, stack string) *cloudLoader {
	t.Helper()
	target, err := newAggregateTarget(aggregateTargetConfig{Name: "baas_apiserver", URL: mt}, http.DefaultClient, http.DefaultTransport)
	require.NoError(t, err)
	dashboards := proxyBackend(t, "dashboard.grafana.app", mt, http.DefaultTransport).(*aggregateBackend)
	dashboards.discovery = &apidiscoveryv2.APIGroupDiscovery{ObjectMeta: metav1.ObjectMeta{Name: "dashboard.grafana.app"}}
	storeBackends(&target.polledSource, dashboards, proxyBackend(t, "folder.grafana.app", mt, http.DefaultTransport))
	target.status.recordSuccess(time.Now())

	st, err := newSingleTenantFallback(singleTenantFallbackOptions{cacheSize: 10, resolveHost: func(context.Context, int64) (singleTenantStack, error) {
		return singleTenantStack{URL: stack}, nil
	}})
	require.NoError(t, err)
	st.status.recordSuccess(time.Now())
	loader, err := newCloudLoader([]*aggregateTarget{target}, nil, nil, st)
	require.NoError(t, err)
	return loader
}

func TestCloudLoaderWrapsSingleTenantResources(t *testing.T) {
	loader := newSingleTenantResourcesLoader(t, "http://mt.invalid", "http://stack.invalid")
	backends, err := loader.Load(t.Context())
	require.NoError(t, err)
	require.Len(t, backends, 2)

	dashboards, ok := backends[0].(*wrappedBackend)
	require.True(t, ok, "dashboard.grafana.app must be wrapped")
	inner := dashboards.Backend.(*aggregateBackend)
	require.Equal(t, inner.Key(), dashboards.Key())
	require.Equal(t, inner.Source(), dashboards.Source())
	discovery, ok := dashboards.Discovery()
	require.True(t, ok, "discovery comes from the multi-tenant backend")
	require.Equal(t, "dashboard.grafana.app", discovery.Name)

	_, wrapped := backends[1].(*wrappedBackend)
	require.False(t, wrapped, "only dashboard.grafana.app is wrapped")

	loader, err = newCloudLoader(aggregateTargetsOf(loader), nil, nil, nil)
	require.NoError(t, err)
	backends, err = loader.Load(t.Context())
	require.NoError(t, err)
	_, wrapped = backends[0].(*wrappedBackend)
	require.False(t, wrapped, "nothing is wrapped without the ST fallback")
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

	serveMethod := func(method, path string) *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		r.HandleFunc(rec, newAuthenticatedRequest(method, path, nil))
		return rec
	}
	serve := func(path string) *httptest.ResponseRecorder {
		return serveMethod(http.MethodGet, path)
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
		"/apis/dashboard.grafana.app/v1/namespaces/stacks-1/dashboards/abc",
		"/apis/dashboard.grafana.app/v0alpha1",
	} {
		rec := serve(path)
		require.Equal(t, http.StatusOK, rec.Code, path)
		require.Equal(t, "mt:"+path, rec.Body.String())
	}
	require.Equal(t, uint32(3), r.served["dashboard.grafana.app"].breaker.Counts().Requests)

	// A user's write goes to the stack, whose breaker is open by now.
	rec := serveMethod(http.MethodPut, "/apis/dashboard.grafana.app/v1/namespaces/stacks-1/dashboards/abc")
	require.Equal(t, "backend unavailable\n", rec.Body.String())
	require.Equal(t, uint32(3), r.served["dashboard.grafana.app"].breaker.Counts().Requests)
}

// The split reports the breaker scope of the backend that owns the group,
// whatever that backend is, and never the stacks' per-destination breakers.
func TestSingleTenantResourcesBreakerScope(t *testing.T) {
	st := newTestSingleTenantFallback(t)
	require.Equal(t, breakerScopePerDestination, groupBreakerScope(st))
	for _, tc := range []struct {
		next http.Handler
		want breakerScope
	}{
		{next: http.NotFoundHandler(), want: breakerScopeRequests},
		{next: &tracedPluginHandler{}, want: breakerScopePluginCalls},
		{next: embeddedHandler{}, want: breakerScopeNone},
	} {
		require.Equal(t, tc.want, groupBreakerScope(&singleTenantResourcesHandler{next: tc.next, st: st}))
	}
}
