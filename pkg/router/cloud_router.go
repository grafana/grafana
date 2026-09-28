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
	"sync/atomic"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/dskit/services"
	"golang.org/x/sync/errgroup"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/version"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/transport"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha2"
	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/clientauth"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/setting"
	unifiedresource "github.com/grafana/grafana/pkg/storage/unified/resource"
)

// cloudRouterSection is the remote control-plane apiserver this loader reads
// RouteBackend/AppManifest from -- a different apiserver than Grafana's own,
// so it is configured independently rather than reusing any existing
// unified-storage/authz settings.
const cloudRouterSection = "cloud_router"

// ProvideCloudRoutesLoader builds the cloud RoutesLoader from the
// [cloud_router] section. It returns (nil, nil) when no source is configured
// (appmanifest_apiserver_url, an aggregate target url, plugins_url or
// st_discovery_url), and the caller falls back to another loader.
//
// The remote apiservers are called with a CAP token exchanged for a signed
// access token on every request.
func ProvideCloudRoutesLoader(cfg *setting.Cfg, deps PluginDependencies) (RoutesLoader, error) {
	section := cfg.SectionWithEnvOverrides(cloudRouterSection)

	appManifestApiserverURL := section.Key("appmanifest_apiserver_url").MustString("")

	// apiserver_url was renamed. Fail loudly, or an old config would silently
	// fall back to the dummy loader and serve no routes.
	if legacyApiserverURL := section.Key("apiserver_url").MustString(""); legacyApiserverURL != "" && appManifestApiserverURL == "" {
		return nil, fmt.Errorf("%s: apiserver_url was renamed to appmanifest_apiserver_url -- update your config", cloudRouterSection)
	}

	aggregateTargetConfigs, err := parseAggregateTargets(section)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", cloudRouterSection, err)
	}

	// plugins_url needs no CAP token (it is an unauthenticated in-cluster
	// endpoint), so it stays out of the cap_token gate below.
	var pluginsTarget *pluginManifestsTarget
	if pluginsURL := section.Key("plugins_url").MustString(""); pluginsURL != "" {
		patterns, err := compileGroupPatterns(splitGroupPatterns(groupPatternsKey(section, "plugins_group_patterns", "plugins_group_regex")))
		if err != nil {
			return nil, fmt.Errorf("%s: %w", cloudRouterSection, err)
		}
		auth, err := authn.NewGrafanaTokenAuthenticator(cfg)
		if err != nil {
			return nil, fmt.Errorf("%s: %w", cloudRouterSection, err)
		}
		pluginsTarget, err = newPluginManifestsTarget(pluginsURL,
			patterns, &http.Client{Timeout: defaultAggregateDiscoveryTimeout}, deps, auth)
		if err != nil {
			return nil, fmt.Errorf("%s: %w", cloudRouterSection, err)
		}
	}

	singleTenantDiscoveryURL := section.Key("st_discovery_url").MustString("")
	if appManifestApiserverURL == "" && len(aggregateTargetConfigs) == 0 && pluginsTarget == nil && singleTenantDiscoveryURL == "" {
		return nil, nil
	}

	// cap_token/token_exchange_url are only needed for the appmanifest
	// apiserver and the two CAP-token-authenticated aggregate targets --
	// pluginsTarget alone must be able to activate without them.
	var tokenExchanger *authnlib.TokenExchangeClient
	if appManifestApiserverURL != "" || len(aggregateTargetConfigs) > 0 {
		capToken := section.Key("cap_token").MustString("")
		tokenExchangeURL := section.Key("token_exchange_url").MustString("")
		if capToken == "" || tokenExchangeURL == "" {
			return nil, fmt.Errorf("%s: cap_token and token_exchange_url are required when appmanifest_apiserver_url, baas_apiserver.url, or cloud_app_platform_apiserver.url is set", cloudRouterSection)
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
		if targetCfg.Audience == "" {
			return nil, fmt.Errorf("%s: %s.audience is required when %s.url is set", cloudRouterSection, targetCfg.Name, targetCfg.Name)
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
			Transport:     newAggregateBaseTransport(tlsCfg),
			WrapTransport: aggregateTokenWrapper(targetCfg.Auth, tokenExchanger, targetCfg.Audience),
			Timeout:       defaultAggregateDiscoveryTimeout,
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

	var clients *k8s.ClientRegistry
	if appManifestApiserverURL != "" {
		restCfg := rest.Config{
			APIPath: "/apis",
			Host:    appManifestApiserverURL,
			TLSClientConfig: rest.TLSClientConfig{
				Insecure: section.Key("apiserver_insecure").MustBool(false),
				CAFile:   section.Key("apiserver_ca_file").MustString(""),
			},
			WrapTransport: clientauth.NewStaticTokenExchangeTransportWrapper(tokenExchanger, v1alpha2.APIGroup, clientauth.WildcardNamespace),
		}

		// Base kubeconfig IS the remote apps config -- a single group, so no
		// per-group overlay is needed.
		clients = k8s.NewClientRegistry(restCfg, k8s.ClientConfig{})
	}

	var singleTenantFallback *singleTenantFallback
	if singleTenantDiscoveryURL != "" {
		discoURL, err := url.Parse(singleTenantDiscoveryURL)
		if err != nil {
			return nil, fmt.Errorf("%s: st_discovery_url: %w", cloudRouterSection, err)
		}

		stackURL := section.Key("st_stack_url").MustString(defaultSingleTenantStackURL)
		if err := checkSingleTenantStackURL(stackURL); err != nil {
			return nil, fmt.Errorf("%s: st_stack_url: %w", cloudRouterSection, err)
		}
		singleTenantFallback, err = newSingleTenantFallback(singleTenantFallbackOptions{
			cacheSize:        section.Key("st_cache_size").MustInt(defaultSingleTenantCacheSize),
			breakerCacheSize: section.Key("st_breaker_cache_size").MustInt(defaultSingleTenantBreakerCacheSize),
			lookupRate:       section.Key("st_lookup_rate").MustFloat64(defaultSingleTenantLookupRate),
			lookupBurst:      section.Key("st_lookup_burst").MustInt(defaultSingleTenantLookupBurst),
			resolveHost:      newGComURLResolver(cfg.GrafanaComAPIURL, cfg.GrafanaComSSOAPIToken, stackURL),
			discoveryHost:    discoURL,
		})
		if err != nil {
			return nil, fmt.Errorf("%s: st_discovery_url: %w", cloudRouterSection, err)
		}
	}

	return newCloudLoader(clients, aggregateTargets, pluginsTarget, singleTenantFallback)
}

// cloudLoader is a RoutesLoader and a dskit service. It merges the configured
// cloud sources in the order sources gives.
type cloudLoader struct {
	*services.BasicService

	dirty chan struct{} // buffered 1; pure coalescing wake signal, no payload

	// Until all requests are moved to MT, we can fallback to ST instances
	singleTenantFallback *singleTenantFallback
	// aggregateTargets are the fixed upstream apiservers (baas_apiserver,
	// cloud_app_platform_apiserver) polled for API groups.
	aggregateTargets []*aggregateTarget
	// routeBackends is nil unless appmanifest_apiserver_url is set.
	routeBackends *routeBackendSource
	// pluginsTarget is nil unless plugins_url is set.
	pluginsTarget *pluginManifestsTarget

	shadowed atomic.Pointer[[]shadowedGroup]
}

func newCloudLoader(clients *k8s.ClientRegistry, aggregateTargets []*aggregateTarget, pluginsTarget *pluginManifestsTarget, singleTenantFallback *singleTenantFallback) (*cloudLoader, error) {
	l := &cloudLoader{
		dirty:                make(chan struct{}, 1),
		aggregateTargets:     aggregateTargets,
		pluginsTarget:        pluginsTarget,
		singleTenantFallback: singleTenantFallback,
	}
	if clients != nil {
		routeBackends, err := newRouteBackendSource(clients, l.dirty)
		if err != nil {
			return nil, err
		}
		l.routeBackends = routeBackends
	}
	l.BasicService = services.NewBasicService(nil, l.running, nil).WithName("cloud-apps-routes-loader")
	return l, nil
}

// sources returns the configured route sources in priority order, lowest
// first: a group from a later source replaces the same group from an earlier
// one. The MT sources replace the ST fallback's flavors, later aggregate
// targets replace earlier ones, and managed plugins come last.
func (l *cloudLoader) sources() []routeSource {
	var sources []routeSource
	if l.singleTenantFallback != nil {
		sources = append(sources, polledRouteSource{l.singleTenantFallback, l.dirty})
	}
	for _, target := range l.aggregateTargets {
		sources = append(sources, polledRouteSource{target, l.dirty})
	}
	if l.routeBackends != nil {
		sources = append(sources, l.routeBackends)
	}
	if l.pluginsTarget != nil {
		sources = append(sources, polledRouteSource{l.pluginsTarget, l.dirty})
	}
	return sources
}

// running runs every source until ctx is cancelled. If any fails, the service
// fails, rather than serving a routing table that has silently stopped
// updating.
func (l *cloudLoader) running(ctx context.Context) error {
	g, gctx := errgroup.WithContext(ctx)
	for _, source := range l.sources() {
		g.Go(func() error { return source.run(gctx) })
	}
	if err := g.Wait(); err != nil {
		return err
	}
	// An empty loader still remains available until shutdown.
	<-ctx.Done()
	return nil
}

// getAPIGroupsForCoreGroupsWithoutManifests indexes the manifests embedded in
// this binary by AppName. combineByName falls back to it for core groups
// (folder, dashboard, ...) that have a RouteBackend but no AppManifest CR.
func getAPIGroupsForCoreGroupsWithoutManifests() map[string]metav1.APIGroup {
	manifests := unifiedresource.AppManifests()
	byAppName := make(map[string]metav1.APIGroup, len(manifests))
	for _, m := range manifests {
		if m == nil {
			continue
		}
		byAppName[m.AppName] = apiGroupFromManifestData(*m)
	}
	return byAppName
}

func apiGroupFromManifestData(manifest app.ManifestData) metav1.APIGroup {
	var served []string
	for _, version := range manifest.Versions {
		if version.Served {
			served = append(served, version.Name)
		}
	}
	return apiGroupForVersions(manifest.Group, served, manifest.PreferredVersion)
}

func apiGroupFromManifestSpec(spec v1alpha2.AppManifestSpec) metav1.APIGroup {
	var served []string
	for _, version := range spec.Versions {
		if version.Served == nil || *version.Served {
			served = append(served, version.Name)
		}
	}
	preferred := ""
	if spec.PreferredVersion != nil {
		preferred = *spec.PreferredVersion
	}
	return apiGroupForVersions(spec.Group, served, preferred)
}

// apiGroupForVersions describes a group serving the given versions, in order.
// Its preferred version is preferred when that is served, and otherwise the
// served version Kubernetes ranks highest: GA over beta over alpha, then the
// highest number. An unserved version is never preferred.
func apiGroupForVersions(name string, served []string, preferred string) metav1.APIGroup {
	group := metav1.APIGroup{Name: name}
	for _, v := range served {
		group.Versions = append(group.Versions, metav1.GroupVersionForDiscovery{GroupVersion: name + "/" + v, Version: v})
	}
	if !slices.Contains(served, preferred) {
		preferred = ""
		for _, v := range served {
			if preferred == "" || version.CompareKubeAwareVersionStrings(v, preferred) > 0 {
				preferred = v
			}
		}
	}
	if preferred != "" {
		group.PreferredVersion = metav1.GroupVersionForDiscovery{GroupVersion: name + "/" + preferred, Version: preferred}
	}
	return group
}

func (l *cloudLoader) Notify(ctx context.Context) (<-chan struct{}, error) {
	// TODO: don't apply the change until we have verified that the config passes checks
	return l.dirty, nil // the sources push to this channel
}

// Load merges the sources' backends in priority order. A polled source that
// is failing still contributes its last-known-good backends, and its error
// fails the load only when no source has any.
func (l *cloudLoader) Load(ctx context.Context) ([]Backend, error) {
	lookup := make(map[string]Backend)
	var unavailable []error
	var shadowed []shadowedGroup
	for _, source := range l.sources() {
		backends, err := source.backends(ctx)
		if err != nil {
			var polled *polledSourceError
			if !errors.As(err, &polled) {
				return nil, err
			}
			unavailable = append(unavailable, err)
		}
		for _, b := range backends {
			group := b.Group().Name
			if previous, ok := lookup[group]; ok {
				shadowed = append(shadowed, shadowedGroup{Group: group, Source: previous.Source(), By: b.Source()})
			}
			lookup[group] = b
		}
	}
	l.recordShadowed(ctx, shadowed)

	if len(lookup) == 0 && len(unavailable) > 0 {
		return nil, errors.Join(unavailable...)
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
	sources := l.sources()
	statuses := make([]sourceStatus, 0, len(sources))
	for _, source := range sources {
		statuses = append(statuses, source.sourceStatus())
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

// aggregateTokenWrapper sets the exchanged CAP token on the header the
// target's auth names.
func aggregateTokenWrapper(auth aggregateAuth, tokenExchanger authnlib.TokenExchanger, audience string) transport.WrapperFunc {
	if auth == aggregateAuthBearer {
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
// are set, matching transportFor's precedence for forward backends.
func buildAggregateTLSConfig(caFile string, insecure bool) (*tls.Config, error) {
	// nosemgrep: problem-based-packs.insecure-transport.go-stdlib.bypass-tls-verification.bypass-tls-verification
	tlsCfg := &tls.Config{MinVersion: tls.VersionTLS12}
	switch {
	case insecure:
		// Operator-gated via <name>.insecure, same trust model as
		// apiserver_insecure for the appmanifest apiserver: only enable for a
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
