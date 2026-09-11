package router

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"log/slog"
	"net/http"

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
	"github.com/grafana/grafana/pkg/setting"
	unifiedresource "github.com/grafana/grafana/pkg/storage/unified/resource"
)

// cloudRouterSection is the remote control-plane apiserver this loader reads
// RouteBackend/AppManifest from -- a different apiserver than Grafana's own,
// so it is configured independently rather than reusing any existing
// unified-storage/authz settings.
const cloudRouterSection = "cloud_router"

// ProvideCloudRoutesLoaderFactory builds the cloud-router RoutesLoader from
// grafana.ini settings when [cloud_router].appmanifest_apiserver_url is set,
// or any aggregate target (baas_apiserver, cloud_app_platform_apiserver) has
// its .url configured, so the router module (not a separate process) owns
// its lifecycle. Returns (nil, nil) when none of those are set -- an ini
// section is never truly absent (SectionWithEnvOverrides always returns a
// valid, empty section), so it's the presence of at least one of these
// upstream apiserver URLs that actually gates whether this loader activates;
// callers fall back to the dummy loader when it doesn't.
//
// Auth is a CAP token exchanged for a signed access token on every request
// to the remote apiserver, carried on X-Access-Token rather than a static
// Authorization bearer -- see clientauth.NewStaticTokenExchangeTransportWrapper.
func ProvideCloudRoutesLoaderFactory(cfg *setting.Cfg) (RoutesLoader, error) {
	section := cfg.SectionWithEnvOverrides(cloudRouterSection)

	appManifestApiserverURL := section.Key("appmanifest_apiserver_url").MustString("")
	aggregateTargetConfigs, err := parseAggregateTargets(section)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", cloudRouterSection, err)
	}

	if appManifestApiserverURL == "" && len(aggregateTargetConfigs) == 0 {
		return nil, nil
	}

	capToken := section.Key("cap_token").MustString("")
	tokenExchangeURL := section.Key("token_exchange_url").MustString("")
	if capToken == "" || tokenExchangeURL == "" {
		return nil, fmt.Errorf("%s: cap_token and token_exchange_url are required when appmanifest_apiserver_url, baas_apiserver.url, or cloud_app_platform_apiserver.url is set", cloudRouterSection)
	}

	tokenExchanger, err := authnlib.NewTokenExchangeClient(authnlib.TokenExchangeConfig{
		TokenExchangeURL: tokenExchangeURL,
		Token:            capToken,
	})
	if err != nil {
		return nil, fmt.Errorf("token exchange client: %w", err)
	}

	var aggregateTargets []*aggregateTarget
	for _, targetCfg := range aggregateTargetConfigs {
		if targetCfg.Audience == "" {
			return nil, fmt.Errorf("%s: %s.audience is required when %s.url is set", cloudRouterSection, targetCfg.Name, targetCfg.Name)
		}
		restCfg := &rest.Config{
			Host:          targetCfg.URL,
			WrapTransport: clientauth.NewStaticTokenExchangeTransportWrapper(tokenExchanger, targetCfg.Audience, clientauth.WildcardNamespace),
			Timeout:       defaultAggregateDiscoveryTimeout,
		}
		httpClient, err := rest.HTTPClientFor(restCfg)
		if err != nil {
			return nil, fmt.Errorf("%s: building http client for %s: %w", cloudRouterSection, targetCfg.Name, err)
		}
		target, err := newAggregateTarget(targetCfg, httpClient)
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

	return newCloudLoader(clients, aggregateTargets)
}

// embeddedManifestKey is the key component used for API groups sourced from
// getAPIGroupsForCoreGroupsWithoutManifests rather than an AppManifest CR.
// It has no ResourceVersion to track, so a constant marks it as "changes only
// on redeploy" for the fingerprint in combineByName.
const embeddedManifestKey = "embedded"

// cloudLoader implements LifecycleRoutesLoader against a remote apiserver's
// RouteBackend/AppManifest custom resources (v1alpha2).
type cloudLoader struct {
	*services.BasicService

	dirty                      chan struct{}                // buffered 1; pure coalescing wake signal, no payload
	routeBackendClient         *v1alpha2.RouteBackendClient // nil if appmanifest_apiserver_url is unset
	appManifestClient          *v1alpha2.AppManifestClient  // nil if appmanifest_apiserver_url is unset
	transports                 map[tlsCacheKey]*http.Transport
	dialer                     *transport.DialHolder
	coreGroupsWithoutManifests map[string]metav1.APIGroup

	// clients builds the informers that feed Watcher() -- started in
	// starting/running so this loader satisfies LifecycleRoutesLoader and
	// gets run by the router module alongside GrafanaRouter, instead of a
	// separate process wiring the informers itself. nil if
	// appmanifest_apiserver_url is unset, in which case the CRD/informer
	// side is skipped entirely and this loader serves aggregate targets only.
	clients    *k8s.ClientRegistry
	rbInformer operator.Informer
	amInformer operator.Informer

	// aggregateTargets are the fixed upstream apiservers (baas_apiserver,
	// cloud_app_platform_apiserver) this loader actively polls for API
	// groups, independent of whether the CRD/appmanifest side is active.
	aggregateTargets []*aggregateTarget
}

type tlsCacheKey struct {
	caData   string
	insecure bool
}

type apiGroupWithKey struct {
	group metav1.APIGroup
	key   string
}

func newCloudLoader(clients *k8s.ClientRegistry, aggregateTargets []*aggregateTarget) (*cloudLoader, error) {
	l := &cloudLoader{
		dirty:                      make(chan struct{}, 1),
		transports:                 map[tlsCacheKey]*http.Transport{},
		coreGroupsWithoutManifests: getAPIGroupsForCoreGroupsWithoutManifests(),
		clients:                    clients,
		aggregateTargets:           aggregateTargets,
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
	}

	l.BasicService = services.NewBasicService(l.starting, l.running, nil).WithName("cloud-apps-routes-loader")
	return l, nil
}

// starting builds the RouteBackend/AppManifest informers, both wired to the
// same Watcher() so either kind wakes the router (see AGENTS.md). Building
// them here rather than in newCloudLoader keeps client construction (which
// can happen well before the router module actually starts) separate from
// the informers' own lifecycle. Skipped entirely when l.clients is nil, i.e.
// appmanifest_apiserver_url wasn't configured -- this loader may still be
// active for aggregate targets alone.
func (l *cloudLoader) starting(context.Context) error {
	if l.clients == nil {
		return nil
	}

	watcher := l.Watcher()

	rb, err := newInformer(v1alpha2.RouteBackendKind(), l.clients, watcher)
	if err != nil {
		return fmt.Errorf("route backend informer: %w", err)
	}
	am, err := newInformer(v1alpha2.AppManifestKind(), l.clients, watcher)
	if err != nil {
		return fmt.Errorf("app manifest informer: %w", err)
	}
	l.rbInformer, l.amInformer = rb, am
	return nil
}

// running drives the RouteBackend/AppManifest informers (if configured) and
// every aggregate target's poll loop until ctx is cancelled; any one failing
// stops the rest and fails the loader's service, so the router module (which
// runs this alongside GrafanaRouter, see newCompositeService in pkg/server)
// can react instead of serving from a routing table that silently stopped
// updating.
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
	return g.Wait()
}

// newInformer builds a kind's informer against clients and attaches watcher
// as its sole event handler -- the informers exist only as change-detectors
// (see Watcher()), so no other handler is needed.
func newInformer(kind resource.Kind, clients *k8s.ClientRegistry, watcher operator.ResourceWatcher) (operator.Informer, error) {
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

// getAPIGroupsForCoreGroupsWithoutManifests indexes every ManifestData
// packaged into this binary (pkg/storage/unified/resource.AppManifests, the
// same embedded set the apiserver uses) by AppName. combineByName consults
// this as a fallback when a RouteBackend's group has no correlating
// AppManifest CR — e.g. folder, dashboard, secret, and other core groups that
// aren't registered as AppManifest resources in the apiserver. Apps that do
// have a real AppManifest CR are unaffected: the CR-sourced manifestMap is
// always tried first.
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
	return l.dirty, nil // simple.App's informer drives this internal channel
}

func (l *cloudLoader) Load(ctx context.Context) ([]Backend, error) {
	var combined []Backend
	if l.routeBackendClient != nil {
		backends, err := l.routeBackendClient.ListAll(ctx, "", resource.ListOptions{})
		if err != nil {
			return nil, err
		}

		manifests, err := l.appManifestClient.ListAll(ctx, "", resource.ListOptions{})
		if err != nil {
			return nil, err
		}
		combined = l.combineByName(manifests.Items, backends.Items)
	}

	for _, target := range l.aggregateTargets {
		combined = append(combined, target.Backends()...)
	}
	return combined, nil
}

// transportFor returns a transport for the given TLS settings, building and
// caching one on first use. Called only from reconcile (single goroutine), so
// the transports map needs no lock. Backends sharing a tlsCacheKey share a
// transport, so their connection pools are shared too. This shared cache is
// what preserves connection pools across a config change: rebuilding a group's
// Backend reuses the cached transport, so its pool survives untouched.
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
