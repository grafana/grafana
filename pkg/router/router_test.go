package router

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

// stubLoader satisfies RoutesLoader so NewGrafanaRouter's validation passes; the
// routing tests seed the snapshot directly and never call Load/Notify.
type stubLoader struct{}

func (stubLoader) Load(context.Context) ([]Backend, error)         { return nil, nil }
func (stubLoader) Notify(context.Context) (<-chan struct{}, error) { return make(chan struct{}), nil }

// withGroups builds a router and seeds its snapshot with a handler per group
// that writes the group name, so tests can assert which group served.
func withGroups(groups ...string) *GrafanaRouter {
	s, err := NewGrafanaRouter(stubLoader{})
	if err != nil {
		panic(err)
	}
	for _, g := range groups {
		g := g
		s.entries[g] = &handlerEntry{
			handler: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				_, _ = w.Write([]byte(g))
			}),
			lastRV: "1",
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
