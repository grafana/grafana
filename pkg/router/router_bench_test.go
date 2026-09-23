package router

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
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
		router := NewGrafanaRouter(dummyRoutesLoader{groups: groups})
		// Reconcile synchronously so every measurement starts with loaded routes.
		if err := router.reconcile(b.Context()); err != nil {
			b.Fatal(err)
		}
		next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusNoContent)
		})
		group := groups[len(groups)-1]
		for _, tc := range []struct {
			name string
			path string
			code int
		}{
			{"resource", "/apis/" + group + "/v0alpha1/namespaces/default/widgets", http.StatusOK},
			{"group_discovery", "/apis/" + group, http.StatusOK},
			{"unknown_group", "/apis/unknown.grafana.app/v0alpha1/widgets", http.StatusNoContent},
			{"outside_apis", "/healthz", http.StatusNoContent},
			{"api_discovery", "/apis", http.StatusOK},
			{"openapi_index", "/openapi/v3", http.StatusOK},
			{"openapi_cached", "/openapi/v3/apis/" + group + "/v0alpha1", http.StatusOK},
			{"openapi_unknown_group", "/openapi/v3/apis/unknown.grafana.app/v0alpha1", http.StatusNoContent},
			{"openapi_invalid_path", "/openapi/v3/apis/" + group, http.StatusNoContent},
		} {
			b.Run(tc.name, func(b *testing.B) {
				req := httptest.NewRequest(http.MethodGet, tc.path, nil)
				rec := httptest.NewRecorder()
				// Validate dispatch and warm the OpenAPI cache before timing.
				router.HandleFunc(rec, req, next)
				if rec.Code != tc.code {
					b.Fatalf("got status %d, want %d", rec.Code, tc.code)
				}
				w := &benchmarkResponseWriter{header: make(http.Header)}
				b.ReportAllocs()
				for b.Loop() {
					clear(w.header)
					router.HandleFunc(w, req, next)
				}
			})
		}
	})
}

func BenchmarkGrafanaRouterConditional(b *testing.B) {
	router := newBenchmarkRouter(b)
	next := http.NotFoundHandler()
	for _, path := range []string{"/apis", "/openapi/v3", "/openapi/v3/apis/app-0.grafana.app/v0alpha1"} {
		b.Run(path, func(b *testing.B) {
			req := httptest.NewRequest(http.MethodGet, path, nil)
			rec := httptest.NewRecorder()
			router.HandleFunc(rec, req, next)
			etag := rec.Header().Get("ETag")
			if rec.Code != http.StatusOK || etag == "" {
				b.Fatalf("expected 200 with ETag, got %d with %q", rec.Code, etag)
			}
			req.Header.Set("If-None-Match", etag)
			rec = httptest.NewRecorder()
			router.HandleFunc(rec, req, next)
			if rec.Code != http.StatusNotModified {
				b.Fatalf("got status %d, want 304", rec.Code)
			}
			w := &benchmarkResponseWriter{header: make(http.Header)}
			b.ReportAllocs()
			for b.Loop() {
				clear(w.header)
				router.HandleFunc(w, req, next)
			}
		})
	}
}

func BenchmarkGrafanaRouterOpenAPICacheMiss(b *testing.B) {
	for _, stale := range []bool{false, true} {
		b.Run(fmt.Sprintf("stale=%t", stale), func(b *testing.B) {
			router := newBenchmarkRouter(b)
			const cacheKey = "app-0.grafana.app/v0alpha1"
			req := httptest.NewRequest(http.MethodGet, "/openapi/v3/apis/"+cacheKey, nil)
			next := http.NotFoundHandler()
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
				router.HandleFunc(w, req, next)
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
				requests[i] = httptest.NewRequest(http.MethodGet,
					fmt.Sprintf("/apis/app-%d.grafana.app/v0alpha1/namespaces/default/widgets", i), nil)
			}
			next := http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
				b.Error("unexpected fallthrough")
			})
			b.ReportAllocs()
			b.ResetTimer()
			b.RunParallel(func(pb *testing.PB) {
				// Each worker owns its writer; requests and the router are shared.
				w := &benchmarkResponseWriter{header: make(http.Header)}
				i := 0
				for pb.Next() {
					clear(w.header)
					router.HandleFunc(w, requests[i], next)
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
					router = NewGrafanaRouter(loader)
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
	router := NewGrafanaRouter(dummyRoutesLoader{groups: groups})
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
