package router

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// fakeEmbeddedAPIServer stands in for the embedded API server: it lists groups
// in aggregated discovery, each with one version and resource, and answers
// every other request with status.
type fakeEmbeddedAPIServer struct {
	groups []string
	status int
	// failDiscovery fails discovery reads while set.
	failDiscovery  atomic.Bool
	discoveryReads atomic.Int32
	served         atomic.Int32
}

func (f *fakeEmbeddedAPIServer) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	if req.URL.Path != apisPrefix {
		f.served.Add(1)
		w.WriteHeader(f.status)
		return
	}
	f.discoveryReads.Add(1)
	if requester, err := identity.GetRequester(req.Context()); err != nil || requester == nil {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	if f.failDiscovery.Load() {
		w.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	list := apidiscoveryv2.APIGroupDiscoveryList{
		TypeMeta: metav1.TypeMeta{Kind: "APIGroupDiscoveryList", APIVersion: "apidiscovery.k8s.io/v2"},
	}
	for _, group := range f.groups {
		list.Items = append(list.Items, embeddedGroupDiscovery(group))
	}
	w.Header().Set("Content-Type", aggregatedDiscoveryJSON)
	_ = json.NewEncoder(w).Encode(list)
}

func embeddedGroupDiscovery(group string) apidiscoveryv2.APIGroupDiscovery {
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

func embeddedUpstreamFor(handler http.Handler) *embeddedUpstream {
	upstream := &embeddedUpstream{}
	upstream.set(handler)
	return upstream
}

func groupNames(backends []Backend) []string {
	names := make([]string, len(backends))
	for i, b := range backends {
		names[i] = b.Group().Name
	}
	return names
}

func TestEmbeddedLoaderReadsDiscoveryOnce(t *testing.T) {
	server := &fakeEmbeddedAPIServer{groups: []string{"dashboard.grafana.app", "folder.grafana.app"}, status: http.StatusNoContent}
	loader := newEmbeddedLoader(&mutableLoader{}, embeddedUpstreamFor(server))
	for range 3 {
		backends, err := loader.Load(t.Context())
		require.NoError(t, err)
		require.Equal(t, []string{"dashboard.grafana.app", "folder.grafana.app"}, groupNames(backends))
	}
	require.Equal(t, int32(1), server.discoveryReads.Load(), "the embedded server's groups don't change")

	backends, err := loader.Load(t.Context())
	require.NoError(t, err)
	backend := backends[0]
	require.Equal(t, embeddedSource, backend.Source())
	require.Regexp(t, `^embedded:[0-9a-f]{16}$`, backend.Key())
	discovery, ok := backend.(DiscoveryProvider).Discovery()
	require.True(t, ok)
	require.Equal(t, embeddedGroupDiscovery("dashboard.grafana.app"), discovery)
	require.Equal(t, "dashboard.grafana.app/v1", backend.Group().PreferredVersion.GroupVersion)
}

func TestEmbeddedLoaderRetriesAFailedRead(t *testing.T) {
	upstream := &embeddedUpstream{}
	server := &fakeEmbeddedAPIServer{groups: []string{"dashboard.grafana.app"}, status: http.StatusNoContent}
	loader := newEmbeddedLoader(&mutableLoader{}, upstream)

	_, err := loader.Load(t.Context())
	require.ErrorIs(t, err, errEmbeddedNotStarted)

	upstream.set(server)
	server.failDiscovery.Store(true)
	_, err = loader.Load(t.Context())
	require.ErrorContains(t, err, "embedded API server's discovery")

	server.failDiscovery.Store(false)
	backends, err := loader.Load(t.Context())
	require.NoError(t, err)
	require.Equal(t, []string{"dashboard.grafana.app"}, groupNames(backends))
}

// The router takes groups over from the embedded server: a group both serve is
// the base loader's.
func TestEmbeddedLoaderBaseLoaderWins(t *testing.T) {
	server := &fakeEmbeddedAPIServer{groups: []string{"dashboard.grafana.app", "playlist.grafana.app"}, status: http.StatusNoContent}
	routed := &fakeBackend{group: metav1.APIGroup{Name: "playlist.grafana.app"}, key: "routed"}
	loader := newEmbeddedLoader(&mutableLoader{backends: []Backend{routed}}, embeddedUpstreamFor(server))
	backends, err := loader.Load(t.Context())
	require.NoError(t, err)
	require.Equal(t, []string{"dashboard.grafana.app", "playlist.grafana.app"}, groupNames(backends))
	require.Same(t, Backend(routed), backends[1])
}

func TestEmbeddedLoaderReconcilesChangingOverrides(t *testing.T) {
	const group = "playlist.grafana.app"
	server := &fakeEmbeddedAPIServer{groups: []string{group}, status: http.StatusNoContent}
	base := &mutableLoader{}
	router := NewGrafanaRouter(newEmbeddedLoader(base, embeddedUpstreamFor(server)), nil)
	for _, tc := range []struct {
		name   string
		key    string
		status int
	}{
		{name: "embedded", status: http.StatusNoContent},
		{name: "plugin added", key: "plugin-v1", status: http.StatusCreated},
		{name: "plugin updated", key: "plugin-v2", status: http.StatusAccepted},
		{name: "plugin removed", status: http.StatusNoContent},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var backends []Backend
			if tc.key != "" {
				backends = []Backend{&fakeBackend{
					group: metav1.APIGroup{Name: group}, key: tc.key,
					handler: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						w.WriteHeader(tc.status)
					}),
				}}
			}
			base.backends = backends
			require.NoError(t, router.reconcile(t.Context()))
			rec := httptest.NewRecorder()
			router.HandleAPIs().ServeHTTP(rec, newAuthenticatedRequest(http.MethodGet, "/apis/"+group+"/v1/things", nil))
			require.Equal(t, tc.status, rec.Code)
			if tc.key == "" {
				require.Equal(t, embeddedSource, router.served[group].backend.Source())
			} else {
				require.Equal(t, tc.key, router.served[group].backend.Key())
			}
		})
	}
	require.Equal(t, int32(1), server.discoveryReads.Load())
}

// In middleware mode the router serves the embedded server's groups through
// its handler, and lists them in root discovery without asking it again.
func TestMiddlewareServesEmbeddedGroups(t *testing.T) {
	server := &fakeEmbeddedAPIServer{groups: []string{"dashboard.grafana.app"}, status: http.StatusTeapot}
	svc := newService(NewGrafanaRouter(&mutableLoader{}, nil), prometheus.NewRegistry())
	svc.middleware = true
	svc.router.loader = newEmbeddedLoader(svc.router.loader, &svc.upstream)
	svc.SetUpstream(server)
	require.NoError(t, svc.router.reconcile(t.Context()))

	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		t.Fatal("the router serves the /apis tree itself")
	})
	serve := func(target, accept string) *httptest.ResponseRecorder {
		req := newAuthenticatedRequest(http.MethodGet, target, nil)
		if accept != "" {
			req.Header.Set("Accept", accept)
		}
		rec := httptest.NewRecorder()
		svc.HandleFunc(rec, req, next)
		return rec
	}

	require.Equal(t, http.StatusTeapot, serve("/apis/dashboard.grafana.app/v1/namespaces/default/things", "").Code)
	require.Equal(t, int32(1), server.served.Load())

	var list apidiscoveryv2.APIGroupDiscoveryList
	require.NoError(t, json.Unmarshal(serve(apisPrefix, aggregatedDiscoveryJSON).Body.Bytes(), &list))
	names := make([]string, len(list.Items))
	for i, item := range list.Items {
		names[i] = item.Name
	}
	require.Equal(t, []string{"dashboard.grafana.app", discoveryGroup}, names)
	require.Equal(t, embeddedGroupDiscovery("dashboard.grafana.app").Versions[0].Resources[0].Resource, list.Items[0].Versions[0].Resources[0].Resource)
	require.Equal(t, int32(1), server.discoveryReads.Load(), "root discovery comes from the snapshot")
}

// The embedded server runs in this process, so its failures never open a
// group breaker.
func TestEmbeddedGroupsBypassTheBreaker(t *testing.T) {
	server := &fakeEmbeddedAPIServer{groups: []string{"dashboard.grafana.app"}, status: http.StatusServiceUnavailable}
	router := NewGrafanaRouter(newEmbeddedLoader(&mutableLoader{}, embeddedUpstreamFor(server)), nil)
	require.NoError(t, router.reconcile(context.Background()))
	for range 10 {
		rec := httptest.NewRecorder()
		router.HandleFunc(rec, newAuthenticatedRequest(http.MethodGet, "/apis/dashboard.grafana.app/v1/namespaces/default/things", nil))
		require.Equal(t, http.StatusServiceUnavailable, rec.Code)
	}
	require.Equal(t, int32(10), server.served.Load(), "every request reaches the server")
}

// Until the router has loaded the embedded server's groups, the server keeps
// serving them: in-process clients start before the router does.
func TestMiddlewareLeavesRequestsToTheServerUntilReady(t *testing.T) {
	server := &fakeEmbeddedAPIServer{groups: []string{"dashboard.grafana.app"}, status: http.StatusNoContent}
	svc := newService(NewGrafanaRouter(&mutableLoader{}, nil), prometheus.NewRegistry())
	svc.middleware = true
	svc.router.loader = newEmbeddedLoader(svc.router.loader, &svc.upstream)
	serve := func() int {
		rec := httptest.NewRecorder()
		svc.HandleFunc(rec, newAuthenticatedRequest(http.MethodGet, "/apis/dashboard.grafana.app/v1/namespaces/default/things", nil),
			http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusTeapot) }))
		return rec.Code
	}
	require.Equal(t, http.StatusTeapot, serve(), "not ready: the server's")

	svc.SetUpstream(server)
	server.failDiscovery.Store(true)
	require.Error(t, svc.router.reconcile(t.Context()))
	require.Equal(t, http.StatusTeapot, serve(), "failed initial discovery: still the server's")
	server.failDiscovery.Store(false)
	require.NoError(t, svc.router.reconcile(t.Context()))
	require.Equal(t, http.StatusNoContent, serve(), "ready: the router's, through the server's handler")
	require.Equal(t, int32(1), server.served.Load())
}

func TestMiddlewareKeepsRoutedGroupsAfterLosingReadiness(t *testing.T) {
	for name, phase := range map[string]phase{"stopped": stopped, "crashed": crashed} {
		t.Run(name, func(t *testing.T) {
			const group = "playlist.grafana.app"
			server := &fakeEmbeddedAPIServer{groups: []string{group}, status: http.StatusTeapot}
			backend := &fakeBackend{
				group: metav1.APIGroup{Name: group}, key: "routed",
				handler: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
					w.WriteHeader(http.StatusNoContent)
				}),
			}
			svc := newService(NewGrafanaRouter(newEmbeddedLoader(&mutableLoader{backends: []Backend{backend}}, embeddedUpstreamFor(server)), nil), prometheus.NewRegistry())
			svc.middleware = true
			require.NoError(t, svc.router.reconcile(t.Context()))
			svc.router.state.Store(&routerState{phase: phase})
			require.Error(t, svc.router.Ready(t.Context()))

			rec := httptest.NewRecorder()
			svc.HandleFunc(rec, newAuthenticatedRequest(http.MethodGet, "/apis/"+group+"/v1/things", nil), server)
			require.Equal(t, http.StatusNoContent, rec.Code, "losing readiness must not hand the group back to the embedded server")
			require.Zero(t, server.served.Load())
		})
	}
}

// The embedded server's groups have no breaker, which the status page shows as
// none: unlike the single-tenant fallback, nothing breaks per destination.
func TestEmbeddedGroupsReportNoBreaker(t *testing.T) {
	server := &fakeEmbeddedAPIServer{groups: []string{"dashboard.grafana.app"}, status: http.StatusNoContent}
	router := NewGrafanaRouter(newEmbeddedLoader(&mutableLoader{}, embeddedUpstreamFor(server)), nil)
	require.NoError(t, router.reconcile(t.Context()))
	health, breaker := breakerStatus((*router.snapshot.Load())["dashboard.grafana.app"])
	require.Equal(t, "unknown", health)
	require.Equal(t, breakerStatusDoc{Scope: "none"}, breaker)
}

// A watch on an embedded group streams through the router like any other,
// ends when the client leaves, and ends cleanly when the service stops.
func TestMiddlewareWatchesEmbeddedGroups(t *testing.T) {
	discovery := &fakeEmbeddedAPIServer{groups: []string{watchGroup}}
	backend := newWatchBackend()
	t.Cleanup(func() {
		select {
		case <-backend.release:
		default:
			close(backend.release)
		}
	})
	svc := newService(NewGrafanaRouter(&mutableLoader{}, nil), prometheus.NewRegistry())
	svc.middleware = true
	svc.router.loader = newEmbeddedLoader(svc.router.loader, &svc.upstream)
	svc.SetUpstream(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if req.URL.Path == apisPrefix {
			discovery.ServeHTTP(w, req)
			return
		}
		backend.ServeHTTP(w, req)
	}))
	require.NoError(t, svc.router.reconcile(t.Context()))
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		req = req.WithContext(identity.WithRequester(req.Context(), &identity.StaticRequester{Namespace: "stacks-1", AccessToken: "access"}))
		svc.HandleFunc(w, req, http.NotFoundHandler())
	}))
	t.Cleanup(server.Close)

	t.Run("streams events and cancels upstream when the client leaves", func(t *testing.T) {
		ctx, cancel := context.WithCancel(t.Context())
		events := openWatch(ctx, t, server.URL+watchPath+"?watch=true")
		requireEvent(t, events, addedEvent)
		backend.events <- modifiedEvent
		requireEvent(t, events, modifiedEvent)
		cancel()
		select {
		case <-backend.gone:
		case <-time.After(5 * time.Second):
			t.Fatal("the embedded watch was not canceled")
		}
	})

	t.Run("ends when the service stops", func(t *testing.T) {
		events := openWatch(t.Context(), t, server.URL+watchPath+"?watch=true")
		requireEvent(t, events, addedEvent)
		require.NoError(t, svc.stopping(nil))
		requireCleanEnd(t, events)
	})
}
