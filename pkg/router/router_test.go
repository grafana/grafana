package router

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
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
