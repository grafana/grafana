package router

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"testing/synctest"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/stretchr/testify/require"
)

func TestSingleTenantDiscoveryRefreshesWithoutOtherSources(t *testing.T) {
	for _, useCloud := range []bool{false, true} {
		name := "direct loader"
		if useCloud {
			name = "cloud loader"
		}
		t.Run(name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				ctx, cancel := context.WithCancel(t.Context())
				defer cancel()
				st := newTestSingleTenantFallback(t)
				st.discoveryHost = testFallbackURL(t, "https://discovery.example.com")
				var mu sync.Mutex
				fail := true
				body := `{"groups":[{"name":"first"}]}`
				calls := 0
				st.transport = testFallbackTransport(func(*http.Request) (*http.Response, error) {
					mu.Lock()
					defer mu.Unlock()
					calls++
					if fail {
						return nil, errors.New("discovery unavailable")
					}
					return &http.Response{StatusCode: http.StatusOK, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(body))}, nil
				})
				var loader RoutesLoader = st
				if useCloud {
					cloud, err := newCloudLoader(nil, nil, nil, st)
					require.NoError(t, err)
					require.NoError(t, services.StartAndAwaitRunning(ctx, cloud))
					defer func() { require.NoError(t, services.StopAndAwaitTerminated(context.Background(), cloud)) }()
					loader = cloud
				}
				router := NewGrafanaRouter(loader)
				require.NoError(t, router.Run(ctx))
				synctest.Wait()
				require.Error(t, router.Ready(ctx))
				mu.Lock()
				require.Equal(t, 1, calls)
				mu.Unlock()
				refresh := func() {
					time.Sleep(defaultAggregatePollInterval)
					synctest.Wait()
				}
				mu.Lock()
				fail = false
				mu.Unlock()
				refresh()
				require.NoError(t, router.Ready(ctx))
				require.True(t, router.KnownGroup("first"))
				mu.Lock()
				body = `{"groups":[{"name":"second"}]}`
				mu.Unlock()
				refresh()
				require.False(t, router.KnownGroup("first"))
				require.True(t, router.KnownGroup("second"))
				mu.Lock()
				fail = true
				mu.Unlock()
				refresh()
				require.True(t, router.KnownGroup("second"))
				mu.Lock()
				fail = false
				mu.Unlock()
				mu.Lock()
				body = `{"groups":[]}`
				mu.Unlock()
				refresh()
				require.False(t, router.KnownGroup("second"))
				mu.Lock()
				require.Equal(t, 5, calls)
				mu.Unlock()
			})
		})
	}
}

func TestSingleTenantBreakersIsolateDestinations(t *testing.T) {
	for _, discoveryPath := range []string{"/apis/example/v1", "/openapi/v3/apis/example/v1", "/apis"} {
		t.Run(discoveryPath, func(t *testing.T) {
			st := newTestSingleTenantFallback(t)
			st.discoveryHost = testFallbackURL(t, "https://discovery.example.com")
			st.resolveHost = func(_ context.Context, stackID int64) (string, error) {
				if stackID == 1 {
					return "https://first.example.com", nil
				}
				return "https://second.example.com", nil
			}
			discoveryFailed := false
			tenantFailed := false
			st.transport = testFallbackTransport(func(req *http.Request) (*http.Response, error) {
				if req.URL.Host == "discovery.example.com" {
					if discoveryFailed {
						return nil, errors.New("discovery unavailable")
					}
					return &http.Response{StatusCode: http.StatusOK, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(`{"groups":[{"name":"example","versions":[{"version":"v1","groupVersion":"example/v1"}]}]}`))}, nil
				}
				if tenantFailed && req.URL.Host == "first.example.com" {
					return nil, errors.New("tenant unavailable")
				}
				return &http.Response{StatusCode: http.StatusNoContent, Header: make(http.Header), Body: http.NoBody}, nil
			})
			router := NewGrafanaRouter(st)
			require.NoError(t, router.reconcile(t.Context()))
			discoveryFailed = true
			request := func(path string) int {
				recorder := httptest.NewRecorder()
				req := httptest.NewRequest(http.MethodGet, path, nil)
				if path == "/apis" {
					req.Header.Set("Accept", aggregatedDiscoveryJSON)
				}
				router.HandleFunc(recorder, req, http.NotFoundHandler())
				return recorder.Code
			}
			for range 8 {
				request(discoveryPath)
			}
			require.Equal(t, http.StatusNoContent, request("/apis/example/v1/namespaces/stacks-1/widgets"))
			tenantFailed = true
			for range 6 {
				require.Equal(t, http.StatusBadGateway, request("/apis/example/v1/namespaces/stacks-1/widgets"))
			}
			require.Equal(t, http.StatusServiceUnavailable, request("/apis/example/v1/namespaces/stacks-1/widgets"))
			require.Equal(t, http.StatusNoContent, request("/apis/example/v1/namespaces/stacks-2/widgets"))
		})
	}
}

func TestSingleTenantDiscoveryDoesNotHandleResources(t *testing.T) {
	st := newTestSingleTenantFallback(t)
	st.discoveryHost = testFallbackURL(t, "https://discovery.example.com")
	st.transport = testFallbackTransport(func(*http.Request) (*http.Response, error) {
		t.Error("request must not reach discovery host")
		return nil, errors.New("unexpected forwarding")
	})
	for _, path := range []string{
		"/apis/example/v1/widgets",
		"/apis/example/v1/namespaces",
		"/apis/example/v1/namespaces/",
		"/apis//v1/widgets",
		"/apis/example//namespaces/stacks-1/widgets",
		"/openapi/v3/apis/example/v1/extra",
		"/openapi/unknown",
		"/healthz",
	} {
		t.Run(path, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			st.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path, nil))
			require.Equal(t, http.StatusNotFound, recorder.Code)
		})
	}
	for _, method := range []string{http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete} {
		for _, path := range []string{"/apis", "/apis/example/v1", "/openapi/v3/apis/example/v1"} {
			recorder := httptest.NewRecorder()
			st.ServeHTTP(recorder, httptest.NewRequest(method, path, nil))
			require.Equal(t, http.StatusNotFound, recorder.Code)
		}
	}
}

func TestSingleTenantDiscoveryNotificationsCoalesceAndStop(t *testing.T) {
	for _, configured := range []bool{false, true} {
		synctest.Test(t, func(t *testing.T) {
			st := newTestSingleTenantFallback(t)
			if configured {
				st.discoveryHost = testFallbackURL(t, "https://discovery.example.com")
			}
			ctx, cancel := context.WithCancel(t.Context())
			defer cancel()
			dirty, err := st.Notify(ctx)
			require.NoError(t, err)
			synctest.Wait()
			require.Empty(t, dirty)
			time.Sleep(3 * defaultAggregatePollInterval)
			synctest.Wait()
			if configured {
				require.Len(t, dirty, 1)
				<-dirty
			} else {
				require.Empty(t, dirty)
			}
			cancel()
			synctest.Wait()
			_, open := <-dirty
			require.False(t, open)
		})
	}
}
