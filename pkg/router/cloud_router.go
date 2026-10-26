package router

import (
	"cmp"
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"maps"
	"net/http"
	"net/url"
	"os"
	"slices"
	"strings"
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

// SetDefaultCoreURL sets core_url to url unless it is configured, in the
// config or by its environment variable, and reports whether it did.
func SetDefaultCoreURL(cfg *setting.Cfg, url string) bool {
	if cfg.SectionWithEnvOverrides(cloudRouterSection).Key("core_url").MustString("") != "" {
		return false
	}
	cfg.Raw.Section(cloudRouterSection).Key("core_url").SetValue(url)
	return true
}

// newPluginManifestsTargets builds the targets for plugins_url and core_url,
// each nil when its URL is unset. core_url serves core APIs (like playlists)
// in the plugin manifests format, and both share the [router.backend_grpc]
// connection settings. Each has its own TLS settings for its poll, from
// plugins_ca_file/plugins_insecure and core_ca_file/core_insecure.
func newPluginManifestsTargets(cfg *setting.Cfg, section *setting.DynamicSection, deps PluginDependencies) (pluginsTarget, coreTarget *pluginManifestsTarget, err error) {
	pluginsURL := section.Key("plugins_url").MustString("")
	coreURL := section.Key("core_url").MustString("")
	if pluginsURL == "" && coreURL == "" {
		return nil, nil, nil
	}
	grpcConfig, err := parsePluginGRPCConfig(cfg)
	if err != nil {
		return nil, nil, err
	}
	if pluginsURL != "" {
		patterns := compileGroupPatterns(splitGroupPatterns(section.Key("plugins_group_regex").MustString("")))
		client, err := newPluginManifestsClient(section, "plugins")
		if err != nil {
			return nil, nil, err
		}
		pluginsTarget, err = newPluginManifestsTarget(pluginsKeyPrefix, sourcePluginsURL, pluginsURL,
			patterns, client, grpcConfig, deps)
		if err != nil {
			return nil, nil, fmt.Errorf("%s: %w", cloudRouterSection, err)
		}
		if pluginsTarget.cooldown, err = pluginManifestsCooldown(section, "plugins"); err != nil {
			return nil, nil, err
		}
	}
	if coreURL != "" {
		client, err := newPluginManifestsClient(section, "core")
		if err != nil {
			return nil, nil, err
		}
		coreTarget, err = newPluginManifestsTarget(coreKeyPrefix, sourceCoreURL, coreURL,
			nil, client, grpcConfig, deps)
		if err != nil {
			return nil, nil, fmt.Errorf("%s: %w", cloudRouterSection, err)
		}
		if coreTarget.cooldown, err = pluginManifestsCooldown(section, "core"); err != nil {
			return nil, nil, err
		}
	}
	return pluginsTarget, coreTarget, nil
}

// pluginManifestsCooldown paces a plugin manifests source by its
// <prefix>_poll_interval key, with the same default and backoff as an
// aggregate target.
func pluginManifestsCooldown(section *setting.DynamicSection, prefix string) (*cooldown, error) {
	interval, err := parsePositiveDurationKey(section, prefix+"_poll_interval", defaultAggregatePollInterval)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", cloudRouterSection, err)
	}
	return newCooldown(interval, defaultAggregateMinBackoff, defaultAggregateMaxBackoff), nil
}

// newPluginManifestsClient builds the client that polls a plugin manifests
// source, with TLS from its <prefix>_ca_file and <prefix>_insecure keys.
func newPluginManifestsClient(section *setting.DynamicSection, prefix string) (*http.Client, error) {
	tlsCfg, err := buildAggregateTLSConfig(
		section.Key(prefix+"_ca_file").MustString(""),
		section.Key(prefix+"_insecure").MustBool(false),
	)
	if err != nil {
		return nil, fmt.Errorf("%s: %s_url: %w", cloudRouterSection, prefix, err)
	}
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.TLSClientConfig = tlsCfg
	return &http.Client{Timeout: defaultAggregateDiscoveryTimeout, Transport: transport}, nil
}

// ProvideCloudRoutesLoaderFactory builds the cloud RoutesLoader from the
// [cloud_router], [router.aggregate.<name>] and [router.backend_grpc] sections. It returns (nil, nil) when no source is configured
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

	// plugins_url and core_url need no CAP token (they are unauthenticated
	// in-cluster endpoints), so they stay out of the cap_token gate below.
	pluginsTarget, coreTarget, err := newPluginManifestsTargets(cfg, section, deps)
	if err != nil {
		return nil, err
	}

	singleTenantDiscoveryURL := section.Key("st_discovery_url").MustString("")
	if len(aggregateTargetConfigs) == 0 && pluginsTarget == nil && coreTarget == nil && singleTenantDiscoveryURL == "" {
		// The appmanifest apiserver source was removed. Fail loudly, or a
		// config that still relies on it would silently fall back to the
		// dummy loader and serve no routes.
		for _, key := range []string{"appmanifest_apiserver_url", "apiserver_url"} {
			if section.Key(key).MustString("") != "" {
				return nil, fmt.Errorf("%s: %s is no longer supported -- configure an aggregate target, plugins_url, core_url or st_discovery_url instead", cloudRouterSection, key)
			}
		}
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
			cacheSize:           section.Key("st_cache_size").MustInt(defaultSingleTenantCacheSize),
			breakerCacheSize:    section.Key("st_breaker_cache_size").MustInt(defaultSingleTenantBreakerCacheSize),
			lookupRate:          section.Key("st_lookup_rate").MustFloat64(defaultSingleTenantLookupRate),
			lookupBurst:         section.Key("st_lookup_burst").MustInt(defaultSingleTenantLookupBurst),
			discoveryCacheBytes: section.Key("st_discovery_cache_bytes").MustInt(defaultSingleTenantDiscoveryCacheBytes),
			resolveHost:         newGComURLResolver(cfg.GrafanaComAPIURL, cfg.GrafanaComSSOAPIToken),
			discoveryHost:       discoURL,
		})
		if err != nil {
			return nil, fmt.Errorf("%s: st_discovery_url: %w", cloudRouterSection, err)
		}
	}

	return newCloudLoader(aggregateTargets, pluginsTarget, coreTarget, singleTenantFallback)
}

// cloudLoader is a RoutesLoader and a dskit service. It merges the configured
// cloud sources by group (see newCloudLoader for their priority).
type cloudLoader struct {
	*services.BasicService

	dirty chan struct{} // buffered 1; pure coalescing wake signal, no payload

	// sources are polled for backends, highest priority first: a source's
	// group overrides the same group from every later one.
	sources []*polledSource

	// mergeSteps change the merged backends, by group, in order.
	mergeSteps []mergeStep

	// Until all requests are moved to MT, we can fallback to ST instances
	singleTenantFallback *singleTenantFallback

	shadowed atomic.Pointer[[]shadowedGroup]
}

// mergeStep changes the backends a load merged from every source, by group.
type mergeStep func(backends map[string]Backend)

// newCloudLoader merges its sources in this order of priority:
//
//  1. managed plugins (pluginsTarget);
//  2. core APIs (coreTarget);
//  3. the aggregate targets, the first one winning a shared group;
//  4. the single-tenant fallback, which every other source overrides.
//
// Any of them may be nil or empty.
func newCloudLoader(aggregateTargets []*aggregateTarget,
	pluginsTarget *pluginManifestsTarget,
	coreTarget *pluginManifestsTarget,
	singleTenantFallback *singleTenantFallback,
) (*cloudLoader, error) {
	l := &cloudLoader{
		dirty:                make(chan struct{}, 1),
		singleTenantFallback: singleTenantFallback,
	}
	for _, target := range []*pluginManifestsTarget{pluginsTarget, coreTarget} {
		if target != nil {
			l.sources = append(l.sources, &target.polledSource)
		}
	}
	for _, target := range aggregateTargets {
		l.sources = append(l.sources, &target.polledSource)
	}
	if singleTenantFallback != nil {
		l.sources = append(l.sources, &singleTenantFallback.polledSource)
		l.mergeSteps = append(l.mergeSteps, splitSingleTenantResources(singleTenantFallback))
	}

	l.BasicService = services.NewBasicService(nil, l.running, l.stopping).WithName("cloud-apps-routes-loader")
	return l, nil
}

// running drives the poll loops until ctx is cancelled. If any
// fails, the service fails, rather than serving a routing table that has
// silently stopped updating.
func (l *cloudLoader) running(ctx context.Context) error {
	g, gctx := errgroup.WithContext(ctx)
	for _, source := range l.sources {
		g.Go(func() error {
			source.run(gctx, l.dirty)
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

// stopping tears down each source once every poll loop has stopped.
func (l *cloudLoader) stopping(error) error {
	for _, source := range l.sources {
		source.teardown()
	}
	return nil
}

func (l *cloudLoader) Notify(ctx context.Context) (<-chan struct{}, error) {
	// TODO: don't apply the change until we have verified that the config passes checks
	return l.dirty, nil // the poll loops push to this channel
}

// errFirstPollPending keeps the cloud loader from serving before each of its
// sources has polled once.
var errFirstPollPending = errors.New("router: waiting for the first poll of")

func (l *cloudLoader) Load(ctx context.Context) ([]Backend, error) {
	// Until every source has polled once, the snapshots of those that haven't
	// are empty but not failed. Serving then would report ready with groups
	// missing from discovery, so wait. A failed first poll ends the wait too.
	var pending []string
	for _, status := range l.sourceStatuses() {
		if status.Successes+status.Failures == 0 {
			pending = append(pending, status.Source)
		}
	}
	if len(pending) > 0 {
		return nil, fmt.Errorf("%w: %s", errFirstPollPending, strings.Join(pending, ", "))
	}

	lookup := make(map[string]Backend)
	fromFallback := make(map[string]bool)
	var fallbackErr error
	var shadowed []shadowedGroup
	// Lowest priority first, so each source overrides the ones before it.
	// Overriding a fallback source is the expected migration path, not a
	// conflict, so it is not recorded.
	for _, source := range slices.Backward(l.sources) {
		snapshot := source.current()
		if source.fallback && snapshot.err != nil {
			fallbackErr = fmt.Errorf("%s discovery: %w", source.source, snapshot.err)
		}
		for _, b := range snapshot.backends {
			group := b.Group().Name
			if previous, ok := lookup[group]; ok && !fromFallback[group] {
				shadowed = append(shadowed, shadowedGroup{Group: group, Source: previous.Source(), By: b.Source()})
			}
			lookup[group] = b
			fromFallback[group] = source.fallback
		}
	}
	l.recordShadowed(ctx, shadowed)

	for _, step := range l.mergeSteps {
		step(lookup)
	}

	if len(lookup) == 0 && fallbackErr != nil {
		return nil, fallbackErr
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

func (l *cloudLoader) counters() []loaderCounter {
	if l.singleTenantFallback == nil {
		return nil
	}
	return l.singleTenantFallback.counters()
}

func (l *cloudLoader) sourceStatuses() []sourceStatus {
	statuses := make([]sourceStatus, 0, len(l.sources))
	for _, source := range l.sources {
		statuses = append(statuses, source.status.status(source.source))
	}
	return statuses
}

// UnregisteredGroupHandler implements [unregisteredGroupLoader]: the
// single-tenant fallback serves the groups no other source does.
func (l *cloudLoader) UnregisteredGroupHandler() http.Handler {
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

// buildAggregateTLSConfig builds the TLS config for one aggregate target,
// plugin manifests source or the plugin gRPC connections from its
// ca_file/insecure settings. insecure wins over caFile if both are set.
func buildAggregateTLSConfig(caFile string, insecure bool) (*tls.Config, error) {
	// nosemgrep: problem-based-packs.insecure-transport.go-stdlib.bypass-tls-verification.bypass-tls-verification
	tlsCfg := &tls.Config{MinVersion: tls.VersionTLS12}
	switch {
	case insecure:
		// Operator-gated via router.aggregate.<name> insecure (or
		// plugins_insecure, core_insecure or router.backend_grpc
		// tls_insecure): only enable for a target reached over a link that's
		// actually trusted, since this disables both CA and hostname
		// verification (MITM exposure).
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
