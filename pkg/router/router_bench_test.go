package router

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// BenchmarkGrafanaRouter measures steady-state handling without network I/O or
// service instrumentation. Route loading and request construction are untimed.
func BenchmarkGrafanaRouter(b *testing.B) {
	groupCount := 100
	b.Run(fmt.Sprintf("groups=%d", groupCount), func(b *testing.B) {
		groups := make([]string, groupCount)
		for i := range groups {
			groups[i] = fmt.Sprintf("app-%d.grafana.app", i)
		}
		router := NewGrafanaRouter(dummyRoutesLoader{groups: groups}, nil)
		// Reconcile synchronously so every measurement starts with loaded routes.
		if err := router.reconcile(b.Context()); err != nil {
			b.Fatal(err)
		}
		group := groups[len(groups)-1]
		for _, tc := range []struct {
			name string
			path string
			code int
		}{
			{"resource", "/apis/" + group + "/v0alpha1/namespaces/default/widgets", http.StatusOK},
			{"group_discovery", "/apis/" + group, http.StatusOK},
			{"unknown_group", "/apis/unknown.grafana.app/v0alpha1/widgets", http.StatusNotFound},
			{"outside_apis", "/healthz", http.StatusNotFound},
			{"api_discovery", "/apis", http.StatusOK},
			{"openapi_index", "/openapi/v3", http.StatusOK},
			{"openapi_cached", "/openapi/v3/apis/" + group + "/v0alpha1", http.StatusOK},
			{"openapi_unknown_group", "/openapi/v3/apis/unknown.grafana.app/v0alpha1", http.StatusNotFound},
			{"openapi_invalid_path", "/openapi/v3/apis/" + group, http.StatusNotFound},
		} {
			b.Run(tc.name, func(b *testing.B) {
				req := newAuthenticatedRequest(http.MethodGet, tc.path, nil)
				rec := httptest.NewRecorder()
				// Validate dispatch and warm the OpenAPI cache before timing.
				router.HandleFunc(rec, req)
				if rec.Code != tc.code {
					b.Fatalf("got status %d, want %d", rec.Code, tc.code)
				}
				w := &benchmarkResponseWriter{header: make(http.Header)}
				b.ReportAllocs()
				for b.Loop() {
					clear(w.header)
					router.HandleFunc(w, req)
				}
			})
		}
	})
}

// BenchmarkServiceMiddleware measures the router as Grafana's API server
// middleware, with request metrics: requests for its own groups, and the
// embedded API server's requests it passes on.
func BenchmarkServiceMiddleware(b *testing.B) {
	groups := make([]string, 100)
	for i := range groups {
		groups[i] = fmt.Sprintf("app-%d.grafana.app", i)
	}
	svc := newService(NewGrafanaRouter(dummyRoutesLoader{groups: groups}, nil), prometheus.NewRegistry())
	svc.middleware = true
	// The embedded API server's groups are served through its handler.
	svc.router.loader = newEmbeddedLoader(svc.router.loader, &svc.upstream)
	svc.SetUpstream(&fakeEmbeddedAPIServer{groups: []string{"dashboard.grafana.app"}, status: http.StatusNoContent})
	if err := svc.router.reconcile(b.Context()); err != nil {
		b.Fatal(err)
	}
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
	group := groups[len(groups)-1]
	for _, tc := range []struct{ name, path string }{
		{"resource", "/apis/" + group + "/v0alpha1/namespaces/default/widgets/abc"},
		{"embedded_group", "/apis/dashboard.grafana.app/v1/namespaces/default/dashboards/abc"},
		{"outside_apis", "/api/dashboards/uid/abc"},
	} {
		b.Run(tc.name, func(b *testing.B) {
			req := newAuthenticatedRequest(http.MethodGet, tc.path, nil)
			w := &benchmarkResponseWriter{header: make(http.Header)}
			b.ReportAllocs()
			for b.Loop() {
				clear(w.header)
				svc.HandleFunc(w, req, next)
			}
		})
	}
}

func BenchmarkGrafanaRouterConditional(b *testing.B) {
	router := newBenchmarkRouter(b)
	for _, path := range []string{"/apis", "/openapi/v3", "/openapi/v3/apis/app-0.grafana.app/v0alpha1"} {
		b.Run(path, func(b *testing.B) {
			req := newAuthenticatedRequest(http.MethodGet, path, nil)
			rec := httptest.NewRecorder()
			router.HandleFunc(rec, req)
			etag := rec.Header().Get("ETag")
			if rec.Code != http.StatusOK || etag == "" {
				b.Fatalf("expected 200 with ETag, got %d with %q", rec.Code, etag)
			}
			req.Header.Set("If-None-Match", etag)
			rec = httptest.NewRecorder()
			router.HandleFunc(rec, req)
			if rec.Code != http.StatusNotModified {
				b.Fatalf("got status %d, want 304", rec.Code)
			}
			w := &benchmarkResponseWriter{header: make(http.Header)}
			b.ReportAllocs()
			for b.Loop() {
				clear(w.header)
				router.HandleFunc(w, req)
			}
		})
	}
}

func BenchmarkGrafanaRouterOpenAPICacheMiss(b *testing.B) {
	for _, stale := range []bool{false, true} {
		b.Run(fmt.Sprintf("stale=%t", stale), func(b *testing.B) {
			router := newBenchmarkRouter(b)
			const cacheKey = "app-0.grafana.app/v0alpha1"
			req := newAuthenticatedRequest(http.MethodGet, "/openapi/v3/apis/"+cacheKey, nil)
			w := &benchmarkResponseWriter{header: make(http.Header)}
			b.ReportAllocs()
			for b.Loop() {
				// Include the small cache reset cost to avoid stopping the timer on
				// every request, which makes these short operations slow to benchmark.
				if stale {
					router.openapiDocs.Store(cacheKey, openapiCacheEntry{key: "old"})
				} else {
					router.openapiDocs.Delete(cacheKey)
				}
				clear(w.header)
				router.HandleFunc(w, req)
			}
			cached, ok := router.openapiDocs.Load(cacheKey)
			if !ok || cached.(openapiCacheEntry).key != "static" {
				b.Fatal("expected cache miss to populate the current document")
			}
		})
	}
}

func BenchmarkGrafanaRouterParallel(b *testing.B) {
	for _, groupCount := range []int{1, 100} {
		b.Run(fmt.Sprintf("active_groups=%d", groupCount), func(b *testing.B) {
			router := newBenchmarkRouter(b)
			requests := make([]*http.Request, groupCount)
			for i := range requests {
				requests[i] = newAuthenticatedRequest(http.MethodGet,
					fmt.Sprintf("/apis/app-%d.grafana.app/v0alpha1/namespaces/default/widgets", i), nil)
			}
			b.ReportAllocs()
			b.ResetTimer()
			b.RunParallel(func(pb *testing.PB) {
				// Each worker owns its writer; requests and the router are shared.
				w := &benchmarkResponseWriter{header: make(http.Header)}
				i := 0
				for pb.Next() {
					clear(w.header)
					router.HandleFunc(w, requests[i])
					i = (i + 1) % len(requests)
				}
			})
		})
	}
}

func BenchmarkGrafanaRouterReconcile(b *testing.B) {
	for _, scenario := range []string{"initial", "unchanged", "update_one", "replace_one"} {
		b.Run(scenario, func(b *testing.B) {
			router := newBenchmarkRouter(b)
			loader := &benchmarkRoutesLoader{dummyRoutesLoader: router.loader.(dummyRoutesLoader), key: "static"}
			router.loader = loader
			ctx := b.Context()
			b.ReportAllocs()
			for b.Loop() {
				if scenario == "initial" {
					router = NewGrafanaRouter(loader, nil)
				}
				if scenario == "update_one" {
					if loader.key == "static" {
						loader.key = "updated"
					} else {
						loader.key = "static"
					}
				}
				if scenario == "replace_one" {
					if loader.groups[0] == "app-0.grafana.app" {
						loader.groups[0] = "replacement.grafana.app"
					} else {
						loader.groups[0] = "app-0.grafana.app"
					}
				}
				if err := router.reconcile(ctx); err != nil {
					b.Fatal(err)
				}
			}
			if len(*router.snapshot.Load()) != 100 || !router.KnownGroup(loader.groups[0]) {
				b.Fatal("expected reconciled snapshot to contain the current 100 groups")
			}
		})
	}
}

func newBenchmarkRouter(b *testing.B) *GrafanaRouter {
	b.Helper()
	groups := make([]string, 100)
	for i := range groups {
		groups[i] = fmt.Sprintf("app-%d.grafana.app", i)
	}
	router := NewGrafanaRouter(dummyRoutesLoader{groups: groups}, nil)
	if err := router.reconcile(b.Context()); err != nil {
		b.Fatal(err)
	}
	return router
}

type benchmarkRoutesLoader struct {
	dummyRoutesLoader
	key string
}

func (l *benchmarkRoutesLoader) Load(ctx context.Context) ([]Backend, error) {
	backends, err := l.dummyRoutesLoader.Load(ctx)
	if err != nil {
		return nil, err
	}
	backends[0] = &benchmarkBackend{dummyBackend: dummyBackend{group: l.groups[0]}, key: l.key}
	return backends, nil
}

type benchmarkBackend struct {
	dummyBackend
	key string
}

func (b *benchmarkBackend) Key() string { return b.key }

func (b *benchmarkBackend) Source() string { return "test" }

// Discard bodies to avoid measuring recorder allocations or retaining responses
// across iterations, while preserving header writes performed by the router.
type benchmarkResponseWriter struct {
	header http.Header
}

func (w *benchmarkResponseWriter) Header() http.Header { return w.header }
func (*benchmarkResponseWriter) WriteHeader(int)       {}
func (*benchmarkResponseWriter) Write(p []byte) (int, error) {
	return len(p), nil
}

// Flush lets proxies flush after each write, as they do for real clients.
func (*benchmarkResponseWriter) Flush() {}

// BenchmarkGrafanaRouterProxy measures a request proxied through an aggregate
// backend, with outbound rewriting, the breaker, tracing and request metrics,
// to a backend that answers from memory.
func BenchmarkGrafanaRouterProxy(b *testing.B) {
	for _, size := range []int{1 << 10, 1 << 20} {
		b.Run(fmt.Sprintf("body=%d", size), func(b *testing.B) {
			backend := newBenchmarkAggregateBackend(b, "app.ext.grafana.app", benchmarkRoundTripper{body: bytes.Repeat([]byte("x"), size)})
			svc := newService(NewGrafanaRouter(&statusLoader{backends: []Backend{backend}}, nil), prometheus.NewRegistry())
			svc.middleware = true
			if err := svc.router.reconcile(b.Context()); err != nil {
				b.Fatal(err)
			}
			req := newAuthenticatedRequest(http.MethodGet, "/apis/app.ext.grafana.app/v1/namespaces/default/widgets", nil)
			req.Header.Set("Accept", "application/json")
			w := &benchmarkResponseWriter{header: make(http.Header)}
			b.ReportAllocs()
			for b.Loop() {
				clear(w.header)
				svc.HandleFunc(w, req, http.NotFoundHandler())
			}
		})
	}
}

// BenchmarkGrafanaRouterAggregatedDiscovery measures /apis in the aggregated
// format, standalone and merged with the embedded API server's groups.
func BenchmarkGrafanaRouterAggregatedDiscovery(b *testing.B) {
	embeddedGroups := make([]apidiscoveryv2.APIGroupDiscovery, 50)
	for i := range embeddedGroups {
		embeddedGroups[i] = benchmarkGroupDiscovery(fmt.Sprintf("core-%d.grafana.app", i))
	}
	embedded, err := json.Marshal(apidiscoveryv2.APIGroupDiscoveryList{
		TypeMeta: metav1.TypeMeta{Kind: "APIGroupDiscoveryList", APIVersion: "apidiscovery.k8s.io/v2"},
		Items:    embeddedGroups,
	})
	if err != nil {
		b.Fatal(err)
	}
	for _, groups := range []int{10, 100} {
		backends := make([]Backend, groups)
		for i := range backends {
			backends[i] = newBenchmarkAggregateBackend(b, fmt.Sprintf("app-%d.ext.grafana.app", i), benchmarkRoundTripper{})
		}
		for _, mode := range []string{"standalone", "middleware"} {
			b.Run(fmt.Sprintf("groups=%d/%s", groups, mode), func(b *testing.B) {
				svc := newService(NewGrafanaRouter(&statusLoader{backends: backends}, nil), prometheus.NewRegistry())
				svc.middleware = true
				if err := svc.router.reconcile(b.Context()); err != nil {
					b.Fatal(err)
				}
				next := http.NotFoundHandler()
				if mode == "middleware" {
					next = http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						w.Header().Set("Content-Type", aggregatedDiscoveryJSON)
						_, _ = w.Write(embedded)
					})
				}
				req := newAuthenticatedRequest(http.MethodGet, "/apis", nil)
				req.Header.Set("Accept", aggregatedDiscoveryJSON+",application/json")
				rec := httptest.NewRecorder()
				svc.HandleFunc(rec, req, next)
				if rec.Code != http.StatusOK {
					b.Fatalf("got status %d", rec.Code)
				}
				w := &benchmarkResponseWriter{header: make(http.Header)}
				b.ReportAllocs()
				for b.Loop() {
					clear(w.header)
					svc.HandleFunc(w, req, next)
				}
			})
		}
	}
}

// BenchmarkServiceMiddlewareRootDiscovery measures /apis in the legacy format
// and the /openapi/v3 index in middleware mode, merged with the embedded API
// server's answers.
func BenchmarkServiceMiddlewareRootDiscovery(b *testing.B) {
	backends := make([]Backend, 100)
	for i := range backends {
		backends[i] = newBenchmarkAggregateBackend(b, fmt.Sprintf("app-%d.ext.grafana.app", i), benchmarkRoundTripper{})
	}
	// In middleware mode the embedded API server's groups are served alongside.
	core := make([]string, 50)
	for i := range core {
		core[i] = fmt.Sprintf("core-%d.grafana.app", i)
	}
	svc := newService(NewGrafanaRouter(&statusLoader{backends: backends}, nil), prometheus.NewRegistry())
	svc.middleware = true
	svc.router.loader = newEmbeddedLoader(svc.router.loader, &svc.upstream)
	svc.SetUpstream(&fakeEmbeddedAPIServer{groups: core, status: http.StatusNoContent})
	if err := svc.router.reconcile(b.Context()); err != nil {
		b.Fatal(err)
	}
	if got := len(*svc.router.snapshot.Load()); got != len(backends)+len(core) {
		b.Fatalf("serving %d groups, want %d", got, len(backends)+len(core))
	}
	next := http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		b.Error("root discovery is the router's")
	})
	for _, path := range []string{apisPrefix, openapiV3Prefix} {
		b.Run(path, func(b *testing.B) {
			req := newAuthenticatedRequest(http.MethodGet, path, nil)
			req.Header.Set("Accept", "application/json")
			w := &benchmarkResponseWriter{header: make(http.Header)}
			b.ReportAllocs()
			for b.Loop() {
				clear(w.header)
				svc.HandleFunc(w, req, next)
			}
		})
	}
}

// benchmarkRoundTripper answers every request with body, from memory.
type benchmarkRoundTripper struct{ body []byte }

func (rt benchmarkRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	if req.Body != nil {
		_ = req.Body.Close()
	}
	return &http.Response{
		StatusCode: http.StatusOK, Proto: "HTTP/1.1", ProtoMajor: 1, ProtoMinor: 1,
		Header:        http.Header{"Content-Type": {"application/json"}, "Content-Length": {strconv.Itoa(len(rt.body))}},
		ContentLength: int64(len(rt.body)), Body: io.NopCloser(bytes.NewReader(rt.body)), Request: req,
	}, nil
}

// newBenchmarkAggregateBackend builds an aggregate backend for group, with the
// discovery its target's poll would have supplied.
func newBenchmarkAggregateBackend(b testing.TB, group string, rt http.RoundTripper) Backend {
	b.Helper()
	base, err := url.Parse("https://backend.example.com")
	if err != nil {
		b.Fatal(err)
	}
	discovery := benchmarkGroupDiscovery(group)
	backend, err := newDiscoveredAggregateBackend("bench", discoveredGroup{
		group:     metav1.APIGroup{Name: group, Versions: []metav1.GroupVersionForDiscovery{{GroupVersion: group + "/v1", Version: "v1"}}},
		discovery: &discovery,
	}, base, rt)
	if err != nil {
		b.Fatal(err)
	}
	return backend
}

func benchmarkGroupDiscovery(group string) apidiscoveryv2.APIGroupDiscovery {
	return apidiscoveryv2.APIGroupDiscovery{
		ObjectMeta: metav1.ObjectMeta{Name: group},
		Versions: []apidiscoveryv2.APIVersionDiscovery{{
			Version: "v1", Freshness: apidiscoveryv2.DiscoveryFreshnessCurrent,
			Resources: []apidiscoveryv2.APIResourceDiscovery{{
				Resource: "widgets", Scope: apidiscoveryv2.ScopeNamespace, Verbs: []string{"get", "list", "watch", "create"},
				ResponseKind: &metav1.GroupVersionKind{Group: group, Version: "v1", Kind: "Widget"},
			}},
		}},
	}
}

// BenchmarkSingleTenantForward measures a namespaced request the single-tenant
// fallback forwards to the requester's stack, which answers from memory.
func BenchmarkSingleTenantForward(b *testing.B) {
	st, err := newSingleTenantFallback(singleTenantFallbackOptions{cacheSize: 10, resolveHost: func(context.Context, int64) (singleTenantStack, error) {
		return singleTenantStack{URL: "https://stack.example.com"}, nil
	}})
	if err != nil {
		b.Fatal(err)
	}
	body := bytes.Repeat([]byte("x"), 1<<10)
	st.transport = testFallbackTransport(func(req *http.Request) (*http.Response, error) {
		return benchmarkRoundTripper{body: body}.RoundTrip(req)
	})
	req := newAuthenticatedRequest(http.MethodGet, "/apis/fallback.grafana.app/v1/namespaces/stacks-1/things", nil)
	rec := httptest.NewRecorder()
	st.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		b.Fatalf("got status %d: %s", rec.Code, rec.Body.String())
	}
	w := &benchmarkResponseWriter{header: make(http.Header)}
	b.ReportAllocs()
	for b.Loop() {
		clear(w.header)
		st.ServeHTTP(w, req)
	}
}
