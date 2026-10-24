package router

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/grafana/authlib/types"
	lru "github.com/hashicorp/golang-lru/v2"
	"golang.org/x/sync/singleflight"
	"golang.org/x/time/rate"
	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// loaderWithSingleTenantFallback supplies the standalone router's handler for unregistered API groups.
type loaderWithSingleTenantFallback interface {
	SingleTenantFallback() http.Handler
}

// singleTenantDiscoveryRule serves a stack's request to skip stacks: the
// router's own groups only, without the stacks' defaults or the stack itself.
func singleTenantDiscoveryRule() discoveryRule {
	return discoveryRule{
		Header:     routerOriginHeader,
		Value:      originST,
		SkipSource: true,
		Exclude:    func(e servingEntry) bool { return e.callerScoped },
	}
}

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

// singleTenantStack is what a resolver reports for a stack; the zero value means not found.
type singleTenantStack struct {
	URL       string // where the router connects
	PublicURL string // its host is sent as the Host header, when set
	Slug      string // expected grafana-stack response header, when set
}

type singleTenantTarget struct {
	url  *url.URL
	host string
	slug string
}

type singleTenantHost struct {
	host      *singleTenantTarget
	expiresAt time.Time
}

// errStackOriginMismatch means the response came from a different stack than the one resolved.
var errStackOriginMismatch = errors.New("router: response came from an unexpected stack")

// stackLookupCounts counts grafana.com stack lookups by result, for metrics.
type stackLookupCounts struct {
	cacheHit, resolved, notFound, throttled, failed atomic.Uint64
}

func (c *stackLookupCounts) record(target *singleTenantTarget, err error) {
	switch {
	case errors.Is(err, errStackLookupThrottled):
		c.throttled.Add(1)
	case err != nil:
		c.failed.Add(1)
	case target == nil:
		c.notFound.Add(1)
	default:
		c.resolved.Add(1)
	}
}

func (c *stackLookupCounts) byResult() map[string]uint64 {
	return map[string]uint64{
		"cache_hit": c.cacheHit.Load(), "resolved": c.resolved.Load(), "not_found": c.notFound.Load(),
		"throttled": c.throttled.Load(), "error": c.failed.Load(),
	}
}

// errStackLookupThrottled means the lookup rate limit was reached. It is never cached.
var errStackLookupThrottled = errors.New("router: stack lookup throttled")

// errSingleTenantDiscoveryPending keeps the router unready until the first discovery attempt.
var errSingleTenantDiscoveryPending = errors.New("router: single-tenant discovery has not run yet")

// singleTenantDiscovery is the result of the latest discovery poll: the
// last-known-good backends, and the error if that poll failed.
type singleTenantDiscovery struct {
	backends []Backend
	err      error
}

// singleTenantFallback forwards requests without a matching multi-tenant route to
// the single-tenant stack identified by the request namespace, or for
// cluster-scoped requests and discovery, by the requester's namespace. Although this is
// not an ideal routing path, it gives clients a single entry point that will
// resolve ALL /apis requests regardless where they live (MT, or ST)
type singleTenantFallback struct {
	cache         *lru.Cache[int64, singleTenantHost]
	breakerMu     sync.Mutex
	breakers      *lru.Cache[string, *groupBreaker]
	lookups       singleflight.Group
	lookupLimiter *rate.Limiter // nil means lookups are not rate limited
	resolveHost   func(context.Context, int64) (singleTenantStack, error)
	discoveryHost *url.URL
	transport     *http.Transport

	// discovery is written only by run's goroutine; nil until the first poll.
	discovery atomic.Pointer[singleTenantDiscovery]
	cooldown  *cooldown
	status    pollStatus
	lookupsBy stackLookupCounts
	// fallbackRefused counts requests refused for having crossed already.
	fallbackRefused atomic.Uint64

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

	return &singleTenantFallback{
		breakers:      breakers,
		cache:         cache,
		lookupLimiter: limiter,
		discoveryDocs: discoveryDocs,
		resolveHost:   opts.resolveHost,
		discoveryHost: opts.discoveryHost,
		transport:     opts.transport,
		cooldown:      newCooldown(singleTenantDiscoveryInterval, defaultAggregateMinBackoff, defaultAggregateMaxBackoff),
	}, nil
}

func (st *singleTenantFallback) cachedHost(stackID int64) (*singleTenantTarget, bool) {
	entry, ok := st.cache.Get(stackID)
	return entry.host, ok && time.Now().Before(entry.expiresAt)
}

func (st *singleTenantFallback) hostForNamespace(ctx context.Context, namespace string) (*singleTenantTarget, error) {
	info, err := types.ParseNamespace(namespace)
	if err != nil || info.StackID < 1 {
		return nil, nil
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if host, ok := st.cachedHost(info.StackID); ok {
		st.lookupsBy.cacheHit.Add(1)
		return host, nil
	}

	result := st.lookups.DoChan(strconv.FormatInt(info.StackID, 10), func() (any, error) {
		return st.lookupHost(ctx, info.StackID)
	})
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case result := <-result:
		if result.Err != nil {
			return nil, result.Err
		}
		return result.Val.(*singleTenantTarget), nil
	}
}

func (st *singleTenantFallback) lookupHost(ctx context.Context, stackID int64) (target *singleTenantTarget, err error) {
	if host, ok := st.cachedHost(stackID); ok {
		st.lookupsBy.cacheHit.Add(1)
		return host, nil
	}
	defer func() { st.lookupsBy.record(target, err) }()
	// Fail fast rather than queue: waiting would hold requests open under a flood.
	if st.lookupLimiter != nil && !st.lookupLimiter.Allow() {
		return nil, errStackLookupThrottled
	}
	// One caller cancelling must not cancel the lookup shared by other callers.
	lookupCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), singleTenantLookupTimeout)
	defer cancel()
	host, err := st.resolveHost(lookupCtx, stackID)
	if err != nil {
		return nil, err
	}
	if host.URL != "" {
		u, err := url.Parse(host.URL)
		if err != nil {
			return nil, err
		}
		if (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
			return nil, fmt.Errorf("invalid stack host URL: %q", host.URL)
		}
		target = &singleTenantTarget{url: u, slug: host.Slug}
		// Stacks enforce their domain, redirecting any other Host to their public URL.
		if host.PublicURL != "" {
			public, err := url.Parse(host.PublicURL)
			if err != nil {
				return nil, fmt.Errorf("invalid stack public URL: %w", err)
			}
			target.host = public.Host
		}
	}
	ttl := singleTenantCacheTTL
	if target == nil {
		ttl = singleTenantNotFoundTTL
	}
	st.cache.Add(stackID, singleTenantHost{host: target, expiresAt: time.Now().Add(ttl)})
	return target, nil
}

func (st *singleTenantFallback) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	// A request that already crossed, from a stack to the router or the other
	// way, is not sent across again: that would loop; see routerOriginHeader.
	if crossed(req) {
		st.fallbackRefused.Add(1)
		http.NotFound(w, req)
		return
	}
	parts := strings.Split(strings.TrimPrefix(req.URL.Path, "/"), "/")
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
		parts := strings.Split(rest, "/")
		return (len(parts) == 1 && parts[0] != "") || (len(parts) == 2 && parts[0] != "" && parts[1] != "")
	}
	_, _, ok := parseOpenAPIGroupVersionPath(path)
	return ok
}

// forward proxies req to host. An empty group means discovery. observe, when
// set, sees the response as the stack sent it, before it is changed here.
func (st *singleTenantFallback) forward(host *singleTenantTarget, group string, w http.ResponseWriter, req *http.Request, observe func(*http.Response)) {
	proxy := &httputil.ReverseProxy{
		Rewrite: func(pr *httputil.ProxyRequest) {
			rewriteOutbound(pr, host.url)
			// Set, not added: a stack's discovery is its own, and what a caller
			// claims about where a request came from is not believed.
			pr.Out.Header.Set(routerOriginHeader, originMT)
			// SetURL clears Out.Host; an empty host keeps it that way, so the URL's host is sent.
			pr.Out.Host = host.host
		},
		Transport:     newBackendTransport(st.transport),
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

// Backends returns the last-known-good discovered backends, and the error from
// the latest poll if it failed.
func (st *singleTenantFallback) Backends() ([]Backend, error) {
	if st.discoveryHost == nil {
		return nil, nil
	}
	d := st.discovery.Load()
	if d == nil {
		return nil, errSingleTenantDiscoveryPending
	}
	return d.backends, d.err
}

func (st *singleTenantFallback) discover(ctx context.Context) ([]Backend, error) {
	client := &http.Client{Transport: st.transport, Timeout: singleTenantLookupTimeout}

	groups, err := discoverGroupResources(ctx, client, st.discoveryHost.String())
	if err != nil {
		return nil, err
	}

	backends := make([]Backend, 0, len(groups))
	for _, discovered := range groups {
		key, err := discoveredGroupKey(discovered)
		if err != nil {
			return nil, fmt.Errorf("fingerprinting single-tenant discovery: %w", err)
		}
		backends = append(backends, &fallbackBackend{
			group:     discovered.group,
			discovery: discovered.discovery,
			key:       "st:" + key,
			st:        st,
		})
	}
	return backends, nil
}

// run polls discovery until ctx is done, paced only by st.cooldown, the same
// way as aggregateTarget.run.
func (st *singleTenantFallback) run(ctx context.Context, dirty chan<- struct{}) {
	if st.discoveryHost == nil {
		<-ctx.Done()
		return
	}
	timer := time.NewTimer(0)
	defer timer.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
			st.poll(ctx, dirty)
			timer.Reset(st.cooldown.Until(time.Now()))
		}
	}
}

// poll runs one discovery attempt. It wakes the router only when the result
// can change what Load returns: the first success, a success after a
// failure, or a change in the discovered groups.
func (st *singleTenantFallback) poll(ctx context.Context, dirty chan<- struct{}) {
	now := time.Now()
	prev := st.discovery.Load()

	backends, err := st.discover(ctx)
	if err != nil {
		st.cooldown.OnFailure(now)
		logging.FromContext(ctx).Warn("router: single-tenant discovery failed, keeping last-known-good routes", "err", err)
		next := &singleTenantDiscovery{err: err}
		if prev != nil {
			next.backends = prev.backends
		}
		st.discovery.Store(next)
		if st.status.recordFailure() {
			wake(dirty)
		}
		return
	}
	st.cooldown.OnSuccess(now)
	st.discovery.Store(&singleTenantDiscovery{backends: backends})
	st.status.recordSuccess(now)

	if prev != nil && prev.err == nil && sameKeySet(backendKeys(prev.backends), backendKeys(backends)) {
		return
	}
	select {
	case dirty <- struct{}{}:
	default: // already pending; coalesce
	}
}

func backendKeys(backends []Backend) map[string]struct{} {
	keys := make(map[string]struct{}, len(backends))
	for _, b := range backends {
		keys[b.Key()] = struct{}{}
	}
	return keys
}

var (
	_ Backend               = (*fallbackBackend)(nil)
	_ CallerScopedDiscovery = (*fallbackBackend)(nil)
)

type fallbackBackend struct {
	group     v1.APIGroup
	discovery *apidiscoveryv2.APIGroupDiscovery
	key       string
	st        http.Handler
}

// Discovery implements [DiscoveryProvider] with the resources from the last poll.
func (f *fallbackBackend) Discovery() (apidiscoveryv2.APIGroupDiscovery, bool) {
	if f.discovery == nil {
		return apidiscoveryv2.APIGroupDiscovery{}, false
	}
	return *f.discovery, true
}

// Group implements [Backend].
func (f *fallbackBackend) Group() v1.APIGroup {
	return f.group
}

// Source implements [Backend].
func (f *fallbackBackend) Source() string { return sourceSingleTenant }

// Key implements [Backend].
func (f *fallbackBackend) Key() string {
	return f.key
}

// Load implements [Backend].
func (f *fallbackBackend) Load(context.Context) (http.Handler, error) {
	return f.st, nil
}

// CallerScopedDiscovery implements [CallerScopedDiscovery]: the discovery
// host's view of the group is only the default for callers without a stack.
func (f *fallbackBackend) CallerScopedDiscovery() {}

// maxStackResponseBytes bounds a grafana.com instance response.
const maxStackResponseBytes = 1 << 20 // 1MB

// The results of this call are cached
func newGComURLResolver(gcomBaseURL string, gcomToken string) func(context.Context, int64) (singleTenantStack, error) {
	// mirroring grafana's pkg/services/gcom
	type instance struct {
		ID   int    `json:"id"`
		Slug string `json:"slug"`
		URL  string `json:"url"`
	}

	return func(ctx context.Context, stackID int64) (singleTenantStack, error) {
		url, err := url.JoinPath(gcomBaseURL, "instances", strconv.FormatInt(stackID, 10))
		if err != nil {
			return singleTenantStack{}, err
		}

		// #nosec G704 -- the base URL is operator-controlled Grafana configuration and stackID is an integer.
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			return singleTenantStack{}, fmt.Errorf("creating gcom instance request: %w", err)
		}
		req.Header.Set("Authorization", "Bearer "+gcomToken)
		// #nosec G704 -- req targets the operator-controlled Grafana.com API URL constructed above.
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return singleTenantStack{}, fmt.Errorf("fetching gcom instance: %w", err)
		}
		defer func() { _ = resp.Body.Close() }()

		if resp.StatusCode == http.StatusNotFound {
			return singleTenantStack{}, nil
		}
		if resp.StatusCode != http.StatusOK {
			return singleTenantStack{}, fmt.Errorf("fetching gcom instance: unexpected status code %d", resp.StatusCode)
		}

		var result instance
		if err := decodeLimitedJSON(resp.Body, maxStackResponseBytes, &result); err != nil {
			return singleTenantStack{}, fmt.Errorf("decoding gcom instance: %w", err)
		}
		return singleTenantStack{
			URL:       fmt.Sprintf("http://%s-grafana-http.%s.svc.cluster.local.:80", result.Slug, "hosted-grafana"),
			PublicURL: result.URL,
			Slug:      result.Slug,
		}, nil
	}
}
