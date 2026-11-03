package router

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"testing/synctest"
	"time"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"golang.org/x/time/rate"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// cachingFallback returns an ST fallback with a discovery cache, whose stacks
// 123 and 456 are on their own hosts, and the requests that reached them.
func cachingFallback(t *testing.T, respond func(*http.Request) *http.Response) (*singleTenantFallback, func() []string) {
	t.Helper()
	st, err := newSingleTenantFallback(singleTenantFallbackOptions{
		cacheSize:           10,
		discoveryCacheBytes: 1 << 20,
		resolveHost: func(_ context.Context, stackID int64) (singleTenantStack, error) {
			switch stackID {
			case 123:
				return singleTenantStack{URL: "https://first.example.com"}, nil
			case 456:
				return singleTenantStack{URL: "https://second.example.com"}, nil
			}
			return singleTenantStack{}, nil
		},
	})
	require.NoError(t, err)
	st.discoveryHost = testFallbackURL(t, "https://discovery.example.com")
	var mu sync.Mutex
	var calls []string
	st.transport = testFallbackTransport(func(req *http.Request) (*http.Response, error) {
		mu.Lock()
		calls = append(calls, req.URL.Host+req.URL.Path)
		mu.Unlock()
		return respond(req), nil
	})
	return st, func() []string {
		mu.Lock()
		defer mu.Unlock()
		seen := calls
		calls = nil
		return seen
	}
}

func discoveryResponse(header http.Header, body string) *http.Response {
	if header == nil {
		header = http.Header{}
	}
	return &http.Response{StatusCode: http.StatusOK, Header: header, Body: io.NopCloser(strings.NewReader(body))}
}

func requestAs(user, namespace, path string) *http.Request {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	return req.WithContext(identity.WithRequester(req.Context(), &identity.StaticRequester{
		Type: types.TypeUser, UserUID: user, OrgID: 1, Namespace: namespace,
	}))
}

func TestStackDiscoveryIsSharedByTheStacksCallers(t *testing.T) {
	st, calls := cachingFallback(t, func(req *http.Request) *http.Response {
		return discoveryResponse(http.Header{"Cache-Control": {"public"}, "Vary": {"Accept"}}, req.URL.Host)
	})
	serve := func(user, namespace, path string) *httptest.ResponseRecorder {
		res := httptest.NewRecorder()
		st.ServeHTTP(res, requestAs(user, namespace, path))
		require.Equal(t, http.StatusOK, res.Code)
		require.Equal(t, "private", res.Header().Get("Cache-Control"))
		return res
	}

	for _, path := range []string{"/apis", "/apis/example", "/apis/example/v1", "/openapi/v3", "/openapi/v3/apis/example/v1"} {
		first := serve("alice", "stacks-123", path)
		require.Equal(t, "first.example.com", first.Body.String())
		require.Equal(t, []string{"first.example.com" + path}, calls())

		// Another caller of the same stack is served from the cache.
		second := serve("bob", "stacks-123", path)
		require.Equal(t, "first.example.com", second.Body.String())
		require.Equal(t, first.Header().Get("ETag"), second.Header().Get("ETag"))
		require.Empty(t, calls())

		// Another stack is not.
		require.Equal(t, "second.example.com", serve("carol", "stacks-456", path).Body.String())
		require.Equal(t, []string{"second.example.com" + path}, calls())
	}
	// Callers without a stack share the discovery host's group discovery.
	serve("dave", "*", "/apis/example/v1")
	serve("erin", "default", "/apis/example/v1")
	require.Equal(t, []string{"discovery.example.com/apis/example/v1"}, calls())
	require.Equal(t, uint64(6), st.discoveryHits.Load())
	require.Equal(t, uint64(11), st.discoveryMisses.Load())
}

func TestStackDiscoveryCacheKeepsRepresentationsApart(t *testing.T) {
	st, calls := cachingFallback(t, func(req *http.Request) *http.Response {
		return discoveryResponse(nil, req.Header.Get("Accept"))
	})
	for range 2 {
		for _, accept := range []string{"application/json", aggregatedDiscoveryJSON} {
			req := requestAs("alice", "stacks-123", "/openapi/v3/apis/example/v1")
			req.Header.Set("Accept", accept)
			res := httptest.NewRecorder()
			st.ServeHTTP(res, req)
			require.Equal(t, accept, res.Body.String())
		}
	}
	require.Len(t, calls(), 2)
}

func TestStackDiscoveryCacheStoresOnlySharedResponses(t *testing.T) {
	for name, respond := range map[string]func() *http.Response{
		"refused": func() *http.Response {
			return &http.Response{StatusCode: http.StatusForbidden, Header: http.Header{}, Body: io.NopCloser(strings.NewReader("no"))}
		},
		"private":           func() *http.Response { return discoveryResponse(http.Header{"Cache-Control": {"private"}}, "ok") },
		"no-store":          func() *http.Response { return discoveryResponse(http.Header{"Cache-Control": {"no-store"}}, "ok") },
		"no-cache":          func() *http.Response { return discoveryResponse(http.Header{"Cache-Control": {"no-cache"}}, "ok") },
		"varies by caller":  func() *http.Response { return discoveryResponse(http.Header{"Vary": {"Authorization"}}, "ok") },
		"sets a cookie":     func() *http.Response { return discoveryResponse(http.Header{"Set-Cookie": {"session=1"}}, "ok") },
		"too large to keep": func() *http.Response { return discoveryResponse(nil, strings.Repeat("x", 65)) },
	} {
		t.Run(name, func(t *testing.T) {
			previous := maxSingleTenantCachedDiscoveryBytes
			maxSingleTenantCachedDiscoveryBytes = 64
			t.Cleanup(func() { maxSingleTenantCachedDiscoveryBytes = previous })
			st, calls := cachingFallback(t, func(*http.Request) *http.Response { return respond() })
			for _, user := range []string{"alice", "bob"} {
				res := httptest.NewRecorder()
				st.ServeHTTP(res, requestAs(user, "stacks-123", "/apis/example/v1"))
				want := respond()
				body, err := io.ReadAll(want.Body)
				require.NoError(t, err)
				require.NoError(t, want.Body.Close())
				require.Equal(t, want.StatusCode, res.Code)
				require.Equal(t, string(body), res.Body.String())
			}
			want := 2
			if name == "too large to keep" {
				want = 3 // the first caller fetches again to stream it; later callers stream at once
			}
			require.Len(t, calls(), want)
		})
	}
}

func TestStackDiscoveryCacheConditionalRequests(t *testing.T) {
	st, calls := cachingFallback(t, func(req *http.Request) *http.Response {
		require.Empty(t, req.Header.Get("If-None-Match"), "a miss must fetch a body to cache")
		return discoveryResponse(nil, "document")
	})
	res := httptest.NewRecorder()
	st.ServeHTTP(res, requestAs("alice", "stacks-123", "/apis/example/v1"))
	etag := res.Header().Get("ETag")
	require.NotEmpty(t, etag)

	for _, user := range []string{"alice", "bob"} {
		req := requestAs(user, "stacks-123", "/apis/example/v1")
		req.Header.Set("If-None-Match", etag)
		res := httptest.NewRecorder()
		st.ServeHTTP(res, req)
		require.Equal(t, http.StatusNotModified, res.Code)
		require.Empty(t, res.Body.String())
		require.Equal(t, etag, res.Header().Get("ETag"))
	}
	require.Len(t, calls(), 1)
}

func TestStackDiscoveryCacheExpires(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		st, calls := cachingFallback(t, func(*http.Request) *http.Response { return discoveryResponse(nil, "ok") })
		serve := func() {
			st.ServeHTTP(httptest.NewRecorder(), requestAs("alice", "stacks-123", "/apis/example/v1"))
		}
		serve()
		time.Sleep(singleTenantDiscoveryCacheTTL - time.Second)
		serve()
		require.Len(t, calls(), 1)
		time.Sleep(time.Second)
		serve()
		require.Len(t, calls(), 1, "an expired entry is fetched again")
	})
}

func TestStackDiscoveryCacheByteBudget(t *testing.T) {
	entry := func(body string) stackDiscoveryEntry {
		return stackDiscoveryEntry{body: []byte(body), expiresAt: time.Now().Add(time.Hour)}
	}
	// Each one-letter key with a four-byte body costs this much.
	size := stackDiscoveryEntryOverhead + 1 + 4
	c, err := newStackDiscoveryCache(2*size + 1)
	require.NoError(t, err)
	c.add("a", entry("1234"))
	c.add("b", entry("1234"))
	_, ok := c.get("a") // a is now the most recently used
	require.True(t, ok)
	c.add("c", entry("1234"))
	_, ok = c.get("b")
	require.False(t, ok, "the least recently used entry is evicted to stay within the budget")
	_, ok = c.get("a")
	require.True(t, ok)
	require.Equal(t, 2*size, c.bytes)

	// Replacing an entry accounts for the old one.
	c.add("a", entry("12"))
	require.Equal(t, 2*size-2, c.bytes)
	// An entry larger than the budget is never stored, so it can't evict
	// every other stack's entries.
	c.add("d", entry(strings.Repeat("x", 2*size)))
	_, ok = c.get("d")
	require.False(t, ok)
	require.Equal(t, 2, c.entries.Len())
	require.Equal(t, 2*size-2, c.bytes)
	// Replacing an entry with one too large drops the stale one.
	c.add("a", entry(strings.Repeat("x", 2*size)))
	_, ok = c.get("a")
	require.False(t, ok)
	require.Equal(t, size, c.bytes)
}

func TestStackDiscoveryCacheCountsKeysAndHeaders(t *testing.T) {
	c, err := newStackDiscoveryCache(1 << 20)
	require.NoError(t, err)
	key := strings.Repeat("k", 100)
	c.add(key, stackDiscoveryEntry{
		header: http.Header{"Content-Type": {"application/json"}}, body: []byte("body"), etag: `"etag"`,
		expiresAt: time.Now().Add(time.Hour),
	})
	require.Equal(t, stackDiscoveryEntryOverhead+len(key)+len("Content-Type")+len("application/json")+len("body")+len(`"etag"`), c.bytes)

	// Tiny entries can't exceed the budget in number, whatever their keys.
	small, err := newStackDiscoveryCache(10 * stackDiscoveryEntryOverhead)
	require.NoError(t, err)
	for i := range 100 {
		small.add(strings.Repeat("k", i), stackDiscoveryEntry{expiresAt: time.Now().Add(time.Hour)})
	}
	require.LessOrEqual(t, small.entries.Len(), 10)
	require.LessOrEqual(t, small.bytes, small.limit)
}

func TestStackDiscoveryCacheIgnoresHash(t *testing.T) {
	st, calls := cachingFallback(t, func(*http.Request) *http.Response { return discoveryResponse(nil, "ok") })
	for _, tc := range []struct {
		path   string
		cached bool
	}{
		{"/apis/example/v1", true},
		{"/apis/example/v1?x=1", false},
		{"/openapi/v3/apis/example/v1?hash=abc&x=1", false},
	} {
		for range 2 {
			st.ServeHTTP(httptest.NewRecorder(), requestAs("alice", "stacks-123", tc.path))
		}
		want := 2
		if tc.cached {
			want = 1
		}
		require.Len(t, calls(), want, tc.path)
	}

	// Every hash, or none, shares one entry.
	for _, path := range []string{
		"/openapi/v3/apis/example/v1?hash=abc",
		"/openapi/v3/apis/example/v1?hash=def",
		"/openapi/v3/apis/example/v1?hash=a&hash=b",
		"/openapi/v3/apis/example/v1",
	} {
		st.ServeHTTP(httptest.NewRecorder(), requestAs("alice", "stacks-123", path))
	}
	require.Len(t, calls(), 1)
}

// A stack redirects an OpenAPI hash that is no longer its document's, as
// kube-openapi does, and the router would reject the redirect as a 502.
func TestStackOpenAPIStaleHashIsNotForwarded(t *testing.T) {
	for name, cached := range map[string]bool{"cached": true, "uncached": false} {
		t.Run(name, func(t *testing.T) {
			st, _ := cachingFallback(t, func(req *http.Request) *http.Response {
				if req.URL.Query().Has("hash") {
					return &http.Response{
						StatusCode: http.StatusMovedPermanently,
						Header:     http.Header{"Location": {req.URL.Path + "?hash=new"}},
						Body:       http.NoBody,
					}
				}
				return discoveryResponse(nil, "doc")
			})
			if !cached {
				st.discoveryDocs = nil
			}
			rec := httptest.NewRecorder()
			st.ServeHTTP(rec, requestAs("alice", "stacks-123", "/openapi/v3/apis/example/v1?hash=old"))
			require.Equal(t, http.StatusOK, rec.Code)
			require.Equal(t, "doc", rec.Body.String())
		})
	}
}

func TestStackDiscoveryCacheMissesShareOneFetch(t *testing.T) {
	for _, cacheable := range []bool{true, false} {
		name := "cacheable"
		if !cacheable {
			name = "not cacheable"
		}
		t.Run(name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				release := make(chan struct{})
				st, calls := cachingFallback(t, func(req *http.Request) *http.Response {
					if req.Header.Get("X-Leader") != "" {
						<-release
					}
					header := http.Header{}
					if !cacheable {
						header.Set("Cache-Control", "private")
					}
					return discoveryResponse(header, "for "+req.Header.Get("X-Caller"))
				})
				users := []string{"alice", "bob", "carol"}
				bodies := make([]string, len(users))
				var wg sync.WaitGroup
				for i, user := range users {
					req := requestAs(user, "stacks-123", "/apis/example/v1")
					req.Header.Set("X-Caller", user)
					if i == 0 {
						req.Header.Set("X-Leader", "1")
					}
					wg.Go(func() {
						res := httptest.NewRecorder()
						st.ServeHTTP(res, req)
						bodies[i] = res.Body.String()
					})
					if i == 0 {
						synctest.Wait() // alice's fetch is in flight, and the others join it
					}
				}
				synctest.Wait()
				close(release)
				wg.Wait()

				if cacheable {
					require.Len(t, calls(), 1)
					require.Equal(t, []string{"for alice", "for alice", "for alice"}, bodies)
					return
				}
				// A response the stack kept private is only ever for the caller who fetched it.
				require.Len(t, calls(), 3)
				require.Equal(t, []string{"for alice", "for bob", "for carol"}, bodies)
			})
		})
	}
}

func TestStackDiscoveryCacheWaiterLeaves(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		release := make(chan struct{})
		st, calls := cachingFallback(t, func(*http.Request) *http.Response {
			<-release
			return discoveryResponse(nil, "ok")
		})
		leader := httptest.NewRecorder()
		var wg sync.WaitGroup
		wg.Go(func() { st.ServeHTTP(leader, requestAs("alice", "stacks-123", "/apis/example/v1")) })
		synctest.Wait()

		waiter := requestAs("bob", "stacks-123", "/apis/example/v1")
		ctx, cancel := context.WithCancel(waiter.Context())
		waiter = waiter.WithContext(ctx)
		done := make(chan struct{})
		go func() {
			st.ServeHTTP(httptest.NewRecorder(), waiter)
			close(done)
		}()
		synctest.Wait()
		cancel()
		<-done // bob stops waiting on alice's fetch

		close(release)
		wg.Wait()
		require.Equal(t, "ok", leader.Body.String())
		require.Len(t, calls(), 1)
	})
}

func TestNewSingleTenantFallbackDiscoveryCacheSize(t *testing.T) {
	resolve := func(context.Context, int64) (singleTenantStack, error) { return singleTenantStack{}, nil }
	st, err := newSingleTenantFallback(singleTenantFallbackOptions{cacheSize: 1, resolveHost: resolve})
	require.NoError(t, err)
	require.Nil(t, st.discoveryDocs, "zero disables the cache")

	_, err = newSingleTenantFallback(singleTenantFallbackOptions{cacheSize: 1, discoveryCacheBytes: -1, resolveHost: resolve})
	require.ErrorContains(t, err, "must not be negative")
}

func TestRouterRootDiscoveryIsSharedByTheStacksCallers(t *testing.T) {
	st, calls := cachingFallback(t, func(req *http.Request) *http.Response {
		group := "default.grafana.app"
		if req.URL.Host == "first.example.com" {
			group = "stack.grafana.app"
		}
		return discoveryResponse(http.Header{"Content-Type": {"application/json"}},
			`{"kind":"APIGroupList","apiVersion":"v1","groups":[{"name":"`+group+`","versions":[{"groupVersion":"`+group+`/v1","version":"v1"}]}]}`)
	})
	router := NewGrafanaRouter(fallbackLoader{st}, nil)
	router.unregisteredGroupHandler = st
	pollDiscovery(t, st)
	require.NoError(t, router.reconcile(t.Context()))
	calls()

	for _, user := range []string{"alice", "bob", "carol"} {
		req := requestAs(user, "stacks-123", apisPrefix)
		req.Header.Set("Accept", "application/json")
		res := httptest.NewRecorder()
		router.HandleFunc(res, req)
		require.Equal(t, http.StatusOK, res.Code)
		require.Contains(t, res.Body.String(), "stack.grafana.app")
		require.NotContains(t, res.Body.String(), "default.grafana.app")
	}
	require.Equal(t, []string{"first.example.com/apis"}, calls())
}

func TestRouterRevalidatesCallerScopedOpenAPI(t *testing.T) {
	st, calls := cachingFallback(t, func(req *http.Request) *http.Response {
		require.Empty(t, req.Header.Get("If-None-Match"), "the stack is only asked for a body to cache")
		if req.URL.Path == apisPrefix {
			return discoveryResponse(http.Header{"Content-Type": {"application/json"}},
				`{"kind":"APIGroupList","apiVersion":"v1","groups":[{"name":"example","versions":[{"groupVersion":"example/v1","version":"v1"}]}]}`)
		}
		return discoveryResponse(nil, "document")
	})
	router := NewGrafanaRouter(fallbackLoader{st}, nil)
	router.unregisteredGroupHandler = st
	pollDiscovery(t, st)
	require.NoError(t, router.reconcile(t.Context()))
	require.True(t, router.KnownGroup("example"))
	calls()

	serve := func(user, etag string) *httptest.ResponseRecorder {
		req := requestAs(user, "stacks-123", "/openapi/v3/apis/example/v1?hash=st")
		if etag != "" {
			req.Header.Set("If-None-Match", etag)
		}
		res := httptest.NewRecorder()
		router.HandleFunc(res, req)
		return res
	}
	first := serve("alice", "")
	require.Equal(t, http.StatusOK, first.Code)
	etag := first.Header().Get("ETag")
	require.NotEmpty(t, etag)
	for _, user := range []string{"alice", "bob"} {
		res := serve(user, etag)
		require.Equal(t, http.StatusNotModified, res.Code)
		require.Equal(t, etag, res.Header().Get("ETag"))
		require.Empty(t, res.Body.String())
	}
	require.Equal(t, []string{"first.example.com/openapi/v3/apis/example/v1"}, calls())
}

func TestSingleTenantDiscoveryErrorsArePrivate(t *testing.T) {
	st, calls := cachingFallback(t, func(*http.Request) *http.Response { return discoveryResponse(nil, "ok") })
	st.resolveHost = func(context.Context, int64) (singleTenantStack, error) {
		return singleTenantStack{}, context.DeadlineExceeded
	}
	for _, tc := range []struct {
		name, namespace, path string
		status                int
		throttle              bool
	}{
		{name: "lookup failed", namespace: "stacks-123", path: "/apis/example/v1", status: http.StatusServiceUnavailable},
		{name: "lookup throttled", namespace: "stacks-123", path: "/apis/example/v1", status: http.StatusServiceUnavailable, throttle: true},
		{name: "defaults held by the router", namespace: "*", path: "/apis", status: http.StatusNotFound},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if tc.throttle {
				st.lookupLimiter = rate.NewLimiter(0, 0)
			}
			res := httptest.NewRecorder()
			st.ServeHTTP(res, requestAs("alice", tc.namespace, tc.path))
			require.Equal(t, tc.status, res.Code)
			require.Equal(t, "private", res.Header().Get("Cache-Control"))
			require.Empty(t, calls())
		})
	}
}
