package router

import (
	"cmp"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"sync"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/prometheus/client_golang/prometheus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	appclientv3 "github.com/grafana/grafana-app-sdk/plugin/client/v3"
	"github.com/grafana/grafana/apps/secret/pkg/decrypt"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	"github.com/grafana/grafana/pkg/plugins/definition"
	searchapi "github.com/grafana/grafana/pkg/registry/apis/search"
	secret "github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	keysapi "github.com/grafana/grafana/pkg/services/apiserver/keys"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/services/apiserver/restcfg"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/baasbridge" //nolint:staticcheck // deprecated shim, used until HTTP operators move to gRPC
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginauth"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginroute"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginroute/appsettings"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type PluginClientProvider = func(ctx context.Context, id string) (plugins.Client, appclientv3.Client, error)

// The dependencies are configured at startup and used across all plugins
type PluginDependencies struct {
	PluginClient       plugins.Client
	ContextProvider    appsettings.PluginContextWrapper
	AccessControl      accesscontrol.AccessControl
	AccessClient       types.AccessClient // runs the access checks manifest routes declare
	DualWrite          dualwrite.Service
	SecureValues       secret.InlineSecureValueSupport
	MetricsRegister    prometheus.Registerer
	BuilderMetrics     *builder.BuilderMetrics
	RESTConfigProvider restcfg.RestConfigProvider
	PluginSettings     pluginsettings.Service
	Unified            resource.ResourceClient
	Decrypter          decrypt.DecryptService
	TokenExchanger     authn.TokenExchanger       // used for delegation
	PluginAuth         *pluginauth.Config         // whether Grafana signs plugin tokens itself
	Tracer             tracing.Tracer             // needed for proxy (legacy)
	Features           featuremgmt.FeatureToggles // needed for proxy (legacy)
	Cfg                *setting.Cfg
}

type PluginLoaderDependencies struct {
	PluginDependencies

	ClientV3Loader v3.ClientV3Loader
	PluginStore    pluginstore.Store
	PluginNotifier pluginstore.Notifier
	ACService      accesscontrol.Service
}

func ProvidePluginLoaderDependencies(
	pluginClient plugins.Client,
	contextProvider appsettings.PluginContextWrapper,
	clientV3Loader v3.ClientV3Loader,
	pluginStore pluginstore.Store,
	pluginNotifier pluginstore.Notifier,
	pluginSettings pluginsettings.Service,
	acService accesscontrol.Service,
	accessControl accesscontrol.AccessControl,
	unified resource.ResourceClient,
	accessClient types.AccessClient,
	decrypter decrypt.DecryptService,
	tracer tracing.Tracer,
	features featuremgmt.FeatureToggles,
	cfg *setting.Cfg,
	dualWrite dualwrite.Service,
	secureValues secret.InlineSecureValueSupport,
	reg prometheus.Registerer,
	builderMetrics *builder.BuilderMetrics,
	restConfigProvider restcfg.RestConfigProvider,
	pluginAuth *pluginauth.Config,
) PluginLoaderDependencies {
	return PluginLoaderDependencies{
		ClientV3Loader: clientV3Loader,
		PluginStore:    pluginStore,
		PluginNotifier: pluginNotifier,
		ACService:      acService,
		PluginDependencies: PluginDependencies{
			PluginClient:       pluginClient,
			ContextProvider:    contextProvider,
			AccessControl:      accessControl,
			AccessClient:       accessClient,
			DualWrite:          dualWrite,
			SecureValues:       secureValues,
			MetricsRegister:    reg,
			BuilderMetrics:     builderMetrics,
			RESTConfigProvider: restConfigProvider,
			PluginSettings:     pluginSettings,
			Unified:            unified,
			Decrypter:          decrypter,
			Tracer:             tracer,
			Features:           features,
			Cfg:                cfg,
			TokenExchanger:     newClientV3TokenExchanger(cfg),
			PluginAuth:         pluginAuth,
		},
	}
}

func newClientV3TokenExchanger(cfg *setting.Cfg) authn.TokenExchanger {
	// A missing exchange configuration leaves requests unauthenticated: the
	// caller's identity is not propagated, and plugins that authenticate reject
	// them. An invalid one fails each request with the configuration error.
	exchanger, err := pluginauth.NewClientV3TokenExchanger(cfg)
	if err != nil {
		return pluginauth.InvalidClientV3TokenExchanger(err)
	}
	return exchanger
}

// The router module supplies these clients so its Wire graph does not construct
// a second resource client or initialize local storage migrations.
func ProvidePluginLoaderDependenciesWithClients(
	pluginClient plugins.Client,
	contextProvider appsettings.PluginContextWrapper,
	clientV3Loader v3.ClientV3Loader,
	pluginStore pluginstore.Store,
	pluginNotifier pluginstore.Notifier,
	pluginSettings pluginsettings.Service,
	acService accesscontrol.Service,
	accessControl accesscontrol.AccessControl,
	decrypter decrypt.DecryptService,
	tracer tracing.Tracer,
	features featuremgmt.FeatureToggles,
	cfg *setting.Cfg,
	reg prometheus.Registerer,
	builderMetrics *builder.BuilderMetrics,
	clients RoutesLoaderClients,
	pluginAuth *pluginauth.Config,
) PluginLoaderDependencies {
	return ProvidePluginLoaderDependencies(
		pluginClient,
		contextProvider,
		clientV3Loader,
		pluginStore,
		pluginNotifier,
		pluginSettings,
		acService,
		accessControl,
		clients.Resource,
		clients.Access,
		decrypter,
		tracer,
		features,
		cfg,
		clients.DualWrite,
		clients.SecureValues,
		reg,
		builderMetrics,
		clients.RESTConfigProvider,
		pluginAuth,
	)
}

// localPluginInits runs initLocalPlugin once for each plugin this Grafana
// runs, and again when its definition changes. Reconcile reads every plugin on
// each wake, and declaring the same roles repeatedly would append them again.
type localPluginInits struct {
	mu   sync.Mutex
	done map[string]string // plugin ID -> fingerprint of the definition last initialized
}

func newLocalPluginInits() *localPluginInits {
	return &localPluginInits{done: map[string]string{}}
}

// run initializes the plugins that are new or changed since the last call. A
// plugin that fails is logged, left to retry on the next wake, and does not
// keep the others, or its own backends, from loading.
func (l *localPluginInits) run(ctx context.Context, deps PluginLoaderDependencies, defs []definition.PluginDefinition) {
	l.mu.Lock()
	defer l.mu.Unlock()
	for _, plugin := range defs {
		key, err := pluginDefinitionKey(plugin)
		if err != nil {
			logging.FromContext(ctx).Warn("router: skipping init of unfingerprintable plugin", "pluginId", plugin.JSONData.ID, "err", err)
			continue
		}
		if l.done[plugin.JSONData.ID] == key {
			continue
		}
		if err := initLocalPlugin(ctx, deps, plugin); err != nil {
			logging.FromContext(ctx).Warn("router: init of local plugin failed", "pluginId", plugin.JSONData.ID, "err", err)
			continue
		}
		l.done[plugin.JSONData.ID] = key
	}
}

// pluginDefinitionKey fingerprints what initLocalPlugin reads: the plugin's
// metadata and all of its manifests, but not the schemas.
func pluginDefinitionKey(plugin definition.PluginDefinition) (string, error) {
	plugin.Schemas = nil
	plugin.Manifest = nil //nolint:staticcheck
	raw, err := json.Marshal(plugin)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:]), nil
}

// initLocalPlugin does what a plugin run by this Grafana needs before the
// router serves it: it resolves the settings storage default and declares the
// roles of its manifests. Roles of a plugin that is later removed stay
// declared until restart, which is harmless once its group is no longer routed.
func initLocalPlugin(ctx context.Context, deps PluginLoaderDependencies, plugin definition.PluginDefinition) error {
	// The handler installs settings on a copy of the storage config, so resolve
	// the wildcard default where the shared dual-write service reads it.
	if deps.Cfg != nil {
		appsettings.ApplyDefaultSettingsStorageConfig(deps.Cfg.UnifiedStorage, plugin.JSONData.ID)
	}

	for _, manifest := range plugin.Manifests {
		if err := declareLocalManifestRoles(ctx, deps.ACService, plugin.JSONData.ID, plugin.JSONData.Name, manifest); err != nil {
			return err
		}
	}
	return nil
}

// declareLocalManifestRoles declares the roles of a manifest served by the
// local plugin loader. A routable core group keeps the roles its own app
// declares, and an invalid group gets none.
func declareLocalManifestRoles(ctx context.Context, service accesscontrol.Service, pluginID, pluginName string, manifest *app.ManifestData) error {
	if manifest == nil {
		return nil
	}
	group := manifest.Group
	if slices.Contains(routableCoreGroups, group) {
		return nil
	}
	if !isPluginManifestGroup(group) || len(validation.IsDNS1123Subdomain(group)) > 0 {
		logging.FromContext(ctx).Warn("router: skipping roles for invalid manifest group", "pluginId", pluginID, "group", group)
		return nil
	}
	if err := declareManifestRoles(service, group, pluginName, manifest); err != nil {
		return fmt.Errorf("error declaring roles for %s: %w", pluginID, err)
	}
	return nil
}

type PluginLoader struct {
	deps PluginLoaderDependencies

	// settings is whether the loader serves app plugin settings
	// (settingsEnabled).
	settings bool

	// dev serves the [router.dev.<name>] sections; nil when none is set.
	dev *devTargets

	// inits initializes each local plugin as it appears; nil outside middleware
	// mode, where the router declares nothing for the plugins it serves.
	inits *localPluginInits
}

func loadLocalPluginDefinitions(ctx context.Context, store pluginstore.Store, schemas bool) ([]definition.PluginDefinition, error) {
	loaded := make([]definition.LoadedPlugin, 0)
	for _, p := range store.Plugins(ctx, plugins.TypeApp) {
		if p.Error != nil || p.FS == nil {
			continue
		}
		loaded = append(loaded, definition.LoadedPlugin{FS: p.FS, JSONData: p.JSONData})
	}
	// The store lists plugins in map order, and the load must be stable.
	slices.SortFunc(loaded, func(a, b definition.LoadedPlugin) int { return strings.Compare(a.JSONData.ID, b.JSONData.ID) })

	pluginDefs, err := definition.LoadPluginDefinitionFromPlugins(loaded, definition.Options{
		Filter: func(jsonData plugins.JSONData) bool {
			if !isAppPluginID(jsonData.ID) {
				logging.FromContext(ctx).Warn("invalid app plugin id", "pluginId", jsonData.ID)
				return false
			}
			return true
		},
		Schemas:     schemas,
		AppManifest: true, // Load manifests
	})
	if err != nil {
		return nil, fmt.Errorf("error getting list of app plugins: %w", err)
	}
	return pluginDefs, nil
}

func (pl PluginLoader) Load(ctx context.Context) ([]Backend, error) {
	dev := pl.dev.backends(ctx)
	if pl.deps.PluginStore == nil {
		return dev, nil
	}

	pluginDefs, err := loadLocalPluginDefinitions(ctx, pl.deps.PluginStore, true)
	if err != nil {
		return nil, err
	}
	if pl.inits != nil {
		pl.inits.run(ctx, pl.deps, pluginDefs)
	}
	backends, err := pl.prepareBackends(ctx, pluginDefs)
	if err != nil {
		return nil, err
	}
	// Dev targets come last, so they replace a local plugin serving the same group.
	return append(backends, dev...), nil
}

func (pl PluginLoader) prepareBackends(ctx context.Context, pluginDefs []definition.PluginDefinition) ([]Backend, error) {
	backends := make([]Backend, 0, len(pluginDefs))
	for _, plugin := range pluginDefs {
		client := func(ctx context.Context, id string) (plugins.Client, appclientv3.Client, error) {
			return pl.deps.PluginClient, v3.NewLazyClient(pl.deps.ClientV3Loader, id), nil
		}

		if pl.settings {
			if backend, err := newPluginSettingsBackend(plugin, client, pl.deps.PluginDependencies); err != nil {
				logging.FromContext(ctx).Warn("router: skipping app plugin settings", "pluginId", plugin.JSONData.ID, "err", err)
			} else {
				backends = append(backends, backend)
			}
		}

		for _, manifest := range plugin.Manifests {
			key, err := pluginManifestKeyData(plugin, manifest, "")
			if err != nil {
				logging.FromContext(ctx).Warn("router: skipping unfingerprintable plugin manifest", "pluginId", plugin.JSONData.ID, "err", err)
				continue
			}
			backend, err := newPluginBackend(plugin.JSONData.ID, manifest, client, pl.deps.PluginDependencies, key)
			if err != nil {
				// One bad manifest must not keep its siblings or other plugins from loading.
				logging.FromContext(ctx).Warn("router: skipping app plugin", "pluginId", plugin.JSONData.ID, "err", err)
				continue
			}
			backend.info = plugin.JSONData.Info
			backend.hasBackend = plugin.JSONData.Backend
			backends = append(backends, backend)
		}
	}
	return backends, nil
}

// Shared plugin metadata affects every group, but sibling manifests must not
// invalidate each other's handlers and active watches.
func pluginManifestKeyData(plugin definition.PluginDefinition, manifest *app.ManifestData, host string) ([]byte, error) {
	plugin.Manifests = nil
	plugin.Manifest = nil //nolint:staticcheck
	return json.Marshal(struct {
		Definition definition.PluginDefinition
		Manifest   *app.ManifestData
		Host       string
	}{plugin, manifest, host})
}

// pluginManifestGroupSuffix is required on manifest groups: unified storage
// always enforces RBAC on it, and no core Grafana group uses it.
const pluginManifestGroupSuffix = ".ext.grafana.app"

// isPluginManifestGroup reports whether group is a plugin manifest group: a
// name followed by pluginManifestGroupSuffix.
func isPluginManifestGroup(group string) bool {
	name, ok := strings.CutSuffix(group, pluginManifestGroupSuffix)
	return ok && name != ""
}

// isAppPluginID reports whether id has the shape of an app plugin ID: it
// contains a hyphen and no dots.
func isAppPluginID(id string) bool {
	return strings.Contains(id, "-") && !strings.Contains(id, ".")
}

// Notify wakes on changes to the plugin store and to the dev manifests.
func (pl PluginLoader) Notify(ctx context.Context) (<-chan struct{}, error) {
	var wakes []<-chan struct{}
	if pl.dev != nil {
		ch, err := pl.dev.notify(ctx)
		if err != nil {
			return nil, err
		}
		wakes = append(wakes, ch)
	}
	if pl.deps.PluginNotifier != nil {
		wakes = append(wakes, pl.deps.PluginNotifier.Notify(ctx))
	}
	switch len(wakes) {
	case 0:
		return make(chan struct{}), nil
	case 1:
		return wakes[0], nil
	}
	return mergeWakes(ctx, wakes...), nil
}

// mergeWakes folds wake channels into one that coalesces them. It closes once
// every input is closed or ctx is done.
func mergeWakes(ctx context.Context, in ...<-chan struct{}) <-chan struct{} {
	out := make(chan struct{}, 1)
	var wg sync.WaitGroup
	for _, ch := range in {
		wg.Go(func() {
			for {
				select {
				case <-ctx.Done():
					return
				case _, ok := <-ch:
					if !ok {
						return
					}
					wake(out)
				}
			}
		})
	}
	go func() {
		wg.Wait()
		close(out)
	}()
	return out
}

//-----------------------
// BACKEND
//-----------------------

// routableCoreGroups are the core groups a plugin backend may serve in place of
// the embedded API server, from any source, local and remote plugins included.
// This is deliberate: these groups are low risk, so any plugin may shadow them.
// A misbehaving or malicious plugin serving one of them can do no serious harm,
// which is why the router may route them before their authorization moves too.
// Before adding a group, confirm the same holds for it: never add a group
// whose data or permissions matter, such as dashboards, folders or IAM.
var routableCoreGroups = []string{"playlist.grafana.app", "example.grafana.app"}

// newPluginBackend builds the backend for one plugin manifest. Its group must be
// a plugin group (*.ext.grafana.app) or one of routableCoreGroups.
func newPluginBackend(pluginID string, manifest *app.ManifestData, client PluginClientProvider, deps PluginDependencies, key []byte) (_ *PluginBackend, err error) {
	// The plugin API builder panics on an invalid manifest. Plugins are loaded
	// inside the reconcile loop, so a panic here would stop it for every group.
	defer func() {
		if p := recover(); p != nil {
			err = fmt.Errorf("plugin %q: %v", pluginID, p)
		}
	}()

	if manifest == nil {
		return nil, fmt.Errorf("plugin %q: missing manifest", pluginID)
	}
	if !isPluginManifestGroup(manifest.Group) && !slices.Contains(routableCoreGroups, manifest.Group) {
		return nil, fmt.Errorf("plugin %q: API group %q must end in %s, or be a routable core group", pluginID, manifest.Group, pluginManifestGroupSuffix)
	}
	if err := pluginroute.ValidateManifest(pluginID, manifest); err != nil {
		return nil, err
	}
	group := pluginroute.APIGroup(manifest)
	if len(group.Versions) == 0 {
		return nil, fmt.Errorf("plugin %q has no served versions", pluginID)
	}
	h := sha256.New()
	_, _ = h.Write(key)
	_, _ = h.Write([]byte(manifest.Group))

	return &PluginBackend{
		key:      "p:" + hex.EncodeToString(h.Sum(nil)),
		pluginID: pluginID,
		group:    group,
		manifest: manifest,
		client:   client,
		deps:     deps,
	}, nil
}

// newPluginSettingsBackend builds the backend for an app plugin's settings
// API, whose group is the plugin ID. A plugin ID has no dots, so it can never
// claim a core group or a manifest group.
func newPluginSettingsBackend(plugin definition.PluginDefinition, client PluginClientProvider, deps PluginDependencies) (*PluginBackend, error) {
	id := plugin.JSONData.ID
	if !isAppPluginID(id) || len(validation.IsDNS1123Label(id)) > 0 {
		return nil, fmt.Errorf("plugin %q: invalid app plugin ID for a settings API group", id)
	}
	key, err := pluginManifestKeyData(plugin, nil, "")
	if err != nil {
		return nil, err
	}
	h := sha256.New()
	_, _ = h.Write(key)
	_, _ = h.Write([]byte(id))

	version := metav1.GroupVersionForDiscovery{GroupVersion: id + "/" + apppluginV0.VERSION, Version: apppluginV0.VERSION}
	return &PluginBackend{
		key:        "p:" + hex.EncodeToString(h.Sum(nil)),
		pluginID:   id,
		info:       plugin.JSONData.Info,
		group:      metav1.APIGroup{Name: id, Versions: []metav1.GroupVersionForDiscovery{version}, PreferredVersion: version},
		settings:   &plugin,
		client:     client,
		deps:       deps,
		hasBackend: plugin.JSONData.Backend,
	}, nil
}

type PluginBackend struct {
	key string
	// source is reported by Source; empty for a local plugin.
	source string

	pluginID string
	// metricsID, when set, is the plugin_id the backend's requests are
	// recorded under instead of pluginID, in metrics and spans. A core_url
	// entry without a plugin ID uses its API group, as its connection does.
	metricsID string
	info      plugins.Info
	group     metav1.APIGroup
	manifest  *app.ManifestData
	client    PluginClientProvider
	deps      PluginDependencies

	// settings is set instead of manifest for the backend that serves the
	// plugin's settings API under its plugin ID.
	settings *definition.PluginDefinition

	// hasBackend is whether the plugin runs a backend process, for the
	// status page.
	hasBackend bool

	// acquire, when set, takes what each loaded handler holds until it is
	// destroyed, such as a reference to a managed plugin's connection.
	acquire func() (release func(), err error)
}

// PluginStatus implements [PluginStatusProvider]. A core_url entry without a
// plugin ID serves no plugin, so it reports none.
func (b *PluginBackend) PluginStatus() (PluginStatus, bool) {
	if b.pluginID == "" {
		return PluginStatus{}, false
	}
	return PluginStatus{ID: b.pluginID, Version: b.info.Version, HasBackend: b.hasBackend}, true
}

func (b *PluginBackend) Group() metav1.APIGroup {
	return b.group
}

// Source implements [Backend].
func (b *PluginBackend) Source() string { return cmp.Or(b.source, sourceLocalPlugin) }

// Manifest implements [ManifestProvider].
func (b *PluginBackend) Manifest() (*app.ManifestData, bool) {
	return b.manifest, b.manifest != nil
}

func (b *PluginBackend) Key() string {
	return b.key
}

func (b *PluginBackend) Load(ctx context.Context) (http.Handler, error) {
	release := func() {}
	if b.acquire != nil {
		var err error
		if release, err = b.acquire(); err != nil {
			return nil, err
		}
	}
	// Release unless the handler takes it over, also when load panics: the
	// router recovers the panic and retries the load.
	loaded := false
	defer func() {
		if !loaded {
			release()
		}
	}()
	handler, err := b.load(ctx)
	if err != nil {
		return nil, err
	}
	loaded = true
	return &tracedPluginHandler{Handler: handler, pluginID: b.metricsPluginID(), group: b.group.Name, release: release}, nil
}

// metricsPluginID is the plugin_id the backend's requests are recorded under.
func (b *PluginBackend) metricsPluginID() string {
	return cmp.Or(b.metricsID, b.pluginID)
}

func (b *PluginBackend) load(ctx context.Context) (*pluginroute.Handler, error) {
	clientV2, clientV3, err := b.client(ctx, b.pluginID)
	if err != nil {
		return nil, err
	}
	cfg := b.deps.Cfg
	if cfg == nil {
		cfg = setting.NewCfg()
	}
	opts := pluginroute.Options{
		PluginInfo:      b.info,
		Storage:         pluginroute.UnifiedStorage(b.deps.Unified, b.deps.SecureValues, b.deps.RESTConfigProvider),
		Decrypter:       b.deps.Decrypter,
		Tracer:          b.deps.Tracer,
		BuildVersion:    cfg.BuildVersion,
		MetricsRegister: b.deps.MetricsRegister,
	}
	if b.deps.AccessControl != nil {
		opts.AccessChecker = pluginaccesscontrol.NewAppAccessChecker(b.deps.AccessControl)
	}

	if b.settings != nil {
		return b.loadSettings(ctx, cfg, opts, clientV2)
	}
	return b.loadManifest(cfg, opts, clientV3)
}

// loadSettings serves the settings API, which calls the plugin through its
// v2 client only.
func (b *PluginBackend) loadSettings(ctx context.Context, cfg *setting.Cfg, opts pluginroute.Options, client plugins.Client) (*pluginroute.Handler, error) {
	if client != nil {
		opts.PluginClient = &breakerPluginClient{Client: client}
	}
	opts.ContextProvider = b.deps.ContextProvider
	opts.Features = b.deps.Features
	opts.Settings = appsettings.Options{
		RegisterProxy:            openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagApppluginsHandleProxyRequests, false, openfeature.TransactionContext(ctx)),
		AccessControl:            b.deps.AccessControl,
		DataProxyLogging:         cfg.DataProxyLogging,
		SendUserHeader:           cfg.SendUserHeader,
		PluginsAppsSkipVerifyTLS: cfg.PluginsAppsSkipVerifyTLS,
	}
	if b.deps.PluginSettings != nil {
		opts.Settings.LegacyStore = appsettings.NewLegacySettingsStore(b.pluginID, b.pluginID, b.deps.PluginSettings)
	}
	opts.DualWrite = b.deps.DualWrite
	opts.StorageOpts = &options.StorageOptions{UnifiedStorageConfig: cfg.UnifiedStorage}
	opts.BuilderMetrics = b.deps.BuilderMetrics
	return pluginroute.NewAppSettingsHandler(*b.settings, opts)
}

// loadManifest serves a manifest's kinds and routes, which call the plugin
// through its v3 client only.
func (b *PluginBackend) loadManifest(cfg *setting.Cfg, opts pluginroute.Options, client appclientv3.Client) (*pluginroute.Handler, error) {
	// A baasbridge client forwards the requester's own credentials, so an
	// exchanged token would go unused.
	bridged := baasbridge.IsClient(client) //nolint:staticcheck
	if client != nil {
		client = &breakerPluginClientV3{Client: client}
	}
	if !bridged {
		// Keep authentication outside the breaker: token exchange failures do not
		// indicate whether the plugin is reachable.
		var err error
		client, err = v3.WithAuthentication(client, b.pluginID, []string{b.group.Name},
			withAuthFailureOutcome(pluginauth.ClientV3TokenExchanger(b.deps.Cfg, b.deps.PluginAuth, b.pluginID, b.deps.TokenExchanger)))
		if err != nil {
			return nil, err
		}
	}
	apiserverSection := cfg.SectionWithEnvOverrides(searchapi.ConfigSection)
	opts.ClientV3 = client
	opts.AccessClient = b.deps.AccessClient
	opts.Search = b.deps.Unified
	opts.Store = b.deps.Unified
	opts.HybridAPIEnabled = apiserverSection.Key(searchapi.ConfigKeyHybrid).MustBool(true)
	opts.KeysAPIEnabled = apiserverSection.Key(keysapi.ConfigKey).MustBool(false)
	return pluginroute.NewHandler(b.pluginID, b.manifest, opts)
}

// withAuthFailureOutcome records failed token exchanges on the request, for
// grafana_router_backend_failures_total. They fail the call before it reaches
// the plugin.
func withAuthFailureOutcome(exchanger authn.TokenExchanger) authn.TokenExchanger {
	if exchanger == nil {
		return nil
	}
	return &authOutcomeExchanger{TokenExchanger: exchanger}
}

type authOutcomeExchanger struct{ authn.TokenExchanger }

func (e *authOutcomeExchanger) Exchange(ctx context.Context, r authn.TokenExchangeRequest) (*authn.TokenExchangeResponse, error) {
	res, err := e.TokenExchanger.Exchange(ctx, r)
	if err != nil && ctx.Err() == nil {
		setContextFailure(ctx, failureAuth)
	}
	return res, err
}
