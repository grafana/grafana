package router

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/require"
)

// countingHandler serves body and counts how many times it was hit, so tests
// can assert the cache actually avoided a re-fetch.
type countingHandler struct {
	body string
	hits atomic.Int64
}

func TestOpenAPIGroupVersionDoesNotCachePrivateResponses(t *testing.T) {
	for _, directive := range []string{"private", "no-store", "no-cache"} {
		t.Run(directive, func(t *testing.T) {
			hits := 0
			s := buildRouterWithBackend("test-app", "1", http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
				hits++
				w.Header().Set("Cache-Control", directive)
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte(`{"openapi":"3.0.0"}`))
			}))
			req := newAuthenticatedRequest(http.MethodGet, "/openapi/v3/apis/test-app/v0alpha1", nil)
			for range 2 {
				res := httptest.NewRecorder()
				s.HandleFunc(res, req, http.NotFoundHandler())
				require.Equal(t, http.StatusOK, res.Code)
				require.Equal(t, directive, res.Header().Get("Cache-Control"))
			}
			require.Equal(t, 2, hits)
		})
	}
}

func TestOpenAPIGroupVersionRechecksAuthorization(t *testing.T) {
	backend := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Cache-Control", "no-cache, private")
		if req.Header.Get("Authorization") != "Bearer allowed" {
			w.WriteHeader(http.StatusForbidden)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("ETag", `"backend-revision"`)
		_, _ = w.Write([]byte(`{"openapi":"3.0.0"}`))
	})
	router := buildRouterWithBackend("example.grafana.app", "revision", backend)
	req := newAuthenticatedRequest(http.MethodGet, "/openapi/v3/apis/example.grafana.app/v1", nil)
	req.Header.Set("Authorization", "Bearer allowed")
	res := httptest.NewRecorder()
	router.HandleFunc(res, req, http.NotFoundHandler())
	require.Equal(t, http.StatusOK, res.Code)
	require.NotEmpty(t, res.Header().Get("ETag"))

	req.Header.Set("Authorization", "Bearer denied")
	for _, etag := range []string{"", res.Header().Get("ETag")} {
		req.Header.Set("If-None-Match", etag)
		denied := httptest.NewRecorder()
		router.HandleFunc(denied, req, http.NotFoundHandler())
		require.Equal(t, http.StatusForbidden, denied.Code)
	}
}

func TestOpenAPIGroupVersionPreservesRepresentation(t *testing.T) {
	for _, first := range []string{"application/json", "application/com.github.proto-openapi.spec.v3@v1.0+protobuf"} {
		t.Run(first, func(t *testing.T) {
			hits := 0
			s := buildRouterWithBackend("test-app", "1", http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
				hits++
				w.Header().Set("Content-Type", req.Header.Get("Accept"))
				w.Header().Set("Vary", "Accept")
				_, _ = w.Write([]byte(req.Header.Get("Accept"))) //nolint:gosec // G705: echo a test-controlled header to distinguish representations.
			}))
			previousETag := ""
			for _, accept := range []string{first, "application/json", "application/com.github.proto-openapi.spec.v3@v1.0+protobuf"} {
				req := newAuthenticatedRequest(http.MethodGet, "/openapi/v3/apis/test-app/v0alpha1", nil)
				req.Header.Set("Accept", accept)
				for range 2 {
					res := httptest.NewRecorder()
					s.HandleFunc(res, req, http.NotFoundHandler())
					require.Equal(t, http.StatusOK, res.Code)
					require.Equal(t, accept, res.Header().Get("Content-Type"))
					require.Equal(t, accept, res.Body.String())
					require.Equal(t, "Accept", res.Header().Get("Vary"))
					previousETag = res.Header().Get("ETag")
				}
			}
			require.LessOrEqual(t, hits, 3)
			req := newAuthenticatedRequest(http.MethodGet, "/openapi/v3/apis/test-app/v0alpha1", nil)
			req.Header.Set("Accept", "application/json")
			req.Header.Set("If-None-Match", previousETag)
			res := httptest.NewRecorder()
			s.HandleFunc(res, req, http.NotFoundHandler())
			require.Equal(t, http.StatusOK, res.Code)
			require.NotEqual(t, previousETag, res.Header().Get("ETag"))
		})
	}
}

func (h *countingHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	h.hits.Add(1)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(h.body)) // nolint:gosec // G705: XSS via taint analysis (gosec)
}

// buildRouterWithBackend seeds a router with one real handlerEntry (fake
// upstream handler + given key) via publish, so snapshot carries a real key —
// unlike withGroups' fixed lastKey:"1", these tests need to bump it mid-test.
func buildRouterWithBackend(group, key string, upstream http.Handler) *GrafanaRouter {
	s := NewGrafanaRouter(stubLoader{}, nil)
	s.served[group] = &handlerEntry{handler: upstream, lastKey: key, breaker: newGroupBreaker(group)}
	s.publish(context.Background())
	return s
}

func TestOpenAPIGroupVersionCachesUntilKeyChanges(t *testing.T) {
	upstream := &countingHandler{body: `{"openapi":"3.0.0"}`}
	s := buildRouterWithBackend("dashboard.grafana.app", "5", upstream)
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusTeapot) })
	h := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) { s.HandleFunc(w, req, next) })

	path := "/openapi/v3/apis/dashboard.grafana.app/v1alpha1"

	// First request: cache miss, proxies through.
	rec1 := httptest.NewRecorder()
	h.ServeHTTP(rec1, newAuthenticatedRequest(http.MethodGet, path, nil))
	if rec1.Code != http.StatusOK || rec1.Body.String() != upstream.body {
		t.Fatalf("first request: got code=%d body=%q, want 200 %q", rec1.Code, rec1.Body.String(), upstream.body)
	}
	if got := upstream.hits.Load(); got != 1 {
		t.Fatalf("after first request, upstream hits = %d, want 1", got)
	}

	// Second request, same key: served from cache, no new upstream hit.
	rec2 := httptest.NewRecorder()
	h.ServeHTTP(rec2, newAuthenticatedRequest(http.MethodGet, path, nil))
	if rec2.Code != http.StatusOK || rec2.Body.String() != upstream.body {
		t.Fatalf("second request: got code=%d body=%q, want 200 %q", rec2.Code, rec2.Body.String(), upstream.body)
	}
	if got := upstream.hits.Load(); got != 1 {
		t.Fatalf("after second request, upstream hits = %d, want still 1 (cache hit)", got)
	}

	// Bump the key (simulates reconcile picking up a route change) and re-request:
	// cache must be treated as stale, upstream hit again.
	s.served["dashboard.grafana.app"] = &handlerEntry{handler: upstream, lastKey: "6", breaker: newGroupBreaker("dashboard.grafana.app")}
	s.publish(t.Context())
	rec3 := httptest.NewRecorder()
	h.ServeHTTP(rec3, newAuthenticatedRequest(http.MethodGet, path, nil))
	if rec3.Code != http.StatusOK {
		t.Fatalf("third request: got code=%d, want 200", rec3.Code)
	}
	if got := upstream.hits.Load(); got != 2 {
		t.Fatalf("after key change, upstream hits = %d, want 2 (cache invalidated)", got)
	}
}

func TestOpenAPIGroupVersionIfNoneMatch304(t *testing.T) {
	upstream := &countingHandler{body: `{"openapi":"3.0.0"}`}
	s := buildRouterWithBackend("dashboard.grafana.app", "5", upstream)
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusTeapot) })
	h := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) { s.HandleFunc(w, req, next) })
	path := "/openapi/v3/apis/dashboard.grafana.app/v1alpha1"

	rec1 := httptest.NewRecorder()
	h.ServeHTTP(rec1, newAuthenticatedRequest(http.MethodGet, path, nil))
	etag := rec1.Header().Get("ETag")
	if etag == "" {
		t.Fatal("missing ETag on first response")
	}

	rec2 := httptest.NewRecorder()
	req2 := newAuthenticatedRequest(http.MethodGet, path, nil)
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
	h.ServeHTTP(rec, newAuthenticatedRequest(http.MethodGet, "/openapi/v3/apis/unknown.grafana.app/v1", nil))
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
	_, _ = w.Write([]byte(u.body)) // nolint:gosec // G705: XSS via taint analysis (gosec)
}

func TestOpenAPIGroupVersionStripsConditionalHeaders(t *testing.T) {
	upstream := &conditionalUpstream{body: `{"openapi":"3.0.0"}`}
	s := buildRouterWithBackend("dashboard.grafana.app", "5", upstream)
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusTeapot) })
	h := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) { s.HandleFunc(w, req, next) })

	req := newAuthenticatedRequest(http.MethodGet, "/openapi/v3/apis/dashboard.grafana.app/v1alpha1", nil)
	// A stale/foreign If-None-Match that does NOT match our current key-based
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
	h.ServeHTTP(rec1, newAuthenticatedRequest(http.MethodGet, path, nil))
	etag := rec1.Header().Get("ETag")
	if etag == "" {
		t.Fatal("missing ETag on first response")
	}

	rec2 := httptest.NewRecorder()
	req2 := newAuthenticatedRequest(http.MethodGet, path, nil)
	req2.Header.Set("If-None-Match", etag)
	h.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusNotModified {
		t.Fatalf("got code %d, want 304", rec2.Code)
	}
	if got := rec2.Header().Get("ETag"); got != etag {
		t.Errorf("304 response ETag = %q, want %q (RFC 7232 requires it on 304)", got, etag)
	}
}

func setLimit(t *testing.T, limit *int, value int) {
	t.Helper()
	previous := *limit
	*limit = value
	t.Cleanup(func() { *limit = previous })
}

func TestCaptureWriterLimit(t *testing.T) {
	t.Run("under the limit it buffers", func(t *testing.T) {
		out := httptest.NewRecorder()
		c := newCaptureWriter(8, out)
		_, _ = c.Write([]byte("12345678"))
		require.False(t, c.overflowed)
		require.Equal(t, "12345678", c.body.String())
		require.Empty(t, out.Body.String())
	})

	t.Run("past the limit it streams to passthrough", func(t *testing.T) {
		out := httptest.NewRecorder()
		c := newCaptureWriter(8, out)
		c.Header().Set("Content-Type", "application/json")
		c.WriteHeader(http.StatusAccepted)
		for _, chunk := range []string{"12345", "67890", "abc"} {
			n, err := c.Write([]byte(chunk))
			require.NoError(t, err)
			require.Equal(t, len(chunk), n)
		}
		c.Flush()
		require.True(t, c.overflowed)
		require.Zero(t, c.body.Len(), "nothing stays buffered")
		require.Equal(t, http.StatusAccepted, out.Code)
		require.Equal(t, "application/json", out.Header().Get("Content-Type"))
		require.Equal(t, "1234567890abc", out.Body.String())
		require.True(t, out.Flushed)
	})

	t.Run("past the limit without passthrough it discards", func(t *testing.T) {
		c := newCaptureWriter(8, nil)
		for range 3 {
			n, err := c.Write([]byte("12345"))
			require.NoError(t, err, "a failed write would abort the proxy")
			require.Equal(t, 5, n)
		}
		require.True(t, c.overflowed)
		require.Zero(t, c.body.Len())
	})
}

func TestOpenAPIGroupVersionTooLargeToCache(t *testing.T) {
	setLimit(t, &maxCachedOpenAPIDocBytes, 16)
	body := `{"openapi":"3.0.0","paths":{"a":{}}}`
	upstream := &countingHandler{body: body}
	s := buildRouterWithBackend("test-app", "1", upstream)
	for range 2 {
		res := httptest.NewRecorder()
		s.HandleFunc(res, newAuthenticatedRequest(http.MethodGet, "/openapi/v3/apis/test-app/v1", nil), http.NotFoundHandler())
		require.Equal(t, http.StatusOK, res.Code)
		require.Equal(t, body, res.Body.String(), "the whole document still reaches the client")
		require.Empty(t, res.Header().Get("ETag"), "an uncached document has no router ETag")
	}
	require.EqualValues(t, 2, upstream.hits.Load(), "a document past the limit is not cached")
}

func TestOpenAPIGroupVersionIsReadOnly(t *testing.T) {
	const path = "/openapi/v3/apis/test-app/v1"
	for _, tc := range []struct {
		method        string
		authenticated bool
		status        int
		reachesBack   bool
	}{
		{method: http.MethodGet, authenticated: true, status: http.StatusOK, reachesBack: true},
		{method: http.MethodHead, authenticated: true, status: http.StatusOK, reachesBack: true},
		{method: http.MethodPost, authenticated: true, status: http.StatusMethodNotAllowed},
		{method: http.MethodPut, authenticated: true, status: http.StatusMethodNotAllowed},
		{method: http.MethodPatch, authenticated: true, status: http.StatusMethodNotAllowed},
		{method: http.MethodDelete, authenticated: true, status: http.StatusMethodNotAllowed},
		// Authentication runs first, so an unauthenticated caller learns nothing
		// about the document, including which methods it allows.
		{method: http.MethodPost, status: http.StatusUnauthorized},
	} {
		name := tc.method
		if !tc.authenticated {
			name += " unauthenticated"
		}
		t.Run(name, func(t *testing.T) {
			upstream := &countingHandler{body: `{"openapi":"3.0.0"}`}
			s := buildRouterWithBackend("test-app", "1", upstream)
			req := httptest.NewRequest(tc.method, path, nil)
			if tc.authenticated {
				req = newAuthenticatedRequest(tc.method, path, nil)
			}
			res := httptest.NewRecorder()
			s.HandleFunc(res, req, http.NotFoundHandler())
			require.Equal(t, tc.status, res.Code)
			if tc.status == http.StatusMethodNotAllowed {
				require.Equal(t, "GET, HEAD", res.Header().Get("Allow"))
			}
			wantHits := int64(0)
			if tc.reachesBack {
				wantHits = 1
			}
			require.Equal(t, wantHits, upstream.hits.Load(), "backend hits")
		})
	}
}

func TestReadDiscoveryTooLarge(t *testing.T) {
	setLimit(t, &maxDiscoveryDocBytes, 16)
	handler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"kind":"APIGroupList","groups":[]}`))
	})
	var into map[string]any
	_, err := readDiscovery(httptest.NewRequest(http.MethodGet, "/apis", nil), handler, "/apis", "application/json", &into)
	require.ErrorContains(t, err, "larger than 16 bytes")
}

func TestDecodeLimitedJSON(t *testing.T) {
	var v map[string]int
	require.NoError(t, decodeLimitedJSON(strings.NewReader(`{"a":1}`), 7, &v))
	require.Equal(t, 1, v["a"])
	require.ErrorContains(t, decodeLimitedJSON(strings.NewReader(`{"a":10}`), 7, &v), "larger than 7 bytes")
}

func TestAggregateDiscoveryTooLarge(t *testing.T) {
	setLimit(t, &maxDiscoveryDocBytes, 16)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"kind":"APIGroupList","groups":[{"name":"a.ext.grafana.app"}]}`))
	}))
	t.Cleanup(srv.Close)
	_, err := discoverGroupResources(t.Context(), srv.Client(), srv.URL)
	require.ErrorContains(t, err, "larger than 16 bytes")
}
