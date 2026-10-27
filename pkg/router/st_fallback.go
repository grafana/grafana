package router

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"reflect"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	lru "github.com/hashicorp/golang-lru/v2"
	"go.opentelemetry.io/otel"
	"golang.org/x/sync/singleflight"
	"golang.org/x/time/rate"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

const (
	// Bound stale routing after a rename, move, or deletion; cache hits do not extend this TTL.
	singleTenantCacheTTL = 6 * time.Hour
	// Retry unknown stacks sooner so newly created stacks can become reachable.
	singleTenantNotFoundTTL   = 30 * time.Second
	singleTenantLookupTimeout = 5 * time.Second

	// Entries are small, and a cache smaller than the number of active stacks
	// sends most requests to grafana.com.
	defaultSingleTenantCacheSize        = 10000
	defaultSingleTenantBreakerCacheSize = 10000
	// Bounds grafana.com lookups for stacks that are not cached, however many
	// distinct namespaces callers send.
	defaultSingleTenantLookupRate  = 20
	defaultSingleTenantLookupBurst = 40

	// ST discovery changes very rarely, so poll it far less often than the
	// aggregate targets. Failures still retry on the shorter backoff.
	singleTenantDiscoveryInterval = 10 * time.Minute
)

// errStackOriginMismatch means the response came from a different stack than the one resolved.
var errStackOriginMismatch = errors.New("router: response came from an unexpected stack")

// counters reports the fallback's stack lookups and, when it caches
// discovery, its discovery cache lookups.
func (st *singleTenantFallback) counters() []loaderCounter {
	counters := []loaderCounter{{
		Metric:   "stack_lookups_total",
		Help:     "Single-tenant stack lookups, by result: cache_hit, resolved, not_found, throttled or error.",
		Status:   "stackLookups",
		ByResult: st.lookupsBy.byResult(),
	}}
	if st.discoveryDocs != nil {
		counters = append(counters, loaderCounter{
			Metric:   "stack_discovery_cache_total",
			Help:     "Single-tenant discovery requests looked up in the cache shared by each stack's callers, by result: hit or miss.",
			ByResult: map[string]uint64{"hit": st.discoveryHits.Load(), "miss": st.discoveryMisses.Load()},
		})
	}
	return counters
}

// singleTenantFallback forwards requests without a matching multi-tenant route to
// the single-tenant stack identified by the request namespace, or for
// cluster-scoped requests and discovery, by the requester's namespace. Although this is
// not an ideal routing path, it gives clients a single entry point that will
// resolve ALL /apis requests regardless where they live (MT, or ST)
type singleTenantFallback struct {
	// polledSource polls the default discovery from discoveryHost.
	polledSource

	cache         *lru.Cache[int64, singleTenantHost]
	breakerMu     sync.Mutex
	breakers      *lru.Cache[string, *groupBreaker]
	lookups       singleflight.Group
	lookupLimiter *rate.Limiter // nil means lookups are not rate limited
	resolveHost   func(context.Context, int64) (singleTenantStack, error)
	discoveryHost *url.URL
	transport     *http.Transport
	// tracedTransport is transport wrapped for tracing, built once for the
	// transport it wraps instead of on every request.
	tracedTransport atomic.Pointer[tracedTransport]

	lookupsBy stackLookupCounts

	// discoveryDocs is nil when discovery is not cached. discoveryFetches
	// shares one fetch among concurrent misses for the same document.
	discoveryDocs                  *stackDiscoveryCache
	discoveryFetches               singleflight.Group
	discoveryHits, discoveryMisses atomic.Uint64
}

type singleTenantFallbackOptions struct {
	cacheSize int
	// breakerCacheSize defaults to cacheSize. Breakers are keyed by stack and
	// group, so it may need to be larger than the host cache.
	breakerCacheSize int
	// lookupRate is the sustained grafana.com lookups per second; zero disables the limit.
	lookupRate  float64
	lookupBurst int
	// discoveryCacheBytes bounds the discovery documents cached per stack; zero disables the cache.
	discoveryCacheBytes int
	resolveHost         func(context.Context, int64) (singleTenantStack, error)
	discoveryHost       *url.URL
	transport           *http.Transport
}

// Idle connection bounds for the shared transport to every stack: enough per
// stack for concurrent requests, and a total that bounds the sockets held for
// thousands of stacks.
const (
	singleTenantMaxIdleConnsPerHost = 32
	singleTenantMaxIdleConns        = 1000
)

func newSingleTenantFallback(opts singleTenantFallbackOptions) (*singleTenantFallback, error) {
	cache, err := lru.New[int64, singleTenantHost](opts.cacheSize)
	if err != nil {
		return nil, err
	}

	if opts.breakerCacheSize == 0 {
		opts.breakerCacheSize = opts.cacheSize
	}
	breakers, err := lru.New[string, *groupBreaker](opts.breakerCacheSize)
	if err != nil {
		return nil, fmt.Errorf("single-tenant breaker cache: %w", err)
	}

	var limiter *rate.Limiter
	switch {
	case opts.lookupRate < 0:
		return nil, fmt.Errorf("single-tenant lookup rate must not be negative")
	case opts.lookupRate > 0:
		if opts.lookupBurst < 1 {
			return nil, fmt.Errorf("single-tenant lookup burst must be at least 1")
		}
		limiter = rate.NewLimiter(rate.Limit(opts.lookupRate), opts.lookupBurst)
	}

	var discoveryDocs *stackDiscoveryCache
	switch {
	case opts.discoveryCacheBytes < 0:
		return nil, fmt.Errorf("single-tenant discovery cache size must not be negative")
	case opts.discoveryCacheBytes > 0:
		if discoveryDocs, err = newStackDiscoveryCache(opts.discoveryCacheBytes); err != nil {
			return nil, fmt.Errorf("single-tenant discovery cache: %w", err)
		}
	}

	if opts.resolveHost == nil {
		return nil, fmt.Errorf("single-tenant host resolver is required")
	}
	if u := opts.discoveryHost; u != nil && ((u.Scheme != "http" && u.Scheme != "https") || u.Host == "") {
		return nil, fmt.Errorf("single-tenant discovery URL must be an absolute HTTP(S) URL")
	}

	if opts.transport == nil {
		opts.transport = http.DefaultTransport.(*http.Transport).Clone()
		opts.transport.ResponseHeaderTimeout = backendResponseHeaderTimeout
		// Stacks are reached over plaintext HTTP/1.1, one request per
		// connection at a time, so net/http's default of 2 idle connections per
		// host makes most concurrent requests dial again.
		opts.transport.MaxIdleConnsPerHost = singleTenantMaxIdleConnsPerHost
		opts.transport.MaxIdleConns = singleTenantMaxIdleConns
	}

	st := &singleTenantFallback{
		breakers:      breakers,
		cache:         cache,
		lookupLimiter: limiter,
		discoveryDocs: discoveryDocs,
		resolveHost:   opts.resolveHost,
		discoveryHost: opts.discoveryHost,
		transport:     opts.transport,
	}
	st.polledSource = polledSource{
		source:   sourceSingleTenant,
		fetcher:  st,
		fallback: true,
		cooldown: newCooldown(singleTenantDiscoveryInterval, defaultAggregateMinBackoff, defaultAggregateMaxBackoff),
	}
	return st, nil
}

func (st *singleTenantFallback) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	var buf [6]string
	parts := pathParts(req.URL.Path, buf[:0])
	if len(parts) > 4 && parts[0] == "apis" && parts[1] != "" && parts[2] != "" && parts[3] == "namespaces" && parts[4] != "" {
		host, err := st.hostForNamespace(req.Context(), parts[4])
		if errors.Is(err, errStackLookupThrottled) {
			w.Header().Set("Retry-After", "1")
			http.Error(w, "stack lookup throttled", http.StatusServiceUnavailable)
			return
		}
		if err != nil {
			http.Error(w, "stack lookup unavailable", http.StatusServiceUnavailable)
			return
		}
		if host == nil {
			http.NotFound(w, req)
			return
		}
		st.forward(host, parts[1], w, req, nil)
		return
	}
	// Namespaced requests require a nonempty group, so discovery cannot collide with them.
	if (req.Method == http.MethodGet || req.Method == http.MethodHead) && isSingleTenantDiscoveryPath(req.URL.Path) {
		st.serveDiscovery(w, req)
		return
	}
	if len(parts) > 3 && parts[0] == "apis" && parts[1] != "" && parts[2] != "" && parts[3] != "" && parts[3] != "namespaces" {
		st.serveClusterScoped(parts[1], w, req)
		return
	}
	http.NotFound(w, req)
}

// serveClusterScoped forwards a cluster-scoped request, such as iam's whoami,
// to the requester's own stack, since the URL names none. The stack checks
// that the token's namespace is its own, as it does for namespaced requests.
// A requester whose namespace is not a stack, such as "*", gets a 404.
func (st *singleTenantFallback) serveClusterScoped(group string, w http.ResponseWriter, req *http.Request) {
	var host *singleTenantTarget
	var err error
	if requester, _ := identity.GetRequester(req.Context()); requester != nil {
		host, err = st.hostForNamespace(req.Context(), requester.GetNamespace())
	}
	if writePrivateLookupError(w, err) {
		return
	}
	if host == nil {
		w.Header().Set("Cache-Control", "private")
		http.NotFound(w, req)
		return
	}
	st.forward(host, group, w, req, func(resp *http.Response) {
		// The same URL answers each caller from their own stack.
		resp.Header.Set("Cache-Control", privateCacheControl(resp.Header.Values("Cache-Control")))
	})
}

// writePrivateLookupError answers a failed lookup of the requester's own stack,
// on a URL that does not name it, so the answer is for this caller alone. It
// reports whether it wrote a response.
func writePrivateLookupError(w http.ResponseWriter, err error) bool {
	switch {
	case err == nil:
		return false
	case errors.Is(err, errStackLookupThrottled):
		w.Header().Set("Cache-Control", "private")
		w.Header().Set("Retry-After", "1")
		http.Error(w, "stack lookup throttled", http.StatusServiceUnavailable)
	default:
		w.Header().Set("Cache-Control", "private")
		http.Error(w, "stack lookup unavailable", http.StatusServiceUnavailable)
	}
	return true
}

// serveDiscovery answers discovery from the requester's own stack. Only a
// requester whose namespace is not a stack, such as "*", or whose stack does
// not exist, gets the discovery host's. For those, root discovery is a 404, so
// the router serves the defaults it already holds from the discovery poll.
func (st *singleTenantFallback) serveDiscovery(w http.ResponseWriter, req *http.Request) {
	var host *singleTenantTarget
	var err error
	if requester, _ := identity.GetRequester(req.Context()); requester != nil {
		host, err = st.hostForNamespace(req.Context(), requester.GetNamespace())
	}
	if writePrivateLookupError(w, err) {
		return
	}
	switch {
	case host != nil:
		st.forwardDiscovery(host, w, req)
	case st.discoveryHost == nil || isRootDiscoveryPath(req.URL.Path):
		w.Header().Set("Cache-Control", "private")
		http.NotFound(w, req)
	default:
		// The discovery host supplies metadata, never tenant resources or mutations.
		st.forwardDiscovery(&singleTenantTarget{url: st.discoveryHost}, w, req)
	}
}

func isRootDiscoveryPath(path string) bool {
	path = strings.TrimSuffix(path, "/")
	return path == apisPrefix || path == openapiV3Prefix
}

func isSingleTenantDiscoveryPath(path string) bool {
	if isRootDiscoveryPath(path) {
		return true
	}
	path = strings.TrimSuffix(path, "/")
	if rest, ok := strings.CutPrefix(path, apisPrefix+"/"); ok {
		group, version, hasVersion := strings.Cut(rest, "/")
		return group != "" && (!hasVersion || (version != "" && !strings.Contains(version, "/")))
	}
	_, _, ok := parseOpenAPIGroupVersionPath(path)
	return ok
}

type tracedTransport struct {
	base http.RoundTripper
	// meterProvider is the global meter provider the wrapper was built with.
	meterProvider any
	traced        http.RoundTripper
}

// backendTransport returns st.transport wrapped for tracing. The wrapper is
// cached for that transport, which tests replace after construction, and for
// the global meter provider it captured, which Grafana may replace. It takes
// its tracer from each request, and reads the global propagator on each
// request (newBackendTransport).
func (st *singleTenantFallback) backendTransport() http.RoundTripper {
	meterProvider := otel.GetMeterProvider()
	if cached := st.tracedTransport.Load(); cached != nil && cached.base == http.RoundTripper(st.transport) &&
		sameProvider(cached.meterProvider, meterProvider) {
		return cached.traced
	}
	traced := newBackendTransport(st.transport)
	st.tracedTransport.Store(&tracedTransport{base: st.transport, meterProvider: meterProvider, traced: traced})
	return traced
}

// sameProvider reports whether a and b are the same provider. A provider of a
// type that can't be compared counts as changed.
func sameProvider(a, b any) bool {
	if a == nil || b == nil {
		return a == b
	}
	typ := reflect.TypeOf(a)
	return typ == reflect.TypeOf(b) && typ.Comparable() && a == b
}

// forward proxies req to host. An empty group means discovery. observe, when
// set, sees the response as the stack sent it, before it is changed here.
func (st *singleTenantFallback) forward(host *singleTenantTarget, group string, w http.ResponseWriter, req *http.Request, observe func(*http.Response)) {
	proxy := &httputil.ReverseProxy{
		Rewrite: func(pr *httputil.ProxyRequest) {
			rewriteOutbound(pr, host.url)
			// SetURL clears Out.Host; an empty host keeps it that way, so the URL's host is sent.
			pr.Out.Host = host.host
		},
		Transport:     st.backendTransport(),
		ErrorHandler:  proxyErrorHandler,
		FlushInterval: streamingFlushInterval,
		BufferPool:    proxyBuffers,
		ModifyResponse: func(resp *http.Response) error {
			if err := checkStackOrigin(resp, host.slug); err != nil {
				return err
			}
			if observe != nil {
				observe(resp)
			}
			if group == "" {
				// The same discovery URL answers each caller from their own
				// stack, and a shared cache keyed on Authorization would not
				// tell X-Access-Token callers apart.
				resp.Header.Set("Cache-Control", privateCacheControl(resp.Header.Values("Cache-Control")))
			}
			return rejectBackendRedirects(resp)
		},
	}
	serveThroughBreaker(st.breakerForDestination(host.url, group), group, proxy, w, req)
}

// privateCacheControl keeps a response's Cache-Control directives, but makes
// it private: public is dropped, and private is added unless no-store already
// keeps the response out of every cache.
func privateCacheControl(values []string) string {
	var directives []string
	noStore := false
	for _, value := range values {
		for directive := range strings.SplitSeq(value, ",") {
			directive = strings.TrimSpace(directive)
			name, _, _ := strings.Cut(directive, "=")
			switch strings.ToLower(name) {
			case "", "public", "private":
				continue
			case "no-store":
				noStore = true
			}
			directives = append(directives, directive)
		}
	}
	if !noStore {
		directives = append(directives, "private")
	}
	return strings.Join(directives, ", ")
}

// checkStackOrigin guards against the connection reaching the wrong stack (for
// example a stale in-cluster DNS record).
func checkStackOrigin(resp *http.Response, slug string) error {
	if slug == "" {
		return nil
	}
	origin := resp.Header.Get("grafana-stack")
	resp.Header.Del("grafana-stack")
	if origin != "" && origin != slug {
		return fmt.Errorf("%w: expected %q, got %q", errStackOriginMismatch, slug, origin)
	}
	return nil
}

// ST groups span multiple hosts, so their handler isolates breakers by destination and group.
func (*singleTenantFallback) managesCircuitBreaking() {}

func (st *singleTenantFallback) breakerForDestination(host *url.URL, group string) *groupBreaker {
	key := host.Scheme + "://" + host.Host + "#" + group
	st.breakerMu.Lock()
	defer st.breakerMu.Unlock()
	if breaker, ok := st.breakers.Get(key); ok {
		return breaker
	}
	breaker := newGroupBreaker(key)
	st.breakers.Add(key, breaker)
	return breaker
}
