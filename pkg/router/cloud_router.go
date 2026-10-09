package router

import (
	"cmp"
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"maps"
	"net/http"
	"net/url"
	"os"
	"slices"
	"sync/atomic"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/dskit/services"
	"golang.org/x/sync/errgroup"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/transport"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/clientauth"
	"github.com/grafana/grafana/pkg/setting"
)

// cloudRouterSection configures the cloud loader's sources. They are separate
// from Grafana's own apiserver, so they are configured independently rather
// than reusing any existing unified-storage/authz settings.
const cloudRouterSection = "cloud_router"

// ProvideCloudRoutesLoaderFactory builds the cloud RoutesLoader from the
// [cloud_router] and [router.aggregate.<name>] sections. It returns (nil, nil) when no source is configured
// (an aggregate target url, plugins_url, core_url or st_discovery_url), and
// the caller falls back to another loader.
//
// Aggregate targets are polled with a CAP token exchanged for a signed access
// token on every request, unless they set discovery_auth = none.
func ProvideCloudRoutesLoaderFactory(cfg *setting.Cfg, deps PluginDependencies) (RoutesLoader, error) {
	section := cfg.SectionWithEnvOverrides(cloudRouterSection)

	aggregateTargetConfigs, err := parseAggregateTargets(cfg)
	if err != nil {
		return nil, err
	}

	// plugins_url needs no CAP token (it is an unauthenticated in-cluster
	// endpoint), so it stays out of the cap_token gate below.
	var pluginsTarget, coreTarget *pluginManifestsTarget
	if pluginsURL := section.Key("plugins_url").MustString(""); pluginsURL != "" {
		patterns, err := compileGroupPatterns(splitGroupPatterns(section.Key("plugins_group_regex").MustString("")))
		if err != nil {
			return nil, fmt.Errorf("%s: %w", cloudRouterSection, err)
		}
		pluginsTarget, err = newPluginManifestsTarget(pluginsKeyPrefix, sourcePluginsURL, pluginsURL,
			patterns, &http.Client{Timeout: defaultAggregateDiscoveryTimeout}, deps)
		if err != nil {
			return nil, fmt.Errorf("%s: %w", cloudRouterSection, err)
		}
	}

	// core_url serves core APIs (like playlists) in the plugin manifests
	// format. Like plugins_url, it needs no CAP token.
	if coreURL := section.Key("core_url").MustString(""); coreURL != "" {
		coreTarget, err = newPluginManifestsTarget(coreKeyPrefix, sourceCoreURL, coreURL,
			nil, &http.Client{Timeout: defaultAggregateDiscoveryTimeout}, deps)
		if err != nil {
			return nil, fmt.Errorf("%s: %w", cloudRouterSection, err)
		}
	}

	singleTenantDiscoveryURL := section.Key("st_discovery_url").MustString("")
	if len(aggregateTargetConfigs) == 0 && pluginsTarget == nil && coreTarget == nil && singleTenantDiscoveryURL == "" {
		return nil, nil
	}

	// cap_token/token_exchange_url are only needed for CAP-token-authenticated
	// aggregate targets -- pluginsTarget, coreTarget and discovery_auth = none
	// targets must be able to activate without them.
	needsTokenExchange := false
	for _, targetCfg := range aggregateTargetConfigs {
		needsTokenExchange = needsTokenExchange || !targetCfg.anonymousDiscovery()
	}
	var tokenExchanger *authnlib.TokenExchangeClient
	if needsTokenExchange {
		capToken := section.Key("cap_token").MustString("")
		tokenExchangeURL := section.Key("token_exchange_url").MustString("")
		if capToken == "" || tokenExchangeURL == "" {
			return nil, fmt.Errorf("%s: cap_token and token_exchange_url are required when an aggregate target url without discovery_auth = none is set", cloudRouterSection)
		}

		tokenExchanger, err = authnlib.NewTokenExchangeClient(authnlib.TokenExchangeConfig{
			TokenExchangeURL: tokenExchangeURL,
			Token:            capToken,
		})
		if err != nil {
			return nil, fmt.Errorf("token exchange client: %w", err)
		}
	}

	var aggregateTargets []*aggregateTarget
	for _, targetCfg := range aggregateTargetConfigs {
		if targetCfg.Audience == "" && !targetCfg.anonymousDiscovery() {
			return nil, fmt.Errorf("%s%s: audience is required when url is set", aggregateSectionPrefix, targetCfg.Name)
		}
		tlsCfg, err := buildAggregateTLSConfig(targetCfg.CAFile, targetCfg.InsecureSkipVerify)
		if err != nil {
			return nil, fmt.Errorf("%s: %s: %w", cloudRouterSection, targetCfg.Name, err)
		}
		// proxyTransport forwards the caller's own credentials unchanged. The CAP
		// token is only for the router's own discovery poll (restCfg below).
		proxyTransport := newAggregateBaseTransport(tlsCfg)
		restCfg := &rest.Config{
			Host: targetCfg.URL,
			// A per-target clone, so this discovery client owns its pool;
			// WrapTransport still applies the CAP token exchange on top of it.
			// TLS is set on the transport because client-go rejects a custom
			// Transport combined with TLSClientConfig.
			Transport: newAggregateBaseTransport(tlsCfg),
			Timeout:   defaultAggregateDiscoveryTimeout,
		}
		if !targetCfg.anonymousDiscovery() {
			restCfg.WrapTransport = aggregateTokenWrapper(targetCfg.Name, tokenExchanger, targetCfg.Audience)
		}
		httpClient, err := rest.HTTPClientFor(restCfg)
		if err != nil {
			return nil, fmt.Errorf("%s: building http client for %s: %w", cloudRouterSection, targetCfg.Name, err)
		}
		target, err := newAggregateTarget(targetCfg, httpClient, proxyTransport)
		if err != nil {
			return nil, fmt.Errorf("%s: %s: %w", cloudRouterSection, targetCfg.Name, err)
		}
		aggregateTargets = append(aggregateTargets, target)
	}

	var singleTenantFallback *singleTenantFallback
	if singleTenantDiscoveryURL != "" {
		discoURL, err := url.Parse(singleTenantDiscoveryURL)
		if err != nil {
			return nil, fmt.Errorf("%s: st_discovery_url: %w", cloudRouterSection, err)
		}

		singleTenantFallback, err = newSingleTenantFallback(singleTenantFallbackOptions{
			cacheSize:        section.Key("st_cache_size").MustInt(defaultSingleTenantCacheSize),
			breakerCacheSize: section.Key("st_breaker_cache_size").MustInt(defaultSingleTenantBreakerCacheSize),
			lookupRate:       section.Key("st_lookup_rate").MustFloat64(defaultSingleTenantLookupRate),
			lookupBurst:      section.Key("st_lookup_burst").MustInt(defaultSingleTenantLookupBurst),
			resolveHost:      newGComURLResolver(cfg.GrafanaComAPIURL, cfg.GrafanaComSSOAPIToken),
			discoveryHost:    discoURL,
		})
		if err != nil {
			return nil, fmt.Errorf("%s: st_discovery_url: %w", cloudRouterSection, err)
		}
	}

	return newCloudLoader(aggregateTargets, pluginsTarget, coreTarget, singleTenantFallback)
}

// cloudLoader is a RoutesLoader and a dskit service. It merges the configured
// cloud sources (see Load for their priority).
type cloudLoader struct {
	*services.BasicService

	dirty chan struct{} // buffered 1; pure coalescing wake signal, no payload

	// aggregateTargets are the fixed upstream apiservers (baas_apiserver,
	// cloud_app_platform_apiserver) this loader actively polls for API
	// groups.
	aggregateTargets []*aggregateTarget

	// pluginsTarget serves managed plugins: nil unless plugins_url is
	// configured.
	pluginsTarget *pluginManifestsTarget

	// coreTarget serves core APIs in the plugin manifests format: nil unless
	// core_url is configured.
	coreTarget *pluginManifestsTarget

	// Until all requests are moved to MT, we can fallback to ST instances
	singleTenantFallback *singleTenantFallback

	shadowed atomic.Pointer[[]shadowedGroup]
}

func newCloudLoader(aggregateTargets []*aggregateTarget,
	pluginsTarget *pluginManifestsTarget,
	coreTarget *pluginManifestsTarget,
	singleTenantFallback *singleTenantFallback,
) (*cloudLoader, error) {
	l := &cloudLoader{
		dirty:                make(chan struct{}, 1),
		aggregateTargets:     aggregateTargets,
		pluginsTarget:        pluginsTarget,
		coreTarget:           coreTarget,
		singleTenantFallback: singleTenantFallback,
	}

	l.BasicService = services.NewBasicService(nil, l.running, nil).WithName("cloud-apps-routes-loader")
	return l, nil
}

// running drives the poll loops until ctx is cancelled. If any
// fails, the service fails, rather than serving a routing table that has
// silently stopped updating.
func (l *cloudLoader) running(ctx context.Context) error {
	g, gctx := errgroup.WithContext(ctx)
	for _, target := range l.aggregateTargets {
		g.Go(func() error {
			target.run(gctx, l.dirty)
			return nil
		})
	}
	for _, target := range []*pluginManifestsTarget{l.coreTarget, l.pluginsTarget} {
		if target != nil {
			g.Go(func() error {
				target.run(gctx, l.dirty)
				return nil
			})
		}
	}
	if l.singleTenantFallback != nil {
		g.Go(func() error {
			l.singleTenantFallback.run(gctx, l.dirty)
			return nil
		})
	}
	if err := g.Wait(); err != nil {
		return err
	}
	// An empty loader still remains available until shutdown.
	<-ctx.Done()
	return nil
}

func (l *cloudLoader) Notify(ctx context.Context) (<-chan struct{}, error) {
	// TODO: don't apply the change until we have verified that the config passes checks
	return l.dirty, nil // the poll loops push to this channel
}

func (l *cloudLoader) Load(ctx context.Context) ([]Backend, error) {
	lookup := make(map[string]Backend)
	var discoveryErr error
	var shadowed []shadowedGroup
	// put adds b, recording any backend for the same group it overrides.
	put := func(b Backend) {
		group := b.Group().Name
		if previous, ok := lookup[group]; ok {
			shadowed = append(shadowed, shadowedGroup{Group: group, Source: previous.Source(), By: b.Source()})
		}
		lookup[group] = b
	}

	// Lowest priority first -- the MT backends will replace the ST flavors
	if l.singleTenantFallback != nil {
		backends, err := l.singleTenantFallback.Backends()
		if err != nil {
			discoveryErr = fmt.Errorf("single-tenant discovery: %w", err)
		}
		for _, b := range backends {
			put(b)
		}
	}

	// Aggregate targets override ST; reverse order makes the first target win.
	for _, target := range slices.Backward(l.aggregateTargets) {
		for _, b := range target.Backends() {
			put(b)
		}
	}

	// Core APIs
	if l.coreTarget != nil {
		for _, b := range l.coreTarget.Backends() {
			put(b)
		}
	}

	// Managed plugins
	if l.pluginsTarget != nil {
		for _, b := range l.pluginsTarget.Backends() {
			put(b)
		}
	}
	l.recordShadowed(ctx, shadowed)

	if len(lookup) == 0 && discoveryErr != nil {
		return nil, discoveryErr
	}

	backends := slices.Collect(maps.Values(lookup))
	slices.SortFunc(backends, func(a Backend, b Backend) int {
		return cmp.Compare(a.Group().Name, b.Group().Name)
	})

	return backends, nil
}

// recordShadowed stores the groups shadowed in the latest load, and logs
// when that set changes so a new conflict is visible without flooding the log.
func (l *cloudLoader) recordShadowed(ctx context.Context, shadowed []shadowedGroup) {
	slices.SortFunc(shadowed, func(a, b shadowedGroup) int {
		return cmp.Or(cmp.Compare(a.Group, b.Group), cmp.Compare(a.Source, b.Source))
	})
	if previous := l.shadowed.Swap(&shadowed); previous == nil || !slices.Equal(*previous, shadowed) {
		for _, s := range shadowed {
			logging.FromContext(ctx).Warn("router: group offered by more than one source", "group", s.Group, "source", s.Source, "servedBy", s.By)
		}
	}
}

func (l *cloudLoader) shadowedGroups() []shadowedGroup {
	if shadowed := l.shadowed.Load(); shadowed != nil {
		return *shadowed
	}
	return nil
}

func (l *cloudLoader) stackLookups() map[string]uint64 {
	if l.singleTenantFallback == nil {
		return nil
	}
	return l.singleTenantFallback.lookupsBy.byResult()
}

func (l *cloudLoader) sourceStatuses() []sourceStatus {
	var statuses []sourceStatus
	if l.singleTenantFallback != nil {
		statuses = append(statuses, l.singleTenantFallback.status.status(sourceSingleTenant))
	}
	for _, target := range l.aggregateTargets {
		statuses = append(statuses, target.status.status(aggregateSource(target.name)))
	}
	if l.coreTarget != nil {
		statuses = append(statuses, l.coreTarget.status.status(sourceCoreURL))
	}
	if l.pluginsTarget != nil {
		statuses = append(statuses, l.pluginsTarget.status.status(sourcePluginsURL))
	}
	return statuses
}

func (l *cloudLoader) SingleTenantFallback() http.Handler {
	if l.singleTenantFallback == nil {
		return nil
	}
	return l.singleTenantFallback
}

// aggregateMaxIdleConnsPerHost raises net/http's stingy default of 2 for the
// aggregate targets' transports. Each transport talks to exactly one upstream,
// which fronts every group discovered there, so 2 idle connections per host is
// far too few to keep keepalive useful under concurrent proxied traffic.
const aggregateMaxIdleConnsPerHost = 100

// aggregateTokenWrapper picks the header for the exchanged CAP token:
// cloud_app_platform_apiserver expects a standard Authorization bearer token,
// while baas_apiserver expects X-Access-Token.
func aggregateTokenWrapper(name string, tokenExchanger authnlib.TokenExchanger, audience string) transport.WrapperFunc {
	if name == "cloud_app_platform_apiserver" {
		return clientauth.NewStaticTokenExchangeAuthorizationTransportWrapper(tokenExchanger, audience, clientauth.WildcardNamespace)
	}
	return clientauth.NewStaticTokenExchangeTransportWrapper(tokenExchanger, audience, clientauth.WildcardNamespace)
}

// newAggregateBaseTransport returns a fresh base transport for one aggregate
// target. Called once per target so no two targets share a connection pool,
// and none of them shares the process-global http.DefaultTransport.
func newAggregateBaseTransport(tlsCfg *tls.Config) *http.Transport {
	t := http.DefaultTransport.(*http.Transport).Clone()
	t.MaxIdleConnsPerHost = aggregateMaxIdleConnsPerHost
	t.TLSClientConfig = tlsCfg
	t.ResponseHeaderTimeout = backendResponseHeaderTimeout
	return t
}

// buildAggregateTLSConfig builds the TLS config for one aggregate target from
// its per-target ca_file/insecure settings. insecure wins over caFile if both
// are set.
func buildAggregateTLSConfig(caFile string, insecure bool) (*tls.Config, error) {
	// nosemgrep: problem-based-packs.insecure-transport.go-stdlib.bypass-tls-verification.bypass-tls-verification
	tlsCfg := &tls.Config{MinVersion: tls.VersionTLS12}
	switch {
	case insecure:
		// Operator-gated via router.aggregate.<name> insecure: only enable for a
		// target reached over a link that's actually trusted, since this
		// disables both CA and hostname verification (MITM exposure).
		tlsCfg.InsecureSkipVerify = true // #nosec G402 -- operator-gated, trusted-link only
	case caFile != "":
		caData, err := os.ReadFile(caFile) // #nosec G304 -- operator-supplied config path, not user input
		if err != nil {
			return nil, fmt.Errorf("reading ca_file %q: %w", caFile, err)
		}
		pool := x509.NewCertPool()
		if !pool.AppendCertsFromPEM(caData) {
			return nil, fmt.Errorf("invalid CA PEM data in ca_file %q", caFile)
		}
		tlsCfg.RootCAs = pool
	}
	return tlsCfg, nil
}
