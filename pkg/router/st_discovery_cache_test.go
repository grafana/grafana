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
		return discoveryResponse(nil, req.Header.Get("Accept")+"?"+req.URL.RawQuery)
	})
	for range 2 {
		for _, accept := range []string{"application/json", aggregatedDiscoveryJSON} {
			for _, path := range []string{"/openapi/v3/apis/example/v1?hash=one", "/openapi/v3/apis/example/v1?hash=two"} {
				req := requestAs("alice", "stacks-123", path)
				req.Header.Set("Accept", accept)
				res := httptest.NewRecorder()
				st.ServeHTTP(res, req)
				require.Equal(t, accept+"?"+req.URL.RawQuery, res.Body.String())
			}
		}
	}
	require.Len(t, calls(), 4)
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
				require.Equal(t, want.StatusCode, res.Code)
				body, err := io.ReadAll(want.Body)
				require.NoError(t, err)
				require.Equal(t, string(body), res.Body.String())
			}
			require.Len(t, calls(), 2)
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
	c, err := newStackDiscoveryCache(10)
	require.NoError(t, err)
	entry := func(body string) stackDiscoveryEntry {
		return stackDiscoveryEntry{body: []byte(body), expiresAt: time.Now().Add(time.Hour)}
	}
	c.add("a", entry("1234"))
	c.add("b", entry("1234"))
	_, ok := c.get("a") // a is now the most recently used
	require.True(t, ok)
	c.add("c", entry("1234"))
	_, ok = c.get("b")
	require.False(t, ok, "the least recently used entry is evicted to stay within the budget")
	_, ok = c.get("a")
	require.True(t, ok)
	require.Equal(t, 8, c.bytes)

	// Replacing an entry accounts for the old one.
	c.add("a", entry("12"))
	require.Equal(t, 6, c.bytes)
	// An entry larger than the budget evicts everything, itself included.
	c.add("d", entry(strings.Repeat("x", 11)))
	require.Zero(t, c.entries.Len())
	require.Zero(t, c.bytes)
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
	router := NewGrafanaRouter(st, nil)
	router.unregisteredGroupHandler = st
	pollDiscovery(t, st)
	require.NoError(t, router.reconcile(t.Context()))
	calls()

	for _, user := range []string{"alice", "bob", "carol"} {
		req := requestAs(user, "stacks-123", apisPrefix)
		req.Header.Set("Accept", "application/json")
		res := httptest.NewRecorder()
		router.HandleFunc(res, req, http.NotFoundHandler())
		require.Equal(t, http.StatusOK, res.Code)
		require.Contains(t, res.Body.String(), "stack.grafana.app")
		require.NotContains(t, res.Body.String(), "default.grafana.app")
	}
	require.Equal(t, []string{"first.example.com/apis"}, calls())
}
