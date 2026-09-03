package router

import (
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
)

// countingHandler serves body and counts how many times it was hit, so tests
// can assert the cache actually avoided a re-fetch.
type countingHandler struct {
	body string
	hits atomic.Int64
}

func (h *countingHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	h.hits.Add(1)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(h.body))
}

// buildRouterWithBackend seeds a router with one real handlerEntry (fake
// upstream handler + given rv) via publish, so snapshot carries a real RV —
// unlike withGroups' fixed lastRV:"1", these tests need to bump RV mid-test.
func buildRouterWithBackend(group, rv string, upstream http.Handler) *GrafanaRouter {
	s := NewGrafanaRouter(stubLoader{})
	s.served[group] = &handlerEntry{handler: upstream, lastRV: rv, breaker: newGroupBreaker(group)}
	s.publish()
	return s
}

func TestOpenAPIGroupVersionCachesUntilRVChanges(t *testing.T) {
	upstream := &countingHandler{body: `{"openapi":"3.0.0"}`}
	s := buildRouterWithBackend("dashboard.grafana.app", "5", upstream)
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusTeapot) })
	h := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) { s.HandleFunc(w, req, next) })

	path := "/openapi/v3/apis/dashboard.grafana.app/v1alpha1"

	// First request: cache miss, proxies through.
	rec1 := httptest.NewRecorder()
	h.ServeHTTP(rec1, httptest.NewRequest(http.MethodGet, path, nil))
	if rec1.Code != http.StatusOK || rec1.Body.String() != upstream.body {
		t.Fatalf("first request: got code=%d body=%q, want 200 %q", rec1.Code, rec1.Body.String(), upstream.body)
	}
	if got := upstream.hits.Load(); got != 1 {
		t.Fatalf("after first request, upstream hits = %d, want 1", got)
	}

	// Second request, same RV: served from cache, no new upstream hit.
	rec2 := httptest.NewRecorder()
	h.ServeHTTP(rec2, httptest.NewRequest(http.MethodGet, path, nil))
	if rec2.Code != http.StatusOK || rec2.Body.String() != upstream.body {
		t.Fatalf("second request: got code=%d body=%q, want 200 %q", rec2.Code, rec2.Body.String(), upstream.body)
	}
	if got := upstream.hits.Load(); got != 1 {
		t.Fatalf("after second request, upstream hits = %d, want still 1 (cache hit)", got)
	}

	// Bump RV (simulates reconcile picking up a manifest change) and re-request:
	// cache must be treated as stale, upstream hit again.
	s.served["dashboard.grafana.app"] = &handlerEntry{handler: upstream, lastRV: "6", breaker: newGroupBreaker("dashboard.grafana.app")}
	s.publish()
	rec3 := httptest.NewRecorder()
	h.ServeHTTP(rec3, httptest.NewRequest(http.MethodGet, path, nil))
	if rec3.Code != http.StatusOK {
		t.Fatalf("third request: got code=%d, want 200", rec3.Code)
	}
	if got := upstream.hits.Load(); got != 2 {
		t.Fatalf("after RV bump, upstream hits = %d, want 2 (cache invalidated)", got)
	}
}

func TestOpenAPIGroupVersionIfNoneMatch304(t *testing.T) {
	upstream := &countingHandler{body: `{"openapi":"3.0.0"}`}
	s := buildRouterWithBackend("dashboard.grafana.app", "5", upstream)
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusTeapot) })
	h := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) { s.HandleFunc(w, req, next) })
	path := "/openapi/v3/apis/dashboard.grafana.app/v1alpha1"

	rec1 := httptest.NewRecorder()
	h.ServeHTTP(rec1, httptest.NewRequest(http.MethodGet, path, nil))
	etag := rec1.Header().Get("ETag")
	if etag == "" {
		t.Fatal("missing ETag on first response")
	}

	rec2 := httptest.NewRecorder()
	req2 := httptest.NewRequest(http.MethodGet, path, nil)
	req2.Header.Set("If-None-Match", etag)
	h.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusNotModified {
		t.Errorf("got code %d, want 304", rec2.Code)
	}
	if rec2.Body.Len() != 0 {
		t.Errorf("304 response had a body: %q", rec2.Body.String())
	}
	if got := upstream.hits.Load(); got != 1 {
		t.Errorf("upstream hits = %d, want 1 (304 must not re-hit upstream)", got)
	}
}

func TestOpenAPIGroupVersionUnknownGroupFallsThrough(t *testing.T) {
	s := buildRouterWithBackend("dashboard.grafana.app", "5", &countingHandler{body: "{}"})
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusTeapot) })
	h := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) { s.HandleFunc(w, req, next) })
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/openapi/v3/apis/unknown.grafana.app/v1", nil))
	if rec.Code != http.StatusTeapot {
		t.Errorf("got code %d, want 418 (fell through)", rec.Code)
	}
}

// conditionalUpstream honors (unstripped) If-None-Match with its own
// unrelated 304 — proving the router strips conditional headers before
// proxying on a cache miss, so it always gets a real body to judge and
// cache. Regression test for the phantom-304 bug the design spec calls out.
type conditionalUpstream struct {
	body string
}

func (u *conditionalUpstream) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Header.Get("If-None-Match") != "" {
		w.WriteHeader(http.StatusNotModified)
		return
	}
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(u.body))
}

func TestOpenAPIGroupVersionStripsConditionalHeaders(t *testing.T) {
	upstream := &conditionalUpstream{body: `{"openapi":"3.0.0"}`}
	s := buildRouterWithBackend("dashboard.grafana.app", "5", upstream)
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusTeapot) })
	h := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) { s.HandleFunc(w, req, next) })

	req := httptest.NewRequest(http.MethodGet, "/openapi/v3/apis/dashboard.grafana.app/v1alpha1", nil)
	// A stale/foreign If-None-Match that does NOT match our current RV-based
	// ETag, so the router proceeds to proxy — the case that must strip it.
	req.Header.Set("If-None-Match", `"some-other-etag"`)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("got code %d, want 200 (upstream must not see the forwarded If-None-Match and phantom-304)", rec.Code)
	}
	if rec.Body.String() != upstream.body {
		t.Errorf("got body %q, want %q", rec.Body.String(), upstream.body)
	}
}

// TestOpenAPIGroupVersionIfNoneMatch304SetsETag pins that a 304 from a
// matching If-None-Match still carries the ETag header -- RFC 7232 requires
// it, and the router's own root docs (serveCachedDoc) already get this
// right; this path was missing it.
func TestOpenAPIGroupVersionIfNoneMatch304SetsETag(t *testing.T) {
	upstream := &countingHandler{body: `{"openapi":"3.0.0"}`}
	s := buildRouterWithBackend("dashboard.grafana.app", "5", upstream)
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusTeapot) })
	h := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) { s.HandleFunc(w, req, next) })
	path := "/openapi/v3/apis/dashboard.grafana.app/v1alpha1"

	rec1 := httptest.NewRecorder()
	h.ServeHTTP(rec1, httptest.NewRequest(http.MethodGet, path, nil))
	etag := rec1.Header().Get("ETag")
	if etag == "" {
		t.Fatal("missing ETag on first response")
	}

	rec2 := httptest.NewRecorder()
	req2 := httptest.NewRequest(http.MethodGet, path, nil)
	req2.Header.Set("If-None-Match", etag)
	h.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusNotModified {
		t.Fatalf("got code %d, want 304", rec2.Code)
	}
	if got := rec2.Header().Get("ETag"); got != etag {
		t.Errorf("304 response ETag = %q, want %q (RFC 7232 requires it on 304)", got, etag)
	}
}
