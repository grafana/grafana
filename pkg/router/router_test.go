package router

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

// stubBackend is a Backend whose Handler writes a fixed name, so tests can
// assert which group served a request.
type stubBackend struct{ name string }

func (b stubBackend) Handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(b.name))
	})
}
func (b stubBackend) OpenAPIV3Handler() http.Handler { return b.Handler() }
func (b stubBackend) Ready(context.Context) error    { return nil }

// withGroups seeds the router's snapshot with the given group backends.
func withGroups(groups ...string) *BasicRouter {
	r := NewRouter(nil)
	for _, g := range groups {
		r.entries[g] = &groupEntry{backend: stubBackend{name: g}, lastRV: "1"}
	}
	r.publish()
	return r
}

func TestHandlerRoutesByGroup(t *testing.T) {
	r := withGroups("dashboard.grafana.app", "folder.grafana.app")
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTeapot) // sentinel for "fell through to next"
	})
	h := r.Handler(next)

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

// TestHandlerRootDiscoveryNotProxied pins that the /apis root is synthesized
// router-side (not dispatched to any group and not fallen through to next).
func TestHandlerRootDiscoveryNotProxied(t *testing.T) {
	r := withGroups("dashboard.grafana.app")
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	})
	h := r.Handler(next)

	for _, path := range []string{"/apis", "/apis/"} {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		if rec.Code == http.StatusTeapot {
			t.Errorf("path %q fell through to next; root discovery must be router-owned", path)
		}
	}
}
