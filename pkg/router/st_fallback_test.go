package router

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fallbackRoundTripper func(*http.Request) (*http.Response, error)

func (f fallbackRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func testFallbackTransport(fn fallbackRoundTripper) *http.Transport {
	transport := &http.Transport{}
	transport.RegisterProtocol("http", fn)
	transport.RegisterProtocol("https", fn)
	return transport
}

func testFallbackURL(t *testing.T, raw string) *url.URL {
	t.Helper()
	if raw == "" {
		return nil
	}
	u, err := url.Parse(raw)
	require.NoError(t, err)
	return u
}

func targetURL(target *singleTenantTarget) *url.URL {
	if target == nil {
		return nil
	}
	return target.url
}

func newTestSingleTenantFallback(t *testing.T) *singleTenantFallback {
	t.Helper()
	st, err := newSingleTenantFallback(singleTenantFallbackOptions{cacheSize: 500, resolveHost: func(context.Context, int64) (singleTenantStack, error) {
		t.Error("unexpected lookup: test must provide a resolver")
		return singleTenantStack{}, errors.New("unexpected lookup")
	}})
	require.NoError(t, err)
	return st
}

// pollDiscovery runs one discovery poll, as the loader's poll loop would.
func pollDiscovery(t *testing.T, st *singleTenantFallback) {
	t.Helper()
	st.poll(t.Context(), make(chan struct{}, 1))
}

func TestNewSingleTenantFallbackInvalidCacheSize(t *testing.T) {
	for _, size := range []int{0, -1} {
		st, err := newSingleTenantFallback(singleTenantFallbackOptions{cacheSize: size})
		require.Error(t, err)
		require.Nil(t, st)
	}
}

func TestNewSingleTenantFallbackInvalidLimits(t *testing.T) {
	resolve := func(context.Context, int64) (singleTenantStack, error) { return singleTenantStack{}, nil }
	for name, opts := range map[string]singleTenantFallbackOptions{
		"negative breaker cache size": {cacheSize: 1, breakerCacheSize: -1, resolveHost: resolve},
		"negative lookup rate":        {cacheSize: 1, lookupRate: -1, resolveHost: resolve},
		"rate without burst":          {cacheSize: 1, lookupRate: 1, resolveHost: resolve},
	} {
		t.Run(name, func(t *testing.T) {
			st, err := newSingleTenantFallback(opts)
			require.Error(t, err)
			require.Nil(t, st)
		})
	}
}

func TestSingleTenantFallbackLookupRateLimit(t *testing.T) {
	var lookups atomic.Int32
	st, err := newSingleTenantFallback(singleTenantFallbackOptions{
		cacheSize: 10,
		// One token, and effectively no refill during the test.
		lookupRate:  0.001,
		lookupBurst: 1,
		resolveHost: func(_ context.Context, stackID int64) (singleTenantStack, error) {
			lookups.Add(1)
			return singleTenantStack{URL: "https://tenant.example.com"}, nil
		},
		transport: testFallbackTransport(func(*http.Request) (*http.Response, error) {
			return &http.Response{StatusCode: http.StatusNoContent, Header: make(http.Header), Body: http.NoBody}, nil
		}),
	})
	require.NoError(t, err)
	serve := func(namespace string) *httptest.ResponseRecorder {
		recorder := httptest.NewRecorder()
		st.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/apis/example/v1/namespaces/"+namespace+"/widgets", nil))
		return recorder
	}

	require.Equal(t, http.StatusNoContent, serve("stacks-1").Code)

	throttled := serve("stacks-2")
	require.Equal(t, http.StatusServiceUnavailable, throttled.Code)
	require.Equal(t, "1", throttled.Header().Get("Retry-After"))

	// A cached stack needs no lookup, so the limit does not apply.
	require.Equal(t, http.StatusNoContent, serve("stacks-1").Code)
	require.EqualValues(t, 1, lookups.Load())

	// A throttled lookup must not be cached as "not found".
	st.lookupLimiter = nil
	require.Equal(t, http.StatusNoContent, serve("stacks-2").Code)
	require.EqualValues(t, 2, lookups.Load())
}

func TestSingleTenantFallbackLookupRechecksCache(t *testing.T) {
	st := newTestSingleTenantFallback(t)
	st.cache.Add(123, singleTenantHost{
		host: &singleTenantTarget{url: testFallbackURL(t, "https://cached.example.com/")}, expiresAt: time.Now().Add(singleTenantCacheTTL),
	})
	host, err := st.lookupHost(t.Context(), 123)
	require.NoError(t, err)
	require.Equal(t, testFallbackURL(t, "https://cached.example.com/"), targetURL(host))
}

func TestSingleTenantFallbackHostForNamespace(t *testing.T) {
	for _, tc := range []struct {
		namespace, host string
	}{
		{"stacks-123", "https://first.example.com/"},
		{"stacks-456", "https://second.example.com/"},
		{"stacks-234", ""},
		{"default", ""},
		{"org-2", ""},
		{"unknown", ""},
		{"", ""},
		{"stacks-0", ""},
		{"stacks--1", ""},
		{"stacks-invalid", ""},
	} {
		t.Run(tc.namespace, func(t *testing.T) {
			st := newTestSingleTenantFallback(t)
			st.resolveHost = func(_ context.Context, stackID int64) (singleTenantStack, error) {
				return map[int64]singleTenantStack{
					123: {URL: "https://first.example.com/"},
					456: {URL: "https://second.example.com/"},
				}[stackID], nil
			}
			host, err := st.hostForNamespace(t.Context(), tc.namespace)
			require.NoError(t, err)
			require.Equal(t, testFallbackURL(t, tc.host), targetURL(host))
			host, err = st.hostForNamespace(t.Context(), tc.namespace)
			require.NoError(t, err)
			require.Equal(t, testFallbackURL(t, tc.host), targetURL(host))
			if tc.host == "" && tc.namespace != "stacks-234" {
				require.Zero(t, st.cache.Len())
			} else {
				require.Equal(t, 1, st.cache.Len())
			}
		})
	}
}

func TestSingleTenantFallbackServeHTTP(t *testing.T) {
	for _, tc := range []struct {
		path     string
		resolved bool
	}{
		{"/apis/example.grafana.app/v1/namespaces/stacks-123/widgets?limit=10", true},
		{"/apis/example.grafana.app/v1/namespaces/stacks-123", true},
		{"/apis/example.grafana.app/v1/namespaces/default/widgets", false},
		{"/apis/example.grafana.app/v1/namespaces/stacks-234/widgets", false},
		{"/apis/example.grafana.app/v1/namespaces/stacks-invalid/widgets", false},
		{"/apis/example.grafana.app/v1/widgets", false},
		{"/apis/example.grafana.app/v1", false},
		{"/apis/example.grafana.app", false},
		{"/apis/example.grafana.app/", false},
		{"/apis/example.grafana.app/v1/namespaces", false},
		{"/apis/example.grafana.app/v1/namespaces/", false},
		{"/apis/example.grafana.app/v1/widgets/namespaces/stacks-123", false},
		{"/apis//v1/namespaces/stacks-123/widgets", false},
		{"/apis/example.grafana.app//namespaces/stacks-123/widgets", false},
		{"/apis//", false},
		{"/apis", false},
		{"/apisfoo/v1/namespaces/stacks-123/widgets", false},
		{"/healthz", false},
		{"/openapi/v3/apis/unknown/v1", false},
	} {
		t.Run(tc.path, func(t *testing.T) {
			st := newTestSingleTenantFallback(t)
			st.resolveHost = func(_ context.Context, stackID int64) (singleTenantStack, error) {
				if stackID == 123 {
					return singleTenantStack{URL: "https://first.example.com/"}, nil
				}
				return singleTenantStack{}, nil
			}
			var forwarded int
			st.transport = testFallbackTransport(func(req *http.Request) (*http.Response, error) {
				forwarded++
				require.Equal(t, "first.example.com", req.URL.Host)
				require.Equal(t, "https", req.URL.Scheme)
				return &http.Response{StatusCode: http.StatusAccepted, Header: http.Header{"X-Backend": {"tenant"}}, Body: io.NopCloser(strings.NewReader("forwarded"))}, nil
			})
			for range 2 {
				req := httptest.NewRequest(http.MethodGet, tc.path, nil)
				recorder := httptest.NewRecorder()
				st.ServeHTTP(recorder, req)
				if !tc.resolved {
					require.Equal(t, http.StatusNotFound, recorder.Code)
					require.Equal(t, "404 page not found\n", recorder.Body.String())
					continue
				}
				require.Equal(t, http.StatusAccepted, recorder.Code)
				require.Equal(t, "tenant", recorder.Header().Get("X-Backend"))
				require.Equal(t, "forwarded", recorder.Body.String())
			}
			if tc.resolved {
				require.Equal(t, 2, forwarded)
			} else {
				require.Zero(t, forwarded)
			}
		})
	}
}

func TestSingleTenantFallbackConcurrentLookups(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		st := newTestSingleTenantFallback(t)
		var calls atomic.Int32
		release := make(chan struct{})
		st.resolveHost = func(ctx context.Context, stackID int64) (singleTenantStack, error) {
			calls.Add(1)
			if stackID == 123 {
				select {
				case <-release:
				case <-ctx.Done():
					return singleTenantStack{}, ctx.Err()
				}
			}
			return singleTenantStack{URL: "http://resolved.grafana.net/"}, nil
		}
		st.cache.Add(789, singleTenantHost{host: &singleTenantTarget{url: testFallbackURL(t, "https://cached.example.com/")}, expiresAt: time.Now().Add(singleTenantCacheTTL)})
		ctx, cancel := context.WithCancel(t.Context())
		first := make(chan error, 1)
		go func() {
			_, err := st.hostForNamespace(ctx, "stacks-123")
			first <- err
		}()
		synctest.Wait()
		second := make(chan *url.URL, 1)
		go func() {
			host, err := st.hostForNamespace(t.Context(), "stacks-0123")
			if err != nil {
				t.Error(err)
			}
			second <- targetURL(host)
		}()
		synctest.Wait()
		require.EqualValues(t, 1, calls.Load())
		cancel()
		synctest.Wait()
		require.ErrorIs(t, <-first, context.Canceled)

		host, err := st.hostForNamespace(t.Context(), "stacks-789")
		require.NoError(t, err)
		require.Equal(t, testFallbackURL(t, "https://cached.example.com/"), targetURL(host))
		host, err = st.hostForNamespace(t.Context(), "stacks-456")
		require.NoError(t, err)
		require.Equal(t, testFallbackURL(t, "http://resolved.grafana.net/"), targetURL(host))
		require.EqualValues(t, 2, calls.Load())

		close(release)
		require.Equal(t, testFallbackURL(t, "http://resolved.grafana.net/"), <-second)
		host, err = st.hostForNamespace(t.Context(), "stacks-123")
		require.NoError(t, err)
		require.Equal(t, testFallbackURL(t, "http://resolved.grafana.net/"), targetURL(host))
		require.EqualValues(t, 2, calls.Load())
	})
}

func TestSingleTenantFallbackCacheExpiry(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		st := newTestSingleTenantFallback(t)
		var calls atomic.Int32
		st.resolveHost = func(context.Context, int64) (singleTenantStack, error) {
			if calls.Add(1) == 1 {
				return singleTenantStack{URL: "http://old.grafana.net/"}, nil
			}
			return singleTenantStack{URL: "http://new.grafana.net/"}, nil
		}
		host, err := st.hostForNamespace(t.Context(), "stacks-123")
		require.NoError(t, err)
		require.Equal(t, testFallbackURL(t, "http://old.grafana.net/"), targetURL(host))
		host, err = st.hostForNamespace(t.Context(), "stacks-123")
		require.NoError(t, err)
		require.Equal(t, testFallbackURL(t, "http://old.grafana.net/"), targetURL(host))
		require.EqualValues(t, 1, calls.Load())
		time.Sleep(singleTenantCacheTTL)
		host, err = st.hostForNamespace(t.Context(), "stacks-123")
		require.NoError(t, err)
		require.Equal(t, testFallbackURL(t, "http://new.grafana.net/"), targetURL(host))
		require.EqualValues(t, 2, calls.Load())
	})
}

func TestSingleTenantFallbackCachesNotFound(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		st := newTestSingleTenantFallback(t)
		var calls atomic.Int32
		st.resolveHost = func(context.Context, int64) (singleTenantStack, error) {
			if calls.Add(1) == 1 {
				return singleTenantStack{}, nil
			}
			return singleTenantStack{URL: "https://found.example.com/"}, nil
		}
		for range 2 {
			recorder := httptest.NewRecorder()
			st.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/apis/example/v1/namespaces/stacks-123/widgets", nil))
			require.Equal(t, http.StatusNotFound, recorder.Code)
		}
		require.EqualValues(t, 1, calls.Load())
		cached, ok := st.cache.Peek(123)
		require.True(t, ok)
		require.Nil(t, cached.host)
		require.Equal(t, singleTenantNotFoundTTL, time.Until(cached.expiresAt))
		time.Sleep(singleTenantNotFoundTTL)
		host, err := st.hostForNamespace(t.Context(), "stacks-123")
		require.NoError(t, err)
		require.Equal(t, testFallbackURL(t, "https://found.example.com/"), targetURL(host))
		require.EqualValues(t, 2, calls.Load())
	})
}

func TestSingleTenantFallbackDoesNotCacheLookupErrors(t *testing.T) {
	st := newTestSingleTenantFallback(t)
	lookupErr := errors.New("lookup failed")
	st.resolveHost = func(context.Context, int64) (singleTenantStack, error) { return singleTenantStack{}, lookupErr }
	recorder := httptest.NewRecorder()
	st.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/apis/example/v1/namespaces/stacks-123/widgets", nil))
	require.Equal(t, http.StatusServiceUnavailable, recorder.Code)
	require.Zero(t, st.cache.Len())
	st.resolveHost = func(context.Context, int64) (singleTenantStack, error) {
		return singleTenantStack{URL: "https://recovered.example.com/"}, nil
	}
	host, err := st.hostForNamespace(t.Context(), "stacks-123")
	require.NoError(t, err)
	require.Equal(t, testFallbackURL(t, "https://recovered.example.com/"), targetURL(host))
}

func TestSingleTenantFallbackLookupTimeout(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		st := newTestSingleTenantFallback(t)
		st.resolveHost = func(ctx context.Context, _ int64) (singleTenantStack, error) {
			<-ctx.Done()
			return singleTenantStack{}, ctx.Err()
		}
		start := time.Now()
		_, err := st.hostForNamespace(t.Context(), "stacks-123")
		require.ErrorIs(t, err, context.DeadlineExceeded)
		require.Equal(t, singleTenantLookupTimeout, time.Since(start))
		require.Zero(t, st.cache.Len())
	})
}

func TestSingleTenantFallbackAlreadyCanceled(t *testing.T) {
	st := newTestSingleTenantFallback(t)
	st.resolveHost = func(context.Context, int64) (singleTenantStack, error) {
		t.Error("canceled request must not start a lookup")
		return singleTenantStack{}, nil
	}
	ctx, cancel := context.WithCancel(t.Context())
	cancel()

	host, err := st.hostForNamespace(ctx, "stacks-123")
	require.ErrorIs(t, err, context.Canceled)
	require.Empty(t, host)
	require.Zero(t, st.cache.Len())
}

func TestSingleTenantFallbackInvalidHost(t *testing.T) {
	for _, raw := range []string{"http://%", "/relative", "http:///missing-host", "ftp://example.com"} {
		t.Run(raw, func(t *testing.T) {
			st := newTestSingleTenantFallback(t)
			st.resolveHost = func(context.Context, int64) (singleTenantStack, error) { return singleTenantStack{URL: raw}, nil }
			host, err := st.hostForNamespace(t.Context(), "stacks-123")
			require.Error(t, err)
			require.Nil(t, host)
			require.Zero(t, st.cache.Len())
		})
	}
}

func TestSingleTenantFallbackInvalidPublicURL(t *testing.T) {
	st := newTestSingleTenantFallback(t)
	st.resolveHost = func(context.Context, int64) (singleTenantStack, error) {
		return singleTenantStack{URL: "https://tenant.example.com", PublicURL: "http://%"}, nil
	}
	host, err := st.hostForNamespace(t.Context(), "stacks-123")
	require.ErrorContains(t, err, "invalid stack public URL")
	require.Nil(t, host)
	require.Zero(t, st.cache.Len())
}

func TestSingleTenantFallbackForwardRequest(t *testing.T) {
	st := newTestSingleTenantFallback(t)
	st.resolveHost = func(context.Context, int64) (singleTenantStack, error) {
		return singleTenantStack{URL: "https://tenant.example.com/base?target=1"}, nil
	}
	st.discoveryHost = testFallbackURL(t, "https://discovery.example.com")
	var calls int
	st.transport = testFallbackTransport(func(req *http.Request) (*http.Response, error) {
		calls++
		require.Equal(t, "https://tenant.example.com/base/apis/example/v1/namespaces/stacks-123/widgets/a%2Fb?target=1&limit=10", req.URL.String())
		require.Empty(t, req.Host)
		require.Equal(t, http.MethodPost, req.Method)
		require.Equal(t, "Bearer test-token", req.Header.Get("Authorization"))
		require.Empty(t, req.Header.Get("X-Hop"))
		body, err := io.ReadAll(req.Body)
		require.NoError(t, err)
		require.Equal(t, "payload", string(body))
		return &http.Response{StatusCode: http.StatusCreated, Header: http.Header{"Content-Type": {"application/json"}}, Body: io.NopCloser(strings.NewReader(`{"created":true}`))}, nil
	})
	req := httptest.NewRequest(http.MethodPost, "/apis/example/v1/namespaces/stacks-123/widgets/a%2Fb?limit=10", strings.NewReader("payload"))
	req.Header.Set("Authorization", "Bearer test-token")
	req.Header.Set("Connection", "X-Hop")
	req.Header.Set("X-Hop", "remove")
	recorder := httptest.NewRecorder()
	st.ServeHTTP(recorder, req)
	require.Equal(t, 1, calls)
	require.Equal(t, http.StatusCreated, recorder.Code)
	require.Equal(t, "application/json", recorder.Header().Get("Content-Type"))
	require.JSONEq(t, `{"created":true}`, recorder.Body.String())
}

func TestSingleTenantFallbackStackHostAndOrigin(t *testing.T) {
	for _, tc := range []struct {
		name       string
		origin     string
		wantStatus int
	}{
		{name: "matching origin", origin: "stack", wantStatus: http.StatusOK},
		{name: "missing origin", wantStatus: http.StatusOK},
		{name: "mismatched origin", origin: "other", wantStatus: http.StatusBadGateway},
	} {
		t.Run(tc.name, func(t *testing.T) {
			st := newTestSingleTenantFallback(t)
			st.resolveHost = func(context.Context, int64) (singleTenantStack, error) {
				return singleTenantStack{URL: "http://stack-grafana-http.hosted-grafana.svc.cluster.local.:80", PublicURL: "https://stack.grafana.net", Slug: "stack"}, nil
			}
			var calls int
			st.transport = testFallbackTransport(func(req *http.Request) (*http.Response, error) {
				calls++
				require.Equal(t, "stack-grafana-http.hosted-grafana.svc.cluster.local.:80", req.URL.Host)
				require.Equal(t, "stack.grafana.net", req.Host)
				header := make(http.Header)
				if tc.origin != "" {
					header.Set("grafana-stack", tc.origin)
				}
				return &http.Response{StatusCode: http.StatusOK, Header: header, Body: io.NopCloser(strings.NewReader("ok"))}, nil
			})
			recorder := httptest.NewRecorder()
			st.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/apis/example/v1/namespaces/stacks-123/widgets", nil))
			require.Equal(t, 1, calls)
			require.Equal(t, tc.wantStatus, recorder.Code)
			require.Empty(t, recorder.Header().Get("grafana-stack"))
		})
	}
}

func TestSingleTenantFallbackDiscovery(t *testing.T) {
	for _, path := range []string{"/apis", "/apis/", "/apis/example", "/apis/example/v1", "/apis/example/v1/", "/openapi/v3", "/openapi/v3/apis/example/v1"} {
		t.Run(path, func(t *testing.T) {
			st := newTestSingleTenantFallback(t)
			st.discoveryHost = testFallbackURL(t, "https://discovery.example.com")
			var calls int
			st.transport = testFallbackTransport(func(req *http.Request) (*http.Response, error) {
				calls++
				require.Equal(t, "discovery.example.com", req.URL.Host)
				require.Equal(t, path, req.URL.Path)
				return &http.Response{StatusCode: http.StatusOK, Header: make(http.Header), Body: io.NopCloser(strings.NewReader("discovery"))}, nil
			})
			recorder := httptest.NewRecorder()
			st.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path, nil))
			require.Equal(t, 1, calls)
			require.Equal(t, http.StatusOK, recorder.Code)
			require.Equal(t, "discovery", recorder.Body.String())
		})
	}
}

func TestSingleTenantFallbackProxyFailure(t *testing.T) {
	for _, redirect := range []bool{false, true} {
		st := newTestSingleTenantFallback(t)
		st.resolveHost = func(context.Context, int64) (singleTenantStack, error) {
			return singleTenantStack{URL: "https://tenant.example.com"}, nil
		}
		st.transport = testFallbackTransport(func(*http.Request) (*http.Response, error) {
			if redirect {
				return &http.Response{StatusCode: http.StatusFound, Header: http.Header{"Location": {"https://other.example.com"}}, Body: io.NopCloser(strings.NewReader("redirect"))}, nil
			}
			return nil, errors.New("transport unavailable")
		})
		recorder := httptest.NewRecorder()
		st.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/apis/example/v1/namespaces/stacks-123/widgets", nil))
		require.Equal(t, http.StatusBadGateway, recorder.Code)
		require.Empty(t, recorder.Header().Get("Location"))
	}
}

func TestSingleTenantFallbackLoadWithoutDiscovery(t *testing.T) {
	st := newTestSingleTenantFallback(t)
	backends, err := st.Load(t.Context())
	require.NoError(t, err)
	require.Empty(t, backends)
}

func TestSingleTenantFallbackLoadError(t *testing.T) {
	st := newTestSingleTenantFallback(t)
	st.discoveryHost = testFallbackURL(t, "https://discovery.example.com")
	st.transport = testFallbackTransport(func(*http.Request) (*http.Response, error) {
		return nil, errors.New("discovery unavailable")
	})
	_, err := st.Load(t.Context())
	require.ErrorIs(t, err, errSingleTenantDiscoveryPending)
	pollDiscovery(t, st)
	backends, err := st.Load(t.Context())
	require.ErrorContains(t, err, "discovery unavailable")
	require.Empty(t, backends)
}

func TestSingleTenantFallbackRequiresResolver(t *testing.T) {
	_, err := newSingleTenantFallback(singleTenantFallbackOptions{cacheSize: 100})
	require.ErrorContains(t, err, "resolver is required")
}

func TestSingleTenantFallbackDiscoveryVersionsChangeKey(t *testing.T) {
	st := newTestSingleTenantFallback(t)
	st.discoveryHost = testFallbackURL(t, "https://discovery.example.com")
	version := "v1"
	st.transport = testFallbackTransport(func(req *http.Request) (*http.Response, error) {
		require.Equal(t, "/apis", req.URL.Path)
		body := `{"groups":[{"name":"example","versions":[{"version":"` + version + `","groupVersion":"example/` + version + `"}]}]}`
		return &http.Response{StatusCode: http.StatusOK, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(body))}, nil
	})
	pollDiscovery(t, st)
	first, err := st.Load(t.Context())
	require.NoError(t, err)
	require.Len(t, first, 1)
	require.Equal(t, "example", first[0].Group().Name)
	handler, err := first[0].Load(t.Context())
	require.NoError(t, err)
	require.Same(t, st, handler)
	require.Same(t, st, st.SingleTenantFallback())
	pollDiscovery(t, st)
	unchanged, err := st.Load(t.Context())
	require.NoError(t, err)
	require.Equal(t, first[0].Key(), unchanged[0].Key())
	version = "v2"
	pollDiscovery(t, st)
	second, err := st.Load(t.Context())
	require.NoError(t, err)
	require.NotEqual(t, first[0].Key(), second[0].Key())
}

func TestSingleTenantFallbackRefreshAfterStackChanges(t *testing.T) {
	for _, tc := range []struct {
		name   string
		host   string
		err    error
		status int
	}{
		{name: "renamed", host: "https://renamed.example.com", status: http.StatusNoContent},
		{name: "moved", host: "https://other-region.example.com", status: http.StatusNoContent},
		{name: "deleted", status: http.StatusNotFound},
		{name: "lookup failed", err: errors.New("gcom unavailable"), status: http.StatusServiceUnavailable},
	} {
		t.Run(tc.name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				st := newTestSingleTenantFallback(t)
				var calls atomic.Int32
				st.resolveHost = func(context.Context, int64) (singleTenantStack, error) {
					if calls.Add(1) == 1 {
						return singleTenantStack{URL: "https://old.example.com"}, nil
					}
					return singleTenantStack{URL: tc.host}, tc.err
				}
				var destinations []string
				st.transport = testFallbackTransport(func(req *http.Request) (*http.Response, error) {
					destinations = append(destinations, req.URL.Scheme+"://"+req.URL.Host)
					return &http.Response{StatusCode: http.StatusNoContent, Header: make(http.Header), Body: http.NoBody}, nil
				})
				request := func() int {
					recorder := httptest.NewRecorder()
					st.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/apis/example/v1/namespaces/stacks-123/widgets", nil))
					return recorder.Code
				}
				require.Equal(t, http.StatusNoContent, request())
				time.Sleep(singleTenantCacheTTL - time.Second)
				require.Equal(t, http.StatusNoContent, request())
				require.EqualValues(t, 1, calls.Load())
				require.Equal(t, []string{"https://old.example.com", "https://old.example.com"}, destinations)
				destinations = nil
				time.Sleep(time.Second)
				require.Equal(t, tc.status, request())
				require.Equal(t, tc.status, request())
				if tc.err != nil {
					require.EqualValues(t, 3, calls.Load())
				} else {
					require.EqualValues(t, 2, calls.Load())
				}
				if tc.status == http.StatusNoContent {
					require.Equal(t, []string{tc.host, tc.host}, destinations)
				} else {
					require.Empty(t, destinations)
				}
			})
		})
	}
}

func TestNewGComURLResolver(t *testing.T) {
	for _, tc := range []struct {
		name     string
		basePath string
		wantPath string
		status   int
		body     string
		want     singleTenantStack
		wantErr  string
	}{
		{
			name: "base URL without trailing slash", wantPath: "/instances/123",
			status: http.StatusOK, body: `{"id":123,"slug":"stack","url":"https://stack.grafana.net"}`,
			want: singleTenantStack{URL: "http://stack-grafana-http.hosted-grafana.svc.cluster.local.:80", PublicURL: "https://stack.grafana.net", Slug: "stack"},
		},
		{
			name: "base URL with trailing slash", basePath: "/", wantPath: "/instances/123",
			status: http.StatusOK, body: `{"id":123,"slug":"stack","url":"https://stack.grafana.net"}`,
			want: singleTenantStack{URL: "http://stack-grafana-http.hosted-grafana.svc.cluster.local.:80", PublicURL: "https://stack.grafana.net", Slug: "stack"},
		},
		{
			name: "base path without trailing slash", basePath: "/api", wantPath: "/api/instances/123",
			status: http.StatusOK, body: `{"id":123,"slug":"stack","url":"https://stack.grafana.net"}`,
			want: singleTenantStack{URL: "http://stack-grafana-http.hosted-grafana.svc.cluster.local.:80", PublicURL: "https://stack.grafana.net", Slug: "stack"},
		},
		{
			name: "base path with trailing slash", basePath: "/api/", wantPath: "/api/instances/123",
			status: http.StatusOK, body: `{"id":123,"slug":"stack","url":"https://stack.grafana.net"}`,
			want: singleTenantStack{URL: "http://stack-grafana-http.hosted-grafana.svc.cluster.local.:80", PublicURL: "https://stack.grafana.net", Slug: "stack"},
		},
		{
			name: "without public URL", wantPath: "/instances/123",
			status: http.StatusOK, body: `{"id":123,"slug":"stack"}`,
			want: singleTenantStack{URL: "http://stack-grafana-http.hosted-grafana.svc.cluster.local.:80", Slug: "stack"},
		},
		{
			name: "not found", wantPath: "/instances/123",
			status: http.StatusNotFound, body: "not found",
		},
		{
			name: "server error", wantPath: "/instances/123",
			status: http.StatusInternalServerError, body: "unavailable",
			wantErr: "fetching gcom instance: unexpected status code 500",
		},
		{
			name: "invalid JSON", wantPath: "/instances/123",
			status: http.StatusOK, body: "invalid JSON",
			wantErr: "decoding gcom instance",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				assert.Equal(t, http.MethodGet, r.Method)
				assert.Equal(t, tc.wantPath, r.URL.Path)
				assert.Equal(t, "Bearer test-token", r.Header.Get("Authorization"))
				w.WriteHeader(tc.status)
				_, err := io.WriteString(w, tc.body)
				assert.NoError(t, err)
			}))
			t.Cleanup(server.Close)

			resolve := newGComURLResolver(server.URL+tc.basePath, "test-token")
			stack, err := resolve(t.Context(), 123)
			if tc.wantErr != "" {
				require.ErrorContains(t, err, tc.wantErr)
			} else {
				require.NoError(t, err)
			}
			require.Equal(t, tc.want, stack)
		})
	}
}
