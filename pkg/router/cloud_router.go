package router

import (
	"cmp"
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"log/slog"
	"maps"
	"net/http"
	"net/url"
	"os"
	"slices"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/dskit/services"
	"golang.org/x/sync/errgroup"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/transport"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha2"
	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
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

// ProvideCloudRoutesLoaderFactory builds the cloud RoutesLoader from the
// [cloud_router] section. It returns (nil, nil) when no source is configured
// (appmanifest_apiserver_url, an aggregate target url, plugins_url or
// st_discovery_url), and the caller falls back to another loader.
//
// The remote apiservers are called with a CAP token exchanged for a signed
// access token on every request.
func ProvideCloudRoutesLoaderFactory(cfg *setting.Cfg, deps PluginDependencies) (RoutesLoader, error) {
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
		patterns, err := compileGroupPatterns(splitGroupPatterns(section.Key("plugins_group_regex").MustString("")))
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
			WrapTransport: aggregateTokenWrapper(targetCfg.Name, tokenExchanger, targetCfg.Audience),
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

	return newCloudLoader(clients, aggregateTargets, pluginsTarget, singleTenantFallback)
}

// embeddedManifestKey is the key component used for API groups sourced from
// getAPIGroupsForCoreGroupsWithoutManifests rather than an AppManifest CR.
// It has no ResourceVersion to track, so a constant marks it as "changes only
// on redeploy" for the fingerprint in combineByName.
const embeddedManifestKey = "embedded"

// cloudLoader is a RoutesLoader and a dskit service. It merges the configured
// cloud sources (see Load for their priority).
type cloudLoader struct {
	*services.BasicService

	dirty                      chan struct{}                // buffered 1; pure coalescing wake signal, no payload
	routeBackendClient         *v1alpha2.RouteBackendClient // nil if appmanifest_apiserver_url is unset
	appManifestClient          *v1alpha2.AppManifestClient  // nil if appmanifest_apiserver_url is unset
	transports                 map[tlsCacheKey]*http.Transport
	dialer                     *transport.DialHolder
	coreGroupsWithoutManifests map[string]metav1.APIGroup

	// The informers wake the router through Watcher(), and once synced their
	// caches replace listing from the remote apiserver on every Load. nil when
	// appmanifest_apiserver_url is unset.
	clients    *k8s.ClientRegistry
	rbInformer *operator.KubernetesBasedInformer
	amInformer *operator.KubernetesBasedInformer

	// aggregateTargets are the fixed upstream apiservers (baas_apiserver,
	// cloud_app_platform_apiserver) this loader actively polls for API
	// groups, independent of whether the CRD/appmanifest side is active.
	aggregateTargets []*aggregateTarget

	// pluginsTarget is the third source: nil unless plugins_url is
	// configured, independent of both the CRD/appmanifest side and the
	// aggregate targets.
	pluginsTarget *pluginManifestsTarget

	// Until all requests are moved to MT, we can fallback to ST instances
	singleTenantFallback *singleTenantFallback
}

type tlsCacheKey struct {
	caData   string
	insecure bool
}

type apiGroupWithKey struct {
	group metav1.APIGroup
	key   string
}

func newCloudLoader(clients *k8s.ClientRegistry, aggregateTargets []*aggregateTarget, pluginsTarget *pluginManifestsTarget, singleTenantFallback *singleTenantFallback) (*cloudLoader, error) {
	l := &cloudLoader{
		dirty:                      make(chan struct{}, 1),
		transports:                 map[tlsCacheKey]*http.Transport{},
		coreGroupsWithoutManifests: getAPIGroupsForCoreGroupsWithoutManifests(),
		clients:                    clients,
		aggregateTargets:           aggregateTargets,
		pluginsTarget:              pluginsTarget,
		singleTenantFallback:       singleTenantFallback,
	}

	if clients != nil {
		routeBackendCli, err := v1alpha2.NewRouteBackendClientFromGenerator(clients)
		if err != nil {
			return nil, err
		}

		appManifestCli, err := v1alpha2.NewAppManifestClientFromGenerator(clients)
		if err != nil {
			return nil, err
		}

		l.routeBackendClient = routeBackendCli
		l.appManifestClient = appManifestCli

		// Built here, not when the service starts, because Load reads these
		// fields from the reconcile goroutine. Construction makes no requests.
		watcher := l.Watcher()
		l.rbInformer, err = newInformer(v1alpha2.RouteBackendKind(), clients, watcher)
		if err != nil {
			return nil, fmt.Errorf("route backend informer: %w", err)
		}
		l.amInformer, err = newInformer(v1alpha2.AppManifestKind(), clients, watcher)
		if err != nil {
			return nil, fmt.Errorf("app manifest informer: %w", err)
		}
	}

	l.BasicService = services.NewBasicService(nil, l.running, nil).WithName("cloud-apps-routes-loader")
	return l, nil
}

// running drives the informers and poll loops until ctx is cancelled. If any
// fails, the service fails, rather than serving a routing table that has
// silently stopped updating.
func (l *cloudLoader) running(ctx context.Context) error {
	g, gctx := errgroup.WithContext(ctx)
	if l.clients != nil {
		g.Go(func() error { return l.rbInformer.Run(gctx) })
		g.Go(func() error { return l.amInformer.Run(gctx) })
	}
	for _, target := range l.aggregateTargets {
		g.Go(func() error {
			target.run(gctx, l.dirty)
			return nil
		})
	}
	if l.pluginsTarget != nil {
		g.Go(func() error {
			l.pluginsTarget.run(gctx, l.dirty)
			return nil
		})
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

// newInformer builds a kind's informer against clients, with watcher as its
// only event handler.
func newInformer(kind resource.Kind, clients *k8s.ClientRegistry, watcher operator.ResourceWatcher) (*operator.KubernetesBasedInformer, error) {
	client, err := clients.ClientFor(kind)
	if err != nil {
		return nil, err
	}
	inf, err := operator.NewKubernetesBasedInformer(kind, client, operator.InformerOptions{})
	if err != nil {
		return nil, err
	}
	if err := inf.AddEventHandler(watcher); err != nil {
		return nil, err
	}
	return inf, nil
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
	group := metav1.APIGroup{Name: manifest.Group}
	for _, version := range manifest.Versions {
		if !version.Served {
			continue
		}
		group.Versions = append(group.Versions, metav1.GroupVersionForDiscovery{
			GroupVersion: manifest.Group + "/" + version.Name,
			Version:      version.Name,
		})
	}
	if manifest.PreferredVersion != "" {
		group.PreferredVersion = metav1.GroupVersionForDiscovery{
			GroupVersion: manifest.Group + "/" + manifest.PreferredVersion,
			Version:      manifest.PreferredVersion,
		}
	}
	return group
}

func apiGroupFromManifestSpec(spec v1alpha2.AppManifestSpec) metav1.APIGroup {
	group := metav1.APIGroup{Name: spec.Group}
	for _, version := range spec.Versions {
		if version.Served != nil && !*version.Served {
			continue
		}
		group.Versions = append(group.Versions, metav1.GroupVersionForDiscovery{
			GroupVersion: spec.Group + "/" + version.Name,
			Version:      version.Name,
		})
	}

	preferredVersion := ""
	if spec.PreferredVersion != nil {
		preferredVersion = *spec.PreferredVersion
	} else if len(spec.Versions) > 0 {
		preferredVersion = spec.Versions[len(spec.Versions)-1].Name
	}
	if preferredVersion != "" {
		group.PreferredVersion = metav1.GroupVersionForDiscovery{
			GroupVersion: spec.Group + "/" + preferredVersion,
			Version:      preferredVersion,
		}
	}
	return group
}

func (l *cloudLoader) Watcher() operator.ResourceWatcher {
	// The event carries no data we use: reconcile re-reads full state via Load.
	// So push is a pure edge, coalesced against the buffered-1 dirty channel.
	push := func() {
		select {
		case l.dirty <- struct{}{}:
		default: // a wake is already pending; drop this redundant signal
		}
	}
	return &operator.SimpleWatcher{
		AddFunc:    func(_ context.Context, _ resource.Object) error { push(); return nil },
		UpdateFunc: func(_ context.Context, _, _ resource.Object) error { push(); return nil },
		DeleteFunc: func(_ context.Context, _ resource.Object) error { push(); return nil },
	}
}

func (l *cloudLoader) Notify(ctx context.Context) (<-chan struct{}, error) {
	// TODO: don't apply the change until we have verified that the config passes checks
	return l.dirty, nil // the informers and poll loops push to this channel
}

func (l *cloudLoader) Load(ctx context.Context) ([]Backend, error) {
	lookup := make(map[string]Backend)
	var discoveryErr error

	// Lowest priority first -- the MT backends will replace the ST flavors
	if l.singleTenantFallback != nil {
		backends, err := l.singleTenantFallback.Backends()
		if err != nil {
			discoveryErr = fmt.Errorf("single-tenant discovery: %w", err)
		}
		for _, b := range backends {
			lookup[b.Group().Name] = b
		}
	}

	// Aggregate targets override ST; later targets override earlier targets.
	for _, target := range l.aggregateTargets {
		for _, b := range target.Backends() {
			lookup[b.Group().Name] = b
		}
	}

	// Explicitly configured routes from manifest API server
	if l.routeBackendClient != nil {
		manifests, backends, err := l.routeResources(ctx)
		if err != nil {
			return nil, err
		}
		for _, b := range l.combineByName(manifests, backends) {
			lookup[b.Group().Name] = b
		}
	}

	// Managed plugins
	if l.pluginsTarget != nil {
		for _, b := range l.pluginsTarget.Backends() {
			lookup[b.Group().Name] = b
		}
	}

	if len(lookup) == 0 && discoveryErr != nil {
		return nil, discoveryErr
	}

	backends := slices.Collect(maps.Values(lookup))
	slices.SortFunc(backends, func(a Backend, b Backend) int {
		return cmp.Compare(a.Group().Name, b.Group().Name)
	})

	return backends, nil
}

// routeResources returns the AppManifests and RouteBackends from the informer
// caches once both have synced. Before then it lists them from the remote
// apiserver, so the first reconciles are correct without waiting for a sync.
func (l *cloudLoader) routeResources(ctx context.Context) ([]v1alpha2.AppManifest, []v1alpha2.RouteBackend, error) {
	if l.rbInformer != nil && l.amInformer != nil &&
		l.rbInformer.SharedIndexInformer.HasSynced() && l.amInformer.SharedIndexInformer.HasSynced() {
		manifests, err := cachedItems[v1alpha2.AppManifest](l.amInformer, v1alpha2.AppManifestKind())
		if err != nil {
			return nil, nil, err
		}
		backends, err := cachedItems[v1alpha2.RouteBackend](l.rbInformer, v1alpha2.RouteBackendKind())
		if err != nil {
			return nil, nil, err
		}
		return manifests, backends, nil
	}

	backends, err := l.routeBackendClient.ListAll(ctx, "", resource.ListOptions{})
	if err != nil {
		return nil, nil, err
	}
	manifests, err := l.appManifestClient.ListAll(ctx, "", resource.ListOptions{})
	if err != nil {
		return nil, nil, err
	}
	return manifests.Items, backends.Items, nil
}

// cachedItems copies an informer's cached objects, sorted by name so that
// combineByName resolves duplicates the same way a List would. Objects from
// the initial list are typed, but those from the watch are untyped wrappers,
// so they are decoded the same way the SDK decodes informer events.
func cachedItems[T any, PT interface {
	*T
	resource.Object
}](inf *operator.KubernetesBasedInformer, kind resource.Kind) ([]T, error) {
	objs := inf.SharedIndexInformer.GetStore().List()
	items := make([]PT, 0, len(objs))
	for _, obj := range objs {
		item, err := typedObject[PT](obj, kind)
		if err != nil {
			return nil, fmt.Errorf("%s informer cache: %w", kind.Kind(), err)
		}
		items = append(items, item)
	}
	slices.SortFunc(items, func(a, b PT) int {
		return cmp.Or(cmp.Compare(a.GetNamespace(), b.GetNamespace()), cmp.Compare(a.GetName(), b.GetName()))
	})
	out := make([]T, len(items))
	for i, item := range items {
		out[i] = *item
	}
	return out, nil
}

func typedObject[PT resource.Object](obj any, kind resource.Kind) (PT, error) {
	var zero PT
	if w, ok := obj.(operator.ResourceObjectWrapper); ok {
		obj = w.ResourceObject()
	}
	if c, ok := obj.(operator.ConvertableIntoResourceObject); ok {
		into := kind.ZeroValue()
		if err := c.Into(into, kind.Codec(resource.KindEncodingJSON)); err != nil {
			return zero, err
		}
		obj = into
	}
	typed, ok := obj.(PT)
	if !ok {
		return zero, fmt.Errorf("unexpected %T", obj)
	}
	return typed, nil
}

func (l *cloudLoader) SingleTenantFallback() http.Handler {
	if l.singleTenantFallback == nil {
		return nil
	}
	return l.singleTenantFallback
}

// transportFor returns the cached transport for the given TLS settings. The
// cache is what keeps connection pools alive when a group is rebuilt. Only
// reconcile calls it, so the map needs no lock.
func (l *cloudLoader) transportFor(key tlsCacheKey) (*http.Transport, error) {
	if t, ok := l.transports[key]; ok {
		return t, nil
	}

	// nosemgrep: problem-based-packs.insecure-transport.go-stdlib.bypass-tls-verification.bypass-tls-verification
	tlsCfg := &tls.Config{MinVersion: tls.VersionTLS12}
	switch {
	case key.insecure:
		// Driven by the RouteBackend spec's Tls.SkipTLSVerify. Intentional
		// dual-use: some backends are reached over trusted internal links
		// without a verifiable cert. Only enable for backends whose link is
		// actually trusted — this disables cert verification (MITM exposure).
		tlsCfg.InsecureSkipVerify = true // #nosec G402 -- spec-gated, trusted-link only
	case key.caData != "":
		pool := x509.NewCertPool()
		if !pool.AppendCertsFromPEM([]byte(key.caData)) {
			return nil, fmt.Errorf("invalid CA PEM data")
		}
		tlsCfg.RootCAs = pool
	}

	t := http.DefaultTransport.(*http.Transport).Clone()
	t.TLSClientConfig = tlsCfg
	if l.dialer != nil {
		t.DialContext = l.dialer.Dial
	}

	l.transports[key] = t
	return t, nil
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

func (l *cloudLoader) combineByName(manifests []v1alpha2.AppManifest, backends []v1alpha2.RouteBackend) []Backend {
	// Index the manifests by AppName, we can then correlate them with backends found and combine for RouteConfig
	manifestMap := make(map[string]apiGroupWithKey, len(manifests))
	for _, m := range manifests {
		manifestMap[m.Spec.AppName] = apiGroupWithKey{
			group: apiGroupFromManifestSpec(m.Spec),
			key:   m.ResourceVersion,
		}
	}

	// 2. Iterate the second slice and correlate
	var combined []Backend
	for _, b := range backends {
		m, ok := manifestMap[b.Name]
		if !ok {
			if group, found := l.coreGroupsWithoutManifests[b.Name]; found {
				m, ok = apiGroupWithKey{group: group, key: embeddedManifestKey}, true
			}
		}
		if ok {
			// Operator/Plugin backends, and any Forward backend missing its
			// config block, have a nil Forward -- not yet supported here.
			if b.Spec.Forward == nil {
				slog.Warn("router.NewForwardBackend: route backend has no forward config, skipping", "Group", m.group.Name, "mode", b.Spec.Mode)
				continue
			}
			transportKey := tlsCacheKey{
				insecure: b.Spec.Forward.Tls.SkipTLSVerify,
			}
			if b.Spec.Forward.Tls.CaData != nil {
				transportKey.caData = *b.Spec.Forward.Tls.CaData
			}

			transport, err := l.transportFor(transportKey)
			if err != nil {
				slog.Warn("router.NewForwardBackend failed to create or fetch cached transport", "Group", m.group.Name, "err", err)
				continue
			}
			current, err := NewForwardBackend(m.group, b.Spec, b.ResourceVersion+"-"+m.key, transport)
			if err != nil {
				slog.Warn("router.NewForwardBackend failed", "Group", m.group.Name, "err", err)
				continue
			}
			combined = append(combined, current)
		} else {
			slog.Warn("RoutesLoader: manifest not found for route backend", "name", b.Name)
			continue
		}
	}
	return combined
}
