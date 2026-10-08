package router

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/prometheus/client_golang/prometheus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation"

	"github.com/grafana/grafana-app-sdk/logging"
	appclientv3 "github.com/grafana/grafana-app-sdk/plugin/client/v3"
	"github.com/grafana/grafana/apps/secret/pkg/decrypt"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	"github.com/grafana/grafana/pkg/plugins/definition"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
	"github.com/grafana/grafana/pkg/registry/apis/appplugin"
	keysapi "github.com/grafana/grafana/pkg/registry/apis/keys"
	searchapi "github.com/grafana/grafana/pkg/registry/apis/search"
	secret "github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/services/apiserver/restcfg"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginroute"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type PluginClientProvider = func(ctx context.Context, id string) (plugins.Client, appclientv3.Client, error)

// The dependencies are configured at startup and used across all plugins
type PluginDependencies struct {
	PluginClient       plugins.Client
	ContextProvider    appplugin.PluginContextWrapper
	AccessControl      accesscontrol.AccessControl
	DualWrite          dualwrite.Service
	SecureValues       secret.InlineSecureValueSupport
	MetricsRegister    prometheus.Registerer
	BuilderMetrics     *builder.BuilderMetrics
	RESTConfigProvider restcfg.RestConfigProvider
	PluginSettings     pluginsettings.Service
	Unified            resource.ResourceClient
	Decrypter          decrypt.DecryptService
	TokenExchanger     authn.TokenExchanger       // used for delegation
	Tracer             tracing.Tracer             // needed for proxy (legacy)
	Features           featuremgmt.FeatureToggles // needed for proxy (legacy)
	Cfg                *setting.Cfg
}

type PluginLoaderDependencies struct {
	PluginDependencies

	ClientV3Loader v3.ClientV3Loader
	PluginSources  sources.Registry
	ACService      accesscontrol.Service
	AccessClient   types.AccessClient
}

func ProvidePluginLoaderDependencies(
	pluginClient plugins.Client,
	contextProvider appplugin.PluginContextWrapper,
	clientV3Loader v3.ClientV3Loader,
	pluginSources sources.Registry,
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
) PluginLoaderDependencies {
	return PluginLoaderDependencies{
		ClientV3Loader: clientV3Loader,
		PluginSources:  pluginSources,
		ACService:      acService,
		AccessClient:   accessClient,
		PluginDependencies: PluginDependencies{
			PluginClient:       pluginClient,
			ContextProvider:    contextProvider,
			AccessControl:      accessControl,
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
		},
	}
}

func newClientV3TokenExchanger(cfg *setting.Cfg) authn.TokenExchanger {
	// A missing exchange configuration leaves requests unauthenticated: the
	// caller's identity is not propagated, and plugins that authenticate reject
	// them. An invalid one fails each request with the configuration error.
	exchanger, err := appplugin.NewClientV3TokenExchanger(cfg)
	if err != nil {
		return appplugin.InvalidClientV3TokenExchanger(err)
	}
	return exchanger
}

// The router module supplies these clients so its Wire graph does not construct
// a second resource client or initialize local storage migrations.
func ProvidePluginLoaderDependenciesWithClients(
	pluginClient plugins.Client,
	contextProvider appplugin.PluginContextWrapper,
	clientV3Loader v3.ClientV3Loader,
	pluginSources sources.Registry,
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
) PluginLoaderDependencies {
	return ProvidePluginLoaderDependencies(
		pluginClient,
		contextProvider,
		clientV3Loader,
		pluginSources,
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
	)
}

func initLocalPlugins(ctx context.Context, deps PluginLoaderDependencies) error {
	// Declare roles during dependency construction, before startup registers fixed
	// roles. Reconciliation must not append the same declarations on every load.
	pluginDefs, err := loadLocalPluginDefinitions(ctx, deps.PluginSources, false)
	if err != nil {
		return err
	}
	for _, plugin := range pluginDefs {
		// The handler installs settings on a copy of the storage config, so resolve
		// the wildcard default where the shared dual-write service reads it.
		if deps.Cfg != nil {
			appplugin.ApplyDefaultSettingsStorageConfig(deps.Cfg.UnifiedStorage, plugin.JSONData.ID)
		}
		if len(plugin.Manifests) == 0 || plugin.Manifests[0] == nil {
			continue
		}
		group := plugin.Manifests[0].Group
		if !strings.HasSuffix(group, pluginManifestGroupSuffix) || len(validation.IsDNS1123Subdomain(group)) > 0 {
			logging.FromContext(ctx).Warn("router: skipping roles for invalid manifest group", "pluginId", plugin.JSONData.ID, "group", group)
			continue
		}
		if err := declareManifestRoles(deps.ACService, group, plugin.JSONData.Name, plugin.Manifests[0]); err != nil {
			return fmt.Errorf("error declaring roles for %s: %w", plugin.JSONData.ID, err)
		}
	}
	return nil
}

type PluginLoader struct {
	deps PluginLoaderDependencies
}

func loadLocalPluginDefinitions(ctx context.Context, registry sources.Registry, schemas bool) ([]definition.PluginDefinition, error) {
	pluginDefs, err := definition.LoadPluginDefinition(ctx, registry, definition.Options{
		Filter: func(jsonData plugins.JSONData) bool {
			if jsonData.Type == plugins.TypeApp {
				if jsonData.ID == "v1" || !isPluginAPIGroup(jsonData.ID) {
					logging.FromContext(ctx).Warn("invalid app plugin id", "pluginId", jsonData.ID)
					return false
				}
				return true
			}
			return false
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
	pluginDefs, err := loadLocalPluginDefinitions(ctx, pl.deps.PluginSources, true)
	if err != nil {
		return nil, err
	}

	// Settings retain the plugin ID even when the manifest declares another group.
	for _, plugin := range pluginDefs {
		if len(plugin.Manifests) > 0 && plugin.Manifests[0] != nil {
			settings := plugin
			settings.Manifests = nil
			pluginDefs = append(pluginDefs, settings)
		}
	}
	backends := make([]Backend, 0, len(pluginDefs))
	for _, plugin := range pluginDefs {
		backend, err := NewPluginBackend(plugin,
			func(ctx context.Context, id string) (plugins.Client, appclientv3.Client, error) {
				return pl.deps.PluginClient, v3.NewLazyClient(pl.deps.ClientV3Loader, plugin.JSONData.ID), nil
			}, pl.deps.PluginDependencies,
		)
		if err != nil {
			// One bad plugin must not keep every other plugin from loading.
			logging.FromContext(ctx).Warn("router: skipping app plugin", "pluginId", plugin.JSONData.ID, "err", err)
			continue
		}
		backends = append(backends, backend)
	}
	return backends, nil
}

// pluginManifestGroupSuffix is required on manifest groups: unified storage
// always enforces RBAC on it, and no core Grafana group uses it.
const pluginManifestGroupSuffix = ".ext.grafana.app"

// isPluginAPIGroup reports whether group has the shape of an app plugin's API
// group: a manifest group ending in pluginManifestGroupSuffix, or a plugin ID,
// which contains a hyphen and no dots. No core Grafana or Kubernetes group has
// either shape, so a group that passes cannot shadow one.
func isPluginAPIGroup(group string) bool {
	if name, ok := strings.CutSuffix(group, pluginManifestGroupSuffix); ok {
		return name != ""
	}
	return strings.Contains(group, "-") && !strings.Contains(group, ".")
}

func (PluginLoader) Notify(context.Context) (<-chan struct{}, error) {
	return make(chan struct{}), nil // TODO? is there a plugin registry with update events?
}

//-----------------------
// BACKEND
//-----------------------

func NewPluginBackend(plugin definition.PluginDefinition, client PluginClientProvider, deps PluginDependencies) (_ *PluginBackend, err error) {
	// The plugin API builder panics on an invalid manifest. Plugins are loaded
	// inside the reconcile loop, so a panic here would stop it for every group.
	defer func() {
		if p := recover(); p != nil {
			err = fmt.Errorf("plugin %q: %v", plugin.JSONData.ID, p)
		}
	}()
	group, err := pluginroute.APIGroup(plugin, pluginroute.Options{PluginClient: deps.PluginClient, ContextProvider: deps.ContextProvider})
	if err != nil {
		return nil, err
	}
	if !isPluginAPIGroup(group.Name) {
		return nil, fmt.Errorf("plugin %q: API group %q is not a plugin group", plugin.JSONData.ID, group.Name)
	}

	b, err := json.Marshal(plugin)
	if err != nil {
		return nil, err
	}

	sum := sha256.Sum256(b)

	return &PluginBackend{
		key:    "p:" + hex.EncodeToString(sum[:]),
		group:  group,
		plugin: plugin,
		client: client,
		deps:   deps,
	}, nil
}

type PluginBackend struct {
	key   string
	group metav1.APIGroup

	plugin definition.PluginDefinition
	client PluginClientProvider
	deps   PluginDependencies
}

func (b *PluginBackend) Group() metav1.APIGroup {
	return b.group
}

// Source implements [Backend].
func (b *PluginBackend) Source() string { return sourceLocalPlugin }

func (b *PluginBackend) Key() string {
	return b.key
}

func (b *PluginBackend) Load(ctx context.Context) (http.Handler, error) {
	clientV2, clientV3, err := b.client(ctx, b.plugin.JSONData.ID)
	if err != nil {
		return nil, err
	}
	if clientV2 != nil {
		clientV2 = &breakerPluginClient{Client: clientV2}
	}
	if clientV3 != nil {
		clientV3 = &breakerPluginClientV3{Client: clientV3}
	}
	// Keep authentication outside the breaker: token exchange failures do not
	// indicate whether the plugin is reachable.
	clientV3, err = v3.WithAuthentication(clientV3, b.plugin.JSONData.ID,
		appplugin.ClientV3TokenExchanger(b.deps.Cfg, b.plugin.JSONData.ID, b.deps.TokenExchanger))
	if err != nil {
		return nil, err
	}

	cfg := b.deps.Cfg
	if cfg == nil {
		cfg = setting.NewCfg()
	}
	apiserverSection := cfg.SectionWithEnvOverrides(searchapi.ConfigSection)
	opts := pluginroute.Options{
		Storage:          pluginroute.UnifiedStorage(b.deps.Unified, b.deps.SecureValues, b.deps.RESTConfigProvider),
		PluginClient:     clientV2,
		ClientV3:         clientV3,
		ContextProvider:  b.deps.ContextProvider,
		Decrypter:        b.deps.Decrypter,
		Search:           b.deps.Unified,
		Store:            b.deps.Unified,
		HybridAPIEnabled: apiserverSection.Key(searchapi.ConfigKeyHybrid).MustBool(true),
		KeysAPIEnabled:   apiserverSection.Key(keysapi.ConfigKey).MustBool(false),
		Runner: appplugin.AppPluginRunnerOptions{
			RegisterProxy:            openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagApppluginsHandleProxyRequests, false, openfeature.TransactionContext(ctx)),
			AccessControl:            b.deps.AccessControl,
			DataProxyLogging:         cfg.DataProxyLogging,
			SendUserHeader:           cfg.SendUserHeader,
			PluginsAppsSkipVerifyTLS: cfg.PluginsAppsSkipVerifyTLS,
		},
		Tracer:          b.deps.Tracer,
		Features:        b.deps.Features,
		BuildVersion:    cfg.BuildVersion,
		MetricsRegister: b.deps.MetricsRegister,
		DualWrite:       b.deps.DualWrite,
		StorageOpts:     &options.StorageOptions{UnifiedStorageConfig: cfg.UnifiedStorage},
		BuilderMetrics:  b.deps.BuilderMetrics,
	}
	if b.deps.AccessControl != nil {
		opts.AccessChecker = appplugin.NewPluginAccessChecker(b.deps.AccessControl)
	}
	if b.deps.PluginSettings != nil {
		opts.Runner.LegacyStore = appplugin.NewLegacySettingsStore(b.group.Name, b.plugin.JSONData.ID, b.deps.PluginSettings)
	}
	handler, err := pluginroute.NewHandler(b.plugin, opts)
	if err != nil {
		return nil, err
	}
	return &tracedPluginHandler{Handler: handler, pluginID: b.plugin.JSONData.ID, group: b.group.Name}, nil
}
