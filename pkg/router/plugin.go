package router

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/grafana/authlib/types"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/prometheus/client_golang/prometheus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-app-sdk/logging"
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

type PluginClientProvider = func(ctx context.Context, id string) (plugins.Client, v3.ClientV3, error)

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
		},
	}
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

func newPluginLoader(deps PluginLoaderDependencies) (RoutesLoader, error) {
	return &PluginLoader{deps: deps}, nil
}

type PluginLoader struct {
	deps PluginLoaderDependencies
}

func (pl PluginLoader) Load(ctx context.Context) ([]Backend, error) {
	pluginDefs, err := definition.LoadPluginDefinition(ctx, pl.deps.PluginSources, definition.Options{
		Filter: func(jsonData plugins.JSONData) bool {
			if jsonData.Type == plugins.TypeApp {
				// TODO? should we fail more loudly
				if !strings.Contains(jsonData.ID, "-") || strings.Contains(jsonData.ID, ".") || jsonData.ID == "v1" {
					logging.FromContext(ctx).Warn("invalid app plugin id", "pluginId", jsonData.ID)
					return false
				}
				return true
			}
			return false
		},
		Schemas:     true,
		AppManifest: true, // Load manifests
	})

	if err != nil {
		return nil, fmt.Errorf("error getting list of app plugins: %w", err)
	}

	backends := make([]Backend, 0, len(pluginDefs))
	for _, plugin := range pluginDefs {
		backend, err := NewPluginBackend(plugin,
			func(ctx context.Context, id string) (plugins.Client, v3.ClientV3, error) {
				return pl.deps.PluginClient, v3.NewLazyClient(pl.deps.ClientV3Loader, plugin.JSONData.ID), nil
			}, pl.deps.PluginDependencies,
		)
		if err != nil {
			return nil, err
		}
		backends = append(backends, backend)
	}
	return backends, nil
}

func (PluginLoader) Notify(context.Context) (<-chan struct{}, error) {
	return make(chan struct{}), nil // TODO? is there a plugin registry with update events?
}

//-----------------------
// BACKEND
//-----------------------

func NewPluginBackend(plugin definition.PluginDefinition, client PluginClientProvider, deps PluginDependencies) (*PluginBackend, error) {
	group, err := pluginroute.APIGroup(plugin, pluginroute.Options{PluginClient: deps.PluginClient, ContextProvider: deps.ContextProvider})
	if err != nil {
		return nil, err
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

func (b *PluginBackend) Key() string {
	return b.key
}

func (b *PluginBackend) Load(ctx context.Context) (http.Handler, error) {
	clientV2, clientV3, err := b.client(ctx, b.plugin.JSONData.ID)
	if err != nil {
		return nil, err
	}

	cfg := b.deps.Cfg
	if cfg == nil {
		cfg = setting.NewCfg()
	}
	apiserverSection := cfg.SectionWithEnvOverrides(searchapi.ConfigSection)
	opts := pluginroute.Options{
		Storage:         pluginroute.UnifiedStorage(b.deps.Unified, b.deps.SecureValues, b.deps.RESTConfigProvider),
		PluginClient:    clientV2,
		ClientV3:        clientV3,
		ContextProvider: b.deps.ContextProvider,
		Decrypter:       b.deps.Decrypter,
		Search:          b.deps.Unified,
		Store:           b.deps.Unified,
		Runner: appplugin.AppPluginRunnerOptions{
			RegisterProxy:            openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagApppluginsHandleProxyRequests, false, openfeature.TransactionContext(ctx)),
			AccessControl:            b.deps.AccessControl,
			DataProxyLogging:         cfg.DataProxyLogging,
			SendUserHeader:           cfg.SendUserHeader,
			PluginsAppsSkipVerifyTLS: cfg.PluginsAppsSkipVerifyTLS,
			SearchAPIEnabled:         apiserverSection.Key(searchapi.ConfigKey).MustBool(true),
			TrashAPIEnabled:          apiserverSection.Key(searchapi.ConfigKeyTrash).MustBool(true),
			KeysAPIEnabled:           apiserverSection.Key(keysapi.ConfigKey).MustBool(false),
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
