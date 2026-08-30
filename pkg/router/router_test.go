package router

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/app"
)

// stubLoader satisfies RoutesLoader; the routing tests seed the snapshot
// directly and never call Load/Notify.
type stubLoader struct{}

func (stubLoader) Load(context.Context) ([]Backend, error)         { return nil, nil }
func (stubLoader) Notify(context.Context) (<-chan struct{}, error) { return make(chan struct{}), nil }

// withGroups builds a router and seeds its snapshot with a handler per group
// that writes the group name, so tests can assert which group served.
func withGroups(groups ...string) *GrafanaRouter {
	s := NewGrafanaRouter(stubLoader{})
	for _, g := range groups {
		g := g
		s.served[g] = &handlerEntry{
			handler: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				_, _ = w.Write([]byte(g))
			}),
			lastRV:  "1",
			breaker: newGroupBreaker(g),
		}
	}
	s.publish()
	return s
}

func TestHandleFuncRoutesByGroup(t *testing.T) {
	s := withGroups("dashboard.grafana.app", "folder.grafana.app")
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTeapot) // sentinel for "fell through to next"
	})
	h := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		s.HandleFunc(w, req, next)
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
		// unknown group falls through to next (primacy to group, not 404)
		{"/apis/unknown.grafana.app/v1/x", "", http.StatusTeapot},
		// paths outside the /apis tree fall through to next
		{"/healthz", "", http.StatusTeapot},
		// /openapi/v3 root is served router-side via HandleFunc (not
		// fallthrough); now router-synthesized. Body/ETag checked separately
		// in TestServeRootDocsWithETag. The per-group-version subpath isn't
		// covered here — withGroups' fake handlers don't serve real OpenAPI
		// bytes, so there's nothing meaningful to assert on that path with
		// this fixture; see openapi_cache_test.go.
		{"/openapi/v3", "", http.StatusOK},
	}
	for _, tc := range cases {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, tc.path, nil))
		if rec.Code != tc.wantCode {
			t.Errorf("path %q: got code %d, want %d", tc.path, rec.Code, tc.wantCode)
		}
		if tc.wantBody != "" && rec.Body.String() != tc.wantBody {
			t.Errorf("path %q: got body %q, want %q", tc.path, rec.Body.String(), tc.wantBody)
		}
	}
}

// TestHandleFuncRootDiscoveryNotProxied pins that the /apis root is synthesized
// router-side (not dispatched to any group and not fallen through to next).
func TestHandleFuncRootDiscoveryNotProxied(t *testing.T) {
	s := withGroups("dashboard.grafana.app")
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	})
	h := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		s.HandleFunc(w, req, next)
	})

	for _, path := range []string{"/apis", "/apis/"} {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		if rec.Code == http.StatusTeapot {
			t.Errorf("path %q fell through to next; root discovery must be router-owned", path)
		}
	}
}

// TestServeRootDocsWithETag pins that both router-synthesized root documents
// (/apis and /openapi/v3) set an ETag and honor conditional GET with 304.
func TestServeRootDocsWithETag(t *testing.T) {
	s := withGroups("dashboard.grafana.app")
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	})
	h := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		s.HandleFunc(w, req, next)
	})

	for _, path := range []string{"/apis", "/openapi/v3"} {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		if rec.Code != http.StatusOK {
			t.Fatalf("path %q: got code %d, want 200", path, rec.Code)
		}
		etag := rec.Header().Get("ETag")
		if etag == "" {
			t.Fatalf("path %q: missing ETag header", path)
		}

		// Conditional GET with the returned ETag must 304 with no body.
		rec2 := httptest.NewRecorder()
		req2 := httptest.NewRequest(http.MethodGet, path, nil)
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

func TestGroupFromPath(t *testing.T) {
	cases := []struct {
		path      string
		wantGroup string
	}{
		{"/apis/dashboard.grafana.app", "dashboard.grafana.app"},
		{"/apis/dashboard.grafana.app/v1alpha1/dashboards", "dashboard.grafana.app"},
		{"/apis/dashboard.grafana.app/", "dashboard.grafana.app"},
		// no single group to attribute the bare /apis root to
		{"/apis", ""},
		{"/apis/", ""},
		// not under /apis at all
		{"/openapi/v3", ""},
		{"/healthz", ""},
		{"", ""},
		// prefix collision, not a real /apis boundary
		{"/apisfoo", ""},
		// arbitrary, client-controlled -- GroupFromPath doesn't validate
		// against known backends, callers must check KnownGroup themselves
		{"/apis/whatever-a-client-sends", "whatever-a-client-sends"},
	}
	for _, tc := range cases {
		if got := GroupFromPath(tc.path); got != tc.wantGroup {
			t.Errorf("GroupFromPath(%q) = %q, want %q", tc.path, got, tc.wantGroup)
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

// TestOpenAPIV3MalformedSubpathFallsThrough: a subpath that doesn't parse as
// apis/<group>/<version> isn't ours; it must fall through to next, same
// primacy rule as an unknown /apis group.
func TestOpenAPIV3MalformedSubpathFallsThrough(t *testing.T) {
	s := withGroups("dashboard.grafana.app")
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	})
	h := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		s.HandleFunc(w, req, next)
	})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/openapi/v3/apis/dashboard.grafana.app", nil))
	if rec.Code != http.StatusTeapot {
		t.Errorf("got code %d, want 418 (fell through to next)", rec.Code)
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
	r := NewGrafanaRouter(stubLoader{})
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
	r := NewGrafanaRouter(loader)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
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
	r := NewGrafanaRouter(erroringLoader{})
	r.storeServing(r.reconcile(context.Background()))

	if err := r.Ready(context.Background()); err == nil {
		t.Error("Ready() = nil after totally failed initial reconcile, want error (nothing has ever been served)")
	}
}

// failingBackend always fails Load, for testing partial-failure reconcile
// scenarios (one group loads, another doesn't).
type failingBackend struct{ group, rv string }

func (b failingBackend) RV() string                 { return b.rv }
func (b failingBackend) Group() string              { return b.group }
func (b failingBackend) Manifest() app.ManifestData { return app.ManifestData{} }
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
		&fakeBackend{group: "good.grafana.app", rv: "1"},
		failingBackend{group: "bad.grafana.app", rv: "1"},
	}}
	r := NewGrafanaRouter(loader)
	r.storeServing(r.reconcile(context.Background()))

	if err := r.Ready(context.Background()); err != nil {
		t.Errorf("Ready() = %v, want nil (one group succeeded, so last-known-good exists)", err)
	}
}
