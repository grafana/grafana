package router

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/endpoints/request"
)

// stubLoader satisfies RoutesLoader; the routing tests seed the snapshot
// directly and never call Load/Notify.
type stubLoader struct{}

func (stubLoader) Load(context.Context) ([]Backend, error)         { return nil, nil }
func (stubLoader) Notify(context.Context) (<-chan struct{}, error) { return make(chan struct{}), nil }

// withGroups builds a router and seeds its snapshot with a handler per group
// that writes the group name, so tests can assert which group served.
func withGroups(groups ...string) *GrafanaRouter {
	s := NewGrafanaRouter(stubLoader{}, nil)
	for _, g := range groups {
		s.served[g] = &handlerEntry{
			handler: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				_, _ = w.Write([]byte(g))
			}),
			lastKey: "1",
			breaker: newGroupBreaker(g),
		}
	}
	s.publish(context.Background())
	return s
}

// HandleFunc serves req with the handler for its tree.
func (r *GrafanaRouter) HandleFunc(w http.ResponseWriter, req *http.Request) {
	r.handleTree(w, req)
}

// handleTree serves req with the handler for its tree, and answers a request
// in neither tree as not found.
func (r *GrafanaRouter) handleTree(w http.ResponseWriter, req *http.Request) {
	handle, _ := r.handlerFor(req.URL.Path)
	if handle == nil {
		serveNotFound(w, req)
		return
	}
	handle(w, req)
}

func TestHandleTrees(t *testing.T) {
	s := withGroups("example")
	s.served["example"].handler = http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
	s.publish(context.Background())

	for _, tc := range []struct {
		name    string
		handler http.Handler
		path    string
		code    int
	}{
		{name: "apis serves a group", handler: s.HandleAPIs(), path: "/apis/example/v1", code: http.StatusNoContent},
		{name: "apis serves root discovery", handler: s.HandleAPIs(), path: "/apis", code: http.StatusOK},
		{name: "apis rejects openapi", handler: s.HandleAPIs(), path: "/openapi/v3", code: http.StatusNotFound},
		{name: "apis rejects a lookalike prefix", handler: s.HandleAPIs(), path: "/apisx/example/v1", code: http.StatusNotFound},
		{name: "openapi serves the index", handler: s.HandleOpenAPIv3(), path: "/openapi/v3", code: http.StatusOK},
		{name: "openapi rejects apis", handler: s.HandleOpenAPIv3(), path: "/apis/example/v1", code: http.StatusNotFound},
	} {
		t.Run(tc.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			tc.handler.ServeHTTP(rec, newAuthenticatedRequest(http.MethodGet, tc.path, nil))
			require.Equal(t, tc.code, rec.Code)
		})
	}
}

func TestHandleFuncRequestInfo(t *testing.T) {
	for _, tc := range []struct {
		name string
		path string
		verb string
	}{
		{name: "get", path: "/apis/example/v1/namespaces/default/widgets/foo/status", verb: "get"},
		{name: "list", path: "/apis/example/v1/namespaces/default/widgets", verb: "list"},
		{name: "watch", path: "/apis/example/v1/namespaces/default/widgets?watch=true", verb: "watch"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			router := withGroups("example")
			called := false
			router.served["example"].handler = http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
				called = true
				info, ok := request.RequestInfoFrom(req.Context())
				require.True(t, ok)
				require.True(t, info.IsResourceRequest)
				require.Equal(t, "example", info.APIGroup)
				require.Equal(t, "v1", info.APIVersion)
				require.Equal(t, "default", info.Namespace)
				require.Equal(t, "widgets", info.Resource)
				require.Equal(t, tc.verb, info.Verb)
				if tc.name == "get" {
					require.Equal(t, "foo", info.Name)
					require.Equal(t, "status", info.Subresource)
				}
				w.WriteHeader(http.StatusNoContent)
			})
			router.publish(context.Background())
			rec := httptest.NewRecorder()
			router.HandleFunc(rec, newAuthenticatedRequest(http.MethodGet, tc.path, nil))
			require.True(t, called)
			require.Equal(t, http.StatusNoContent, rec.Code)
		})
	}
}

func TestHandleFuncInvalidRequestInfo(t *testing.T) {
	router := withGroups("example")
	rec := httptest.NewRecorder()
	router.HandleFunc(rec, newAuthenticatedRequest(http.MethodGet, "/apis/example/v1/watch", nil))
	require.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestHandleFuncRoutesByGroup(t *testing.T) {
	s := withGroups("dashboard.grafana.app", "folder.grafana.app")
	h := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		s.HandleFunc(w, req)
	})

	cases := []struct {
		path     string
		wantBody string
		wantCode int
	}{
		// group discovery and resource paths both proxy to the owning backend
		{"/apis/dashboard.grafana.app", "dashboard.grafana.app", http.StatusOK},
		{"/apis/dashboard.grafana.app/v1alpha1/dashboards", "dashboard.grafana.app", http.StatusOK},
		{"/apis/folder.grafana.app/v0alpha1", "folder.grafana.app", http.StatusOK},
		{"/apis/unknown.grafana.app/v1/x", "", http.StatusNotFound},
		{"/healthz", "", http.StatusNotFound},
		// /openapi/v3 root is router-synthesized. Body/ETag checked separately
		// in TestServeRootDocsWithETag. The per-group-version subpath isn't
		// covered here — withGroups' fake handlers don't serve real OpenAPI
		// bytes, so there's nothing meaningful to assert on that path with
		// this fixture; see openapi_cache_test.go.
		{"/openapi/v3", "", http.StatusOK},
	}
	for _, tc := range cases {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, newAuthenticatedRequest(http.MethodGet, tc.path, nil))
		if rec.Code != tc.wantCode {
			t.Errorf("path %q: got code %d, want %d", tc.path, rec.Code, tc.wantCode)
		}
		if tc.wantBody != "" && rec.Body.String() != tc.wantBody {
			t.Errorf("path %q: got body %q, want %q", tc.path, rec.Body.String(), tc.wantBody)
		}
	}
}

// TestHandleFuncRootDiscoveryNotProxied pins that the /apis root is synthesized
// router-side, not dispatched to any group.
func TestHandleFuncRootDiscoveryNotProxied(t *testing.T) {
	s := withGroups("dashboard.grafana.app")
	h := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		s.HandleFunc(w, req)
	})

	for _, path := range []string{"/apis", "/apis/"} {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, newAuthenticatedRequest(http.MethodGet, path, nil))
		if rec.Code != http.StatusOK {
			t.Errorf("path %q: got code %d, want 200; root discovery must be router-owned", path, rec.Code)
		}
	}
}

// TestServeRootDocsWithETag pins that both router-synthesized root documents
// (/apis and /openapi/v3) set an ETag and honor conditional GET with 304.
func TestServeRootDocsWithETag(t *testing.T) {
	s := withGroups("dashboard.grafana.app")
	h := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		s.HandleFunc(w, req)
	})

	for _, path := range []string{"/apis", "/openapi/v3"} {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, newAuthenticatedRequest(http.MethodGet, path, nil))
		if rec.Code != http.StatusOK {
			t.Fatalf("path %q: got code %d, want 200", path, rec.Code)
		}
		etag := rec.Header().Get("ETag")
		if etag == "" {
			t.Fatalf("path %q: missing ETag header", path)
		}

		// Conditional GET with the returned ETag must 304 with no body.
		rec2 := httptest.NewRecorder()
		req2 := newAuthenticatedRequest(http.MethodGet, path, nil)
		req2.Header.Set("If-None-Match", etag)
		h.ServeHTTP(rec2, req2)
		if rec2.Code != http.StatusNotModified {
			t.Errorf("path %q: got code %d with matching If-None-Match, want 304", path, rec2.Code)
		}
		if rec2.Body.Len() != 0 {
			t.Errorf("path %q: 304 response had a body: %q", path, rec2.Body.String())
		}
	}
}

func TestRequestGroup(t *testing.T) {
	cases := []struct {
		path      string
		wantGroup string
	}{
		{"/apis/dashboard.grafana.app", "dashboard.grafana.app"},
		{"/apis/dashboard.grafana.app/v1alpha1/dashboards", "dashboard.grafana.app"},
		{"/apis/dashboard.grafana.app/", "dashboard.grafana.app"},
		// an OpenAPI document is served by its group's backend
		{"/openapi/v3/apis/dashboard.grafana.app/v1alpha1", "dashboard.grafana.app"},
		// no single group to attribute the bare /apis root to
		{"/apis", ""},
		{"/apis/", ""},
		// the router's own discovery tree
		{"/apis/discovery/v1alpha2", ""},
		// not under /apis at all
		{"/openapi/v3", ""},
		{"/healthz", ""},
		{"", ""},
		// prefix collision, not a real /apis boundary
		{"/apisfoo", ""},
		// arbitrary, client-controlled -- requestGroup doesn't validate
		// against known backends, callers must check KnownGroup themselves
		{"/apis/whatever-a-client-sends", "whatever-a-client-sends"},
		// not a valid group name, so not a group any backend could serve
		{"/apis/Not_A.Group/v1", ""},
	}
	for _, tc := range cases {
		req := httptest.NewRequest(http.MethodGet, "http://router"+tc.path, nil)
		if got := requestGroupOf(req); got != tc.wantGroup {
			t.Errorf("requestGroup(%q) = %q, want %q", tc.path, got, tc.wantGroup)
		}
	}
}

func TestKnownGroup(t *testing.T) {
	s := withGroups("dashboard.grafana.app", "folder.grafana.app")

	cases := []struct {
		group string
		want  bool
	}{
		{"dashboard.grafana.app", true},
		{"folder.grafana.app", true},
		{"unknown.grafana.app", false},
		{"", false},
	}
	for _, tc := range cases {
		if got := s.KnownGroup(tc.group); got != tc.want {
			t.Errorf("KnownGroup(%q) = %v, want %v", tc.group, got, tc.want)
		}
	}
}

func TestParseOpenAPIGroupVersionPath(t *testing.T) {
	cases := []struct {
		path        string
		wantGroup   string
		wantVersion string
		wantOK      bool
	}{
		{"/openapi/v3/apis/dashboard.grafana.app/v1alpha1", "dashboard.grafana.app", "v1alpha1", true},
		{"/openapi/v3", "", "", false}, // root doc, not a group/version path
		{"/openapi/v3/", "", "", false},
		{"/openapi/v3/apis/dashboard.grafana.app", "", "", false},                // missing version
		{"/openapi/v3/apis/dashboard.grafana.app/v1alpha1/extra", "", "", false}, // too many segments
		{"/openapi/v3/api/v1", "", "", false},                                    // core-style "api/", not supported
	}
	for _, tc := range cases {
		group, version, ok := parseOpenAPIGroupVersionPath(tc.path)
		if ok != tc.wantOK || group != tc.wantGroup || version != tc.wantVersion {
			t.Errorf("parseOpenAPIGroupVersionPath(%q) = (%q, %q, %v), want (%q, %q, %v)",
				tc.path, group, version, ok, tc.wantGroup, tc.wantVersion, tc.wantOK)
		}
	}
}

// TestOpenAPIV3MalformedSubpathIsNotFound: a subpath that doesn't parse as
// apis/<group>/<version> names no document, as an unknown /apis group names
// no backend.
func TestOpenAPIV3MalformedSubpathIsNotFound(t *testing.T) {
	s := withGroups("dashboard.grafana.app")
	h := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		s.HandleFunc(w, req)
	})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, newAuthenticatedRequest(http.MethodGet, "/openapi/v3/apis/dashboard.grafana.app", nil))
	if rec.Code != http.StatusNotFound {
		t.Errorf("got code %d, want 404", rec.Code)
	}
}

// TestReadyDoesNotFailOnPartialReconcileError pins that Ready reflects
// whether the router is serving (last-known-good), not whether the last
// reconcile was fully clean. reconcile keeps serving on a partial
// Backend.Load failure (see its doc comment) and still publishes -- Ready
// gating readyz on any non-nil error would drain the whole router over one
// misconfigured group, even though every other group is still proxying
// fine.
func TestReadyDoesNotFailOnPartialReconcileError(t *testing.T) {
	r := NewGrafanaRouter(stubLoader{}, nil)
	r.state.Store(&routerState{phase: serving, err: errors.New("group x failed to load"), served: true})

	if err := r.Ready(context.Background()); err != nil {
		t.Errorf("Ready() = %v, want nil (serving on last-known-good must still be ready)", err)
	}
}

// countingLoader is a RoutesLoader whose Notify channel the test controls
// directly (so it can be closed) and whose Load call count is observable.
type countingLoader struct {
	notifyCh chan struct{}
	loads    atomic.Int32
}

func (l *countingLoader) Load(context.Context) ([]Backend, error) {
	l.loads.Add(1)
	return nil, nil
}
func (l *countingLoader) Notify(context.Context) (<-chan struct{}, error) {
	return l.notifyCh, nil
}

// TestRunDoesNotBusyLoopOnClosedNotifyChannel pins that a closed Notify
// channel doesn't turn the reconcile loop into a hot spin: a closed channel
// is always immediately ready and yields the zero value forever, so a naive
// `case <-dirty:` would call reconcile nonstop, hammering Load and burning
// CPU, until ctx is cancelled.
func TestRunDoesNotBusyLoopOnClosedNotifyChannel(t *testing.T) {
	notifyCh := make(chan struct{}, 1)
	loader := &countingLoader{notifyCh: notifyCh}
	r := NewGrafanaRouter(loader, nil)

	ctx := t.Context()
	if err := r.Run(ctx); err != nil {
		t.Fatalf("Run: %v", err)
	}

	close(notifyCh)
	time.Sleep(50 * time.Millisecond) // give a buggy implementation time to spin

	if loads := loader.loads.Load(); loads > 5 {
		t.Errorf("Load called %d times after notify channel closed, want a small bounded number (busy-loop on closed channel)", loads)
	}
}

type erroringLoader struct{}

func (erroringLoader) Load(context.Context) ([]Backend, error) { return nil, errors.New("boom") }
func (erroringLoader) Notify(context.Context) (<-chan struct{}, error) {
	return make(chan struct{}), nil
}

// TestReadyFailsAfterTotallyFailedInitialReconcile is the exact regression
// bugbot found in the previous fix: Ready must not report ready when the
// very first reconcile failed completely (loader.Load itself errored) --
// there is no last-known-good to fall back on, so the router owns /apis and
// /openapi/v3 with an empty snapshot, and readyz going green would send
// clients an empty discovery document instead of waiting for a real load.
func TestReadyFailsAfterTotallyFailedInitialReconcile(t *testing.T) {
	r := NewGrafanaRouter(erroringLoader{}, nil)
	_ = r.reconcile(context.Background())

	if err := r.Ready(context.Background()); err == nil {
		t.Error("Ready() = nil after totally failed initial reconcile, want error (nothing has ever been served)")
	}
}

// failingBackend always fails Load, for testing partial-failure reconcile
// scenarios (one group loads, another doesn't).
type failingBackend struct{ group, key string }

func (b failingBackend) Key() string            { return b.key }
func (b failingBackend) Source() string         { return "test" }
func (b failingBackend) Group() metav1.APIGroup { return metav1.APIGroup{Name: b.group} }
func (b failingBackend) Load(context.Context) (http.Handler, error) {
	return nil, errors.New("load failed")
}

// TestReadyOKWithPartialLoadFailureGivenAtLeastOneServedGroup pins the case
// this design must still get right even with the regression fix: if at
// least one group loaded successfully (even on the very first reconcile),
// that's real last-known-good, and readiness must not be held hostage by an
// unrelated group's failure.
func TestReadyOKWithPartialLoadFailureGivenAtLeastOneServedGroup(t *testing.T) {
	loader := staticLoader{backends: []Backend{
		&fakeBackend{group: metav1.APIGroup{Name: "good.grafana.app"}, key: "1"},
		failingBackend{group: "bad.grafana.app", key: "1"},
	}}
	r := NewGrafanaRouter(loader, nil)
	_ = r.reconcile(context.Background())

	if err := r.Ready(context.Background()); err != nil {
		t.Errorf("Ready() = %v, want nil (one group succeeded, so last-known-good exists)", err)
	}
}

func TestRouterFallbackOnlyForUnregisteredGroups(t *testing.T) {
	for _, tc := range []struct {
		path     string
		fallback bool
		status   int
	}{
		{"/apis/unknown", true, http.StatusAccepted},
		{"/apis/unknown/v1/namespaces/stacks-123/widgets", true, http.StatusAccepted},
		{"/openapi/v3/apis/unknown/v1", true, http.StatusAccepted},
		{"/apis/known/v1/namespaces/stacks-123/missing", false, http.StatusNotFound},
		{"/apis/known/unsupported-version/widgets", false, http.StatusNotFound},
		{"/openapi/v3/apis/known/v1", false, http.StatusNotFound},
		// Root discovery reads the groups the router does not serve from the fallback.
		{"/apis", true, http.StatusOK},
		{"/apis/", true, http.StatusOK},
		{"/openapi/v3", true, http.StatusOK},
		{"/openapi/v3/", true, http.StatusOK},
		{"/openapi/v3/apis/unknown", false, http.StatusNotFound},
		{"/openapi/v3/apis/unknown/v1/extra", false, http.StatusNotFound},
		{"/apis//v1/namespaces/stacks-123/widgets", false, http.StatusBadRequest},
		// Not a valid group name, so no backend or fallback could serve it.
		// Not a valid group name, so not a request the router can route.
		{"/apis/Not_A.Group/v1/namespaces/stacks-123/widgets", false, http.StatusBadRequest},
		{"/apisfoo/unknown", false, http.StatusNotFound},
		{"/healthz", false, http.StatusNotFound},
	} {
		t.Run(tc.path, func(t *testing.T) {
			router := withGroups("known")
			router.served["known"].handler = http.NotFoundHandler()
			router.publish(t.Context())
			called := false
			router.unregisteredGroupHandler = http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				called = true
				w.WriteHeader(http.StatusAccepted)
			})
			recorder := httptest.NewRecorder()
			router.HandleFunc(recorder, newAuthenticatedRequest(http.MethodGet, tc.path, nil))
			if recorder.Code != tc.status {
				t.Errorf("status = %d, want %d", recorder.Code, tc.status)
			}
			if called != tc.fallback {
				t.Errorf("fallback called = %v, want %v", called, tc.fallback)
			}
		})
	}
}

// flakyLoader fails its first failures loads, and never signals a wake.
type flakyLoader struct {
	failures int
	loads    atomic.Int32
}

func (l *flakyLoader) Load(context.Context) ([]Backend, error) {
	if int(l.loads.Add(1)) <= l.failures {
		return nil, errors.New("load failed")
	}
	return []Backend{&fakeBackend{group: metav1.APIGroup{Name: "retried.ext.grafana.app"}, key: "1"}}, nil
}
func (l *flakyLoader) Notify(context.Context) (<-chan struct{}, error) {
	return make(chan struct{}), nil
}

func TestRunRetriesAFailedReconcile(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		ctx, cancel := context.WithCancel(t.Context())
		defer cancel()
		loader := &flakyLoader{failures: 2}
		router := NewGrafanaRouter(loader, nil)
		require.NoError(t, router.Run(ctx))
		synctest.Wait()
		require.Error(t, router.Ready(ctx), "the first load failed")

		// Retried after reconcileRetryMin, then after twice that.
		time.Sleep(reconcileRetryMin)
		synctest.Wait()
		require.EqualValues(t, 2, loader.loads.Load())
		require.Error(t, router.Ready(ctx))
		time.Sleep(2 * reconcileRetryMin)
		synctest.Wait()
		require.EqualValues(t, 3, loader.loads.Load())
		require.NoError(t, router.Ready(ctx))
		require.True(t, router.KnownGroup("retried.ext.grafana.app"))

		// Once reconciled, no more retries.
		time.Sleep(10 * reconcileRetryMax)
		synctest.Wait()
		require.EqualValues(t, 3, loader.loads.Load())
	})
}

func TestPublishDropsStaleOpenAPIDocs(t *testing.T) {
	router := withGroups("kept", "changed", "removed")
	for _, group := range []string{"kept", "changed", "removed"} {
		router.openapiDocs.Store(group+"/v1", openapiCacheEntry{key: router.served[group].lastKey})
	}

	router.served["changed"].lastKey = "new-key"
	delete(router.served, "removed")
	router.publish(t.Context())

	var cached []string
	router.openapiDocs.Range(func(k, _ any) bool {
		cached = append(cached, k.(string))
		return true
	})
	require.Equal(t, []string{"kept/v1"}, cached)
}

func TestDrainWake(t *testing.T) {
	queued := make(chan struct{}, 1)
	queued <- struct{}{}
	require.Equal(t, (<-chan struct{})(queued), drainWake(queued))
	require.Empty(t, queued, "a queued wake is consumed")

	require.Equal(t, (<-chan struct{})(queued), drainWake(queued), "an empty channel is left alone")

	closed := make(chan struct{})
	close(closed)
	require.Nil(t, drainWake(closed), "a closed channel is no longer selected")
	require.Nil(t, drainWake(nil))
}

func TestStoreOpenAPIDocRevalidatesTheBackend(t *testing.T) {
	router := withGroups("served")
	current := router.served["served"].lastKey
	stored := func(cacheKey string) bool {
		_, ok := router.openapiDocs.Load(cacheKey)
		return ok
	}

	router.storeOpenAPIDoc("served", "served/v1", openapiCacheEntry{key: current})
	require.True(t, stored("served/v1"))

	// Fetched from a backend that has since been replaced, or a group that is gone.
	router.storeOpenAPIDoc("served", "served/v2", openapiCacheEntry{key: "old-key"})
	require.False(t, stored("served/v2"))
	router.storeOpenAPIDoc("removed", "removed/v1", openapiCacheEntry{key: current})
	require.False(t, stored("removed/v1"))
}

// parseOpenAPIGroupVersionPath splits with strings.Cut instead of
// strings.Split, and must answer as the strings.Split version did.
func TestParseOpenAPIGroupVersionPathMatchesStringsSplit(t *testing.T) {
	split := func(path string) (string, string, bool) {
		rest, ok := strings.CutPrefix(path, openapiV3Prefix+"/")
		if !ok || rest == "" {
			return "", "", false
		}
		rest, ok = strings.CutPrefix(rest, "apis/")
		if !ok || rest == "" {
			return "", "", false
		}
		parts := strings.Split(rest, "/")
		if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
			return "", "", false
		}
		return parts[0], parts[1], true
	}
	for _, path := range []string{
		"", "/", "/apis/g/v1", "/openapi/v3", "/openapi/v3/", "/openapi/v3/apis", "/openapi/v3/apis/",
		"/openapi/v3/apis/g", "/openapi/v3/apis/g/", "/openapi/v3/apis/g/v1", "/openapi/v3/apis/g/v1/",
		"/openapi/v3/apis//v1", "/openapi/v3/apis/g/v1/extra", "/openapi/v3/apis/g//", "/openapi/v3/api/g/v1",
	} {
		g, v, ok := parseOpenAPIGroupVersionPath(path)
		wg, wv, wok := split(path)
		require.Equal(t, []any{wg, wv, wok}, []any{g, v, ok}, path)
	}
}

// The single-tenant path parsers split with strings.Cut, or into a stack
// array, instead of strings.Split. They must answer as the strings.Split
// versions did.
func TestSingleTenantPathParsersMatchStringsSplit(t *testing.T) {
	splitDiscovery := func(path string) bool {
		if isRootDiscoveryPath(path) {
			return true
		}
		path = strings.TrimSuffix(path, "/")
		if rest, ok := strings.CutPrefix(path, apisPrefix+"/"); ok {
			parts := strings.Split(rest, "/")
			return (len(parts) == 1 && parts[0] != "") || (len(parts) == 2 && parts[0] != "" && parts[1] != "")
		}
		_, _, ok := parseOpenAPIGroupVersionPath(path)
		return ok
	}
	for _, path := range []string{
		"", "/", "/apis", "/apis/", "/apis/g", "/apis/g/", "/apis/g/v1", "/apis/g/v1/", "/apis//v1",
		"/apis/g/v1/things", "/apis/g/v1/namespaces", "/apis/g/v1/namespaces/", "/apis/g/v1/namespaces/ns",
		"/apis/g/v1/namespaces/ns/things", "/apis/g/v1/namespaces/ns/things/a/status",
		"/apis/g/v1/namespaces//things", "/openapi/v3", "/openapi/v3/apis/g", "/openapi/v3/apis/g/v1",
		"/openapi/v3/apis/g/v1/", "/openapi/v3/apis//v1", "/openapi/v3/apis/g/v1/extra", "/openapi/v3/apis/g/",
	} {
		require.Equal(t, splitDiscovery(path), isSingleTenantDiscoveryPath(path), path)

		var buf [6]string
		parts := pathParts(path, buf[:0])
		split := strings.Split(strings.TrimPrefix(path, "/"), "/")
		require.Equal(t, split[:min(len(split), 6)], parts, path)
	}
}
