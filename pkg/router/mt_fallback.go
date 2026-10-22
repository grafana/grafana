package router

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	lru "github.com/hashicorp/golang-lru/v2"
	clientrest "k8s.io/client-go/rest"
	apiregistrationv1 "k8s.io/kube-aggregator/pkg/apis/apiregistration/v1"

	"github.com/grafana/grafana-app-sdk/logging"
)

const (
	// mtRouterAddressKey, in the [cloud_router] section, is the multi-tenant
	// router that a single-tenant Grafana forwards groups it does not serve to.
	mtRouterAddressKey = "mt_router_address"
	// mtRouterCAFileKey is a PEM bundle that verifies the router's certificate,
	// for one the system roots do not trust. mtRouterInsecureKey skips
	// verification: use it only over a link that is trusted anyway.
	mtRouterCAFileKey   = "mt_router_ca_file"
	mtRouterInsecureKey = "mt_router_insecure"

	// stFallbackHeader marks a request a single-tenant stack forwarded to the
	// multi-tenant router for a group it does not serve. The router's own
	// single-tenant fallback sends unknown groups back to the stack, so
	// without the marker a group neither serves would bounce between them.
	stFallbackHeader = "X-Grafana-ST-To-Router-Fallback"
	stFallbackValue  = "true"

	// mtBreakerCacheSize bounds breakers, which are keyed by a client-supplied group.
	mtBreakerCacheSize = 1000
)

// localGroups is the set of API groups the embedded API server answers for,
// including groups the embedded kube-aggregator proxies to remote services. On
// a single-tenant Grafana that set is fixed once the server is ready, so it is
// read once, never polled.
type localGroups struct {
	// groups is nil until the snapshot succeeds.
	groups   atomic.Pointer[map[string]struct{}]
	cooldown *cooldown
}

func newLocalGroups() *localGroups {
	return &localGroups{cooldown: newCooldown(defaultAggregateMinBackoff, defaultAggregateMinBackoff, defaultAggregateMaxBackoff)}
}

// absent reports whether group is certainly not served locally. Until the
// snapshot succeeds nothing is known, so nothing is absent: requests stay with
// the embedded API server rather than risk sending a local group away.
func (l *localGroups) absent(group string) bool {
	groups := l.groups.Load()
	if groups == nil {
		return false
	}
	_, ok := (*groups)[group]
	return !ok
}

// run takes the snapshot, retrying with backoff until it succeeds or ctx is done.
func (l *localGroups) run(ctx context.Context, client *http.Client, baseURL string) {
	timer := time.NewTimer(0)
	defer timer.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
			err := l.load(ctx, client, baseURL)
			if err == nil {
				return
			}
			now := time.Now()
			l.cooldown.OnFailure(now)
			if errors.Is(err, errAPIServerNotReady) {
				logging.FromContext(ctx).Debug("router: waiting for the embedded API server before reading its groups", "err", err)
			} else {
				logging.FromContext(ctx).Warn("router: reading the embedded API server's groups failed, retrying", "err", err)
			}
			timer.Reset(l.cooldown.Until(now))
		}
	}
}

var errAPIServerNotReady = errors.New("router: embedded API server is not ready")

const apiServicesPath = "/apis/apiregistration.k8s.io/v1/apiservices"

// load stores the groups served once the API server is ready. Ready means the
// boot-sequence checks passed, which is when the aggregator has registered its
// local and remote APIServices. Discovery lists a remote group only while its
// service is available, but the group must stay with the aggregator, which
// answers for it, so the APIService objects count too.
func (l *localGroups) load(ctx context.Context, client *http.Client, baseURL string) error {
	baseURL = strings.TrimSuffix(baseURL, "/")
	if err := getOK(ctx, client, baseURL+"/readyz"); err != nil {
		return fmt.Errorf("%w: %w", errAPIServerNotReady, err)
	}

	discovered, err := discoverGroupResources(ctx, client, baseURL)
	if err != nil {
		return err
	}
	groups := make(map[string]struct{}, len(discovered))
	for _, d := range discovered {
		groups[d.group.Name] = struct{}{}
	}

	services, err := apiServiceGroups(ctx, client, baseURL+apiServicesPath)
	if err != nil {
		return err
	}
	for _, group := range services {
		groups[group] = struct{}{}
	}
	l.groups.Store(&groups)
	return nil
}

func getOK(ctx context.Context, client *http.Client, url string) error {
	// #nosec G704 -- url is the embedded API server's loopback address.
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	// #nosec G704 -- req targets the loopback address above.
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 1<<10))
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("%s returned status %d", url, resp.StatusCode)
	}
	return nil
}

// apiServiceGroups lists the groups of the aggregator's APIServices. Without
// the aggregator the API does not exist, which leaves no groups to add.
func apiServiceGroups(ctx context.Context, client *http.Client, url string) ([]string, error) {
	// #nosec G704 -- url is the embedded API server's loopback address.
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	// #nosec G704 -- req targets the loopback address above.
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()
	switch resp.StatusCode {
	case http.StatusOK:
	case http.StatusNotFound:
		return nil, nil
	default:
		return nil, fmt.Errorf("listing APIServices returned status %d", resp.StatusCode)
	}
	var list apiregistrationv1.APIServiceList
	if err := decodeLimitedJSON(resp.Body, int64(maxDiscoveryDocBytes), &list); err != nil {
		return nil, fmt.Errorf("decoding APIServiceList: %w", err)
	}
	groups := make([]string, 0, len(list.Items))
	for _, item := range list.Items {
		groups = append(groups, item.Spec.Group)
	}
	return groups, nil
}

// mtFallback forwards requests for groups the embedded API server does not
// serve to the multi-tenant router.
type mtFallback struct {
	target    *url.URL
	transport *http.Transport
	local     *localGroups

	breakerMu sync.Mutex
	breakers  *lru.Cache[string, *groupBreaker]
}

func newMTFallback(address, caFile string, insecure bool) (*mtFallback, error) {
	target, err := url.Parse(address)
	if err != nil || (target.Scheme != "http" && target.Scheme != "https") || target.Host == "" {
		return nil, fmt.Errorf("%s: %s must be an absolute HTTP(S) URL", cloudRouterSection, mtRouterAddressKey)
	}
	// Insecure would silently override the CA, which hides a misconfiguration.
	if insecure && caFile != "" {
		return nil, fmt.Errorf("%s: %s and %s cannot both be set", cloudRouterSection, mtRouterCAFileKey, mtRouterInsecureKey)
	}
	tlsCfg, err := buildAggregateTLSConfig(caFile, insecure)
	if err != nil {
		return nil, fmt.Errorf("%s: %s: %w", cloudRouterSection, mtRouterAddressKey, err)
	}
	breakers, err := lru.New[string, *groupBreaker](mtBreakerCacheSize)
	if err != nil {
		return nil, err
	}
	return &mtFallback{target: target, transport: newAggregateBaseTransport(tlsCfg), local: newLocalGroups(), breakers: breakers}, nil
}

// loaderWithMTFallback is implemented by a RoutesLoader that sends the groups
// the embedded API server does not serve to the multi-tenant router. Only the
// cloud loader does, so the behavior exists only where it is configured.
type loaderWithMTFallback interface {
	MultiTenantFallback() *mtFallback
}

// handles reports whether req is for a group that is not served locally. A
// request already marked as forwarded is never sent again, which also stops a
// stack whose address points at itself.
func (m *mtFallback) handles(req *http.Request, group string) bool {
	return group != "" && req.Header.Get(stFallbackHeader) == "" && m.local.absent(group)
}

func (m *mtFallback) serve(w http.ResponseWriter, req *http.Request, group string) {
	proxy := &httputil.ReverseProxy{
		Rewrite: func(pr *httputil.ProxyRequest) {
			rewriteOutbound(pr, m.target)
			pr.Out.Header.Set(stFallbackHeader, stFallbackValue)
		},
		Transport:     newBackendTransport(m.transport),
		ErrorHandler:  proxyErrorHandler,
		FlushInterval: streamingFlushInterval,
		ModifyResponse: func(resp *http.Response) error {
			return rejectBackendRedirects(resp)
		},
	}
	serveThroughBreaker(m.breakerFor(group), group, proxy, w, req)
}

func (m *mtFallback) breakerFor(group string) *groupBreaker {
	key := strings.TrimSuffix(m.target.String(), "/") + "#" + group
	m.breakerMu.Lock()
	defer m.breakerMu.Unlock()
	if breaker, ok := m.breakers.Get(key); ok {
		return breaker
	}
	breaker := newGroupBreaker(key)
	m.breakers.Add(key, breaker)
	return breaker
}

// WatchLocalGroups reads the groups the embedded API server serves, once it is
// ready, through its loopback config. It is a no-op when no multi-tenant router is configured.
func (s *Service) WatchLocalGroups(ctx context.Context, cfg *clientrest.Config) error {
	if s.mt == nil {
		return nil
	}
	client, err := clientrest.HTTPClientFor(cfg)
	if err != nil {
		return fmt.Errorf("building loopback discovery client: %w", err)
	}
	client.Timeout = singleTenantLookupTimeout
	go s.mt.local.run(ctx, client, cfg.Host)
	return nil
}

func (s *Service) serveMT(w http.ResponseWriter, req *http.Request, group string) {
	setRoute(req, routeFallback)
	if rejectUpgrade(w, req) {
		return
	}
	serve := func(w http.ResponseWriter, req *http.Request) { s.mt.serve(w, req, group) }
	if requestVerb(req) == "watch" {
		s.router.serveWatch(w, req, nil, serve)
		return
	}
	serve(w, req)
}
