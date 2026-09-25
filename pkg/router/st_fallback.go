package router

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
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
	"github.com/sony/gobreaker/v2"
	"golang.org/x/sync/singleflight"
	"golang.org/x/time/rate"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// LoaderWithSingleTenantFallback supplies the standalone router's handler for unregistered API groups.
type LoaderWithSingleTenantFallback interface {
	SingleTenantFallback() http.Handler
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
// the single-tenant stack identified by the request namespace. Although this is
// not an ideal routing path, it gives clients a single entry point that will
// resolve ALL /apis requests regardless where they live (MT, or ST)
type singleTenantFallback struct {
	cache         *lru.Cache[int64, singleTenantHost]
	breakerMu     sync.Mutex
	breakers      *lru.Cache[string, *gobreaker.CircuitBreaker[struct{}]]
	lookups       singleflight.Group
	lookupLimiter *rate.Limiter // nil means lookups are not rate limited
	resolveHost   func(context.Context, int64) (singleTenantStack, error)
	discoveryHost *url.URL
	transport     *http.Transport

	// discovery is written only by run's goroutine; nil until the first poll.
	discovery atomic.Pointer[singleTenantDiscovery]
	cooldown  *cooldown
}

type singleTenantFallbackOptions struct {
	cacheSize int
	// breakerCacheSize defaults to cacheSize. Breakers are keyed by stack and
	// group, so it may need to be larger than the host cache.
	breakerCacheSize int
	// lookupRate is the sustained grafana.com lookups per second; zero disables the limit.
	lookupRate    float64
	lookupBurst   int
	resolveHost   func(context.Context, int64) (singleTenantStack, error)
	discoveryHost *url.URL
	transport     *http.Transport
}

func newSingleTenantFallback(opts singleTenantFallbackOptions) (*singleTenantFallback, error) {
	cache, err := lru.New[int64, singleTenantHost](opts.cacheSize)
	if err != nil {
		return nil, err
	}

	if opts.breakerCacheSize == 0 {
		opts.breakerCacheSize = opts.cacheSize
	}
	breakers, err := lru.New[string, *gobreaker.CircuitBreaker[struct{}]](opts.breakerCacheSize)
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

	if opts.resolveHost == nil {
		return nil, fmt.Errorf("single-tenant host resolver is required")
	}
	if u := opts.discoveryHost; u != nil && ((u.Scheme != "http" && u.Scheme != "https") || u.Host == "") {
		return nil, fmt.Errorf("single-tenant discovery URL must be an absolute HTTP(S) URL")
	}

	if opts.transport == nil {
		opts.transport = http.DefaultTransport.(*http.Transport).Clone()
	}

	return &singleTenantFallback{
		breakers:      breakers,
		cache:         cache,
		lookupLimiter: limiter,
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

func (st *singleTenantFallback) lookupHost(ctx context.Context, stackID int64) (*singleTenantTarget, error) {
	if host, ok := st.cachedHost(stackID); ok {
		return host, nil
	}
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
	var target *singleTenantTarget
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
		st.forward(host, parts[1], w, req)
		return
	}
	// The discovery host supplies metadata, never tenant resources or mutations.
	if st.discoveryHost != nil && (req.Method == http.MethodGet || req.Method == http.MethodHead) && isSingleTenantDiscoveryPath(req.URL.Path) {
		// Namespaced requests require a nonempty group, so discovery cannot collide with them.
		st.forward(&singleTenantTarget{url: st.discoveryHost}, "", w, req)
		return
	}
	http.NotFound(w, req)
}

func isSingleTenantDiscoveryPath(path string) bool {
	path = strings.TrimSuffix(path, "/")
	if path == apisPrefix || path == openapiV3Prefix {
		return true
	}
	if rest, ok := strings.CutPrefix(path, apisPrefix+"/"); ok {
		parts := strings.Split(rest, "/")
		return (len(parts) == 1 && parts[0] != "") || (len(parts) == 2 && parts[0] != "" && parts[1] != "")
	}
	_, _, ok := parseOpenAPIGroupVersionPath(path)
	return ok
}

func (st *singleTenantFallback) forward(host *singleTenantTarget, group string, w http.ResponseWriter, req *http.Request) {
	proxy := &httputil.ReverseProxy{
		Rewrite: func(pr *httputil.ProxyRequest) {
			pr.SetURL(host.url)
			// SetURL clears Out.Host; an empty host keeps it that way, so the URL's host is sent.
			pr.Out.Host = host.host
		},
		Transport: newBackendTransport(st.transport),
		ModifyResponse: func(resp *http.Response) error {
			if err := checkStackOrigin(resp, host.slug); err != nil {
				return err
			}
			return rejectBackendRedirects(resp)
		},
	}
	serveThroughBreaker(st.breakerForDestination(host.url, group), group, proxy, w, req)
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

func (st *singleTenantFallback) breakerForDestination(host *url.URL, group string) *gobreaker.CircuitBreaker[struct{}] {
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

// Helper function called when the fallback is directly used as a loader (testing)
func (st *singleTenantFallback) SingleTenantFallback() http.Handler {
	return st
}

// Load implements [RoutesLoader]. It returns the latest discovery snapshot and
// makes no requests.
func (st *singleTenantFallback) Load(context.Context) ([]Backend, error) {
	return st.Backends()
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

	groups, err := discoverGroups(ctx, client, st.discoveryHost.String())
	if err != nil {
		return nil, err
	}

	backends := make([]Backend, 0, len(groups))
	for _, group := range groups {
		groupJSON, err := json.Marshal(group)
		if err != nil {
			return nil, fmt.Errorf("fingerprinting single-tenant discovery: %w", err)
		}
		backends = append(backends, &fallbackBackend{
			group: group,
			key:   "st:" + hashHex(string(groupJSON)),
			st:    st,
		})
	}
	return backends, nil
}

func (st *singleTenantFallback) Notify(ctx context.Context) (<-chan struct{}, error) {
	dirty := make(chan struct{}, 1)
	go func() {
		defer close(dirty)
		st.run(ctx, dirty)
	}()
	return dirty, nil
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
		slog.Warn("router: single-tenant discovery failed, keeping last-known-good routes", "err", err)
		next := &singleTenantDiscovery{err: err}
		if prev != nil {
			next.backends = prev.backends
		}
		st.discovery.Store(next)
		return
	}
	st.cooldown.OnSuccess(now)
	st.discovery.Store(&singleTenantDiscovery{backends: backends})

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
	_ RoutesLoader = (*singleTenantFallback)(nil)
	_ Backend      = (*fallbackBackend)(nil)
)

type fallbackBackend struct {
	group v1.APIGroup
	key   string
	st    http.Handler
}

// Group implements [Backend].
func (f *fallbackBackend) Group() v1.APIGroup {
	return f.group
}

// Key implements [Backend].
func (f *fallbackBackend) Key() string {
	return f.key
}

// Load implements [Backend].
func (f *fallbackBackend) Load(context.Context) (http.Handler, error) {
	return f.st, nil
}

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
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			return singleTenantStack{}, fmt.Errorf("decoding gcom instance: %w", err)
		}
		return singleTenantStack{
			URL:       fmt.Sprintf("http://%s-grafana-http.%s.svc.cluster.local.:80", result.Slug, "hosted-grafana"),
			PublicURL: result.URL,
			Slug:      result.Slug,
		}, nil
	}
}
