package appplugin

import (
	"context"
	"fmt"
	"strings"

	"github.com/open-feature/go-sdk/openfeature"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/pluginschema"
	"github.com/grafana/grafana/apps/secret/pkg/decrypt"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/definition"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

var (
	_ builder.APIGroupBuilder          = (*AppPluginAPIBuilder)(nil)
	_ builder.APIGroupVersionsProvider = (*AppPluginAPIBuilder)(nil)
)

// Direct access to read objects directly from storage.
type getter = func(ctx context.Context, gvr schema.GroupVersionResource, name string) (runtime.Object, error)

// PluginClient is a subset of the plugins.Client interface with only the
// functions supported by the app plugins
type PluginClient interface {
	backend.CheckHealthHandler
	backend.CallResourceHandler
}

// PluginContext requires adding system settings (feature flags, etc) to the datasource config
type PluginContextWrapper interface {
	// Get the plugin context for an app plugin request
	PluginContextForApp(ctx context.Context, pluginID string, appSettings *backend.AppInstanceSettings) (context.Context, backend.PluginContext, error)
}

type AppPluginRunnerOptions struct {
	RegisterProxy bool

	DataProxyLogging         bool // from cfg
	SendUserHeader           bool // from cfg
	PluginsAppsSkipVerifyTLS bool // from cfg

	// When this exists, dual write settings will be used
	LegacyStore grafanarest.Storage

	// Direct access to legacy access control (required for proxy)
	AccessControl ac.AccessControl
}

// AppPluginAPIBuilder serves app settings and their v2 health, resource and proxy endpoints.
type AppPluginAPIBuilder struct {
	// the API group -- the group defined in manifest data or the pluginID
	group           string
	pluginJSON      plugins.JSONData
	client          PluginClient // will only ever be called with the same plugin id!
	contextProvider PluginContextWrapper
	schemas         map[string]*pluginschema.PluginSchema
	decrypter       decrypt.DecryptService
	accessChecker   PluginAccessChecker
	features        featuremgmt.FeatureToggles
	tracer          tracing.Tracer

	// optional configuration
	opts AppPluginRunnerOptions

	// Get values from storage
	getter getter
}

func NewAppPluginAPIBuilder(
	plugin definition.PluginDefinition,
	client PluginClient, // will only ever be called with the same plugin id!
	contextProvider PluginContextWrapper,
	decrypter decrypt.DecryptService, // when not reading legacy
	accessChecker PluginAccessChecker,
	opts AppPluginRunnerOptions, // can change without updating wire :)
	tracer tracing.Tracer, // needed for proxy
	features featuremgmt.FeatureToggles, // needed for proxy
) (*AppPluginAPIBuilder, error) {
	return &AppPluginAPIBuilder{
		group:           apiGroupForPlugin(plugin),
		pluginJSON:      plugin.JSONData,
		client:          client,
		contextProvider: contextProvider,
		schemas:         plugin.Schemas,
		decrypter:       decrypter,
		accessChecker:   accessChecker,
		opts:            opts,
		features:        features,
		tracer:          tracer,
	}, nil
}

// Called in ST Grafana to register
func RegisterAPIService(
	apiRegistrar builder.APIRegistrar,
	pluginClient plugins.Client, // access to everything
	contextProvider PluginContextWrapper,
	pluginSources sources.Registry,
	pluginSettings pluginsettings.Service,
	acService ac.Service, // Required to declare roles from a manifest
	accessControl ac.AccessControl,
	decrypter decrypt.DecryptService,
	tracer tracing.Tracer, // needed for proxy
	features featuremgmt.FeatureToggles, // needed for proxy
	cfg *setting.Cfg,
) (*AppPluginAPIBuilder, error) {
	ctx := context.Background()
	getflag := func(f string) bool {
		return openfeature.NewDefaultClient().Boolean(ctx, f, false, openfeature.TransactionContext(ctx))
	}
	routed := getflag(featuremgmt.FlagGrafanaUseRouterMiddleware)
	if !routed && !getflag(featuremgmt.FlagApppluginsRegisterAPIServer) {
		return nil, nil
	}

	// Find all local plugins
	pluginDefs, err := definition.LoadPluginDefinition(ctx, pluginSources, definition.Options{
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
		Schemas: true,
		// Manifest plugins are served exclusively by the router.
		AppManifest: true,
	})

	if err != nil {
		return nil, fmt.Errorf("error getting list of app plugins: %w", err)
	}

	var last *AppPluginAPIBuilder
	for _, plugin := range pluginDefs {
		if err := declareManifestRoles(acService, apiGroupForPlugin(plugin), plugin.JSONData.Name, plugin.Manifest); err != nil {
			return nil, fmt.Errorf("error declaring roles for %s: %w", plugin.JSONData.ID, err)
		}
		if plugin.Manifest != nil && !routed {
			continue
		}
		b, err := NewAppPluginAPIBuilder(plugin,
			pluginClient, // scoped to a single plugin!
			contextProvider,
			decrypter,
			NewPluginAccessChecker(accessControl),
			AppPluginRunnerOptions{
				RegisterProxy: getflag(featuremgmt.FlagApppluginsHandleProxyRequests),
				LegacyStore:   NewLegacySettingsStore(apiGroupForPlugin(plugin), plugin.JSONData.ID, pluginSettings),
				AccessControl: accessControl,

				DataProxyLogging:         cfg.DataProxyLogging,
				SendUserHeader:           cfg.SendUserHeader,
				PluginsAppsSkipVerifyTLS: cfg.PluginsAppsSkipVerifyTLS,
			},
			tracer,
			features,
		)
		if err != nil {
			return nil, err
		}

		// Routed plugins still need their roles declared before startup registers them.
		if routed {
			// The handler copies storage options; resolve defaults here so the shared
			// dual-write service observes them before requests start using the config.
			b.applyDefaultStorageConfig(builder.APIGroupOptions{
				StorageOpts: &options.StorageOptions{UnifiedStorageConfig: cfg.UnifiedStorage},
			}, apppluginV0.SettingsResourceInfo.WithGroupAndShortName(b.group, plugin.JSONData.ID))
			continue
		}

		apiRegistrar.RegisterAPI(b)
		last = b
	}
	return last, nil
}

// apiGroupForPlugin returns the API group the plugin is served under: the group
// declared in the manifest when it has one, otherwise the plugin id.
func apiGroupForPlugin(plugin definition.PluginDefinition) string {
	if plugin.Manifest != nil {
		group := plugin.Manifest.Group

		// Unified storage only always-enforces RBAC on groups ending in
		// .ext.grafana.app (alwaysEnforced in pkg/storage/unified/resource), so
		// a group with any other suffix serves the plugin's kinds with no access
		// check at all in the default configuration.
		if !strings.HasSuffix(group, ".ext.grafana.app") {
			panic(fmt.Sprintf("invalid manifest group %q for plugin %s: must end with .ext.grafana.app (otherwise RBAC never runs)", group, plugin.JSONData.ID))
		}
		return group
	}
	return plugin.JSONData.ID
}

// GetGroupVersions returns the settings API version.
func (b *AppPluginAPIBuilder) GetGroupVersions() []schema.GroupVersion {
	return []schema.GroupVersion{{Group: b.group, Version: apppluginV0.VERSION}}
}

func (b *AppPluginAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	gv := b.GetGroupVersions()[0]
	if err := apppluginV0.AddKnownTypes(scheme, gv); err != nil {
		return err
	}
	return scheme.SetVersionPriority(gv)
}

func (b *AppPluginAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	registerSubresourceMetrics(opts.MetricsRegister)

	settingsRI := apppluginV0.SettingsResourceInfo.WithGroupAndShortName(
		b.group, b.pluginJSON.ID,
	)

	if opts.OptsGetter == nil {
		return fmt.Errorf("apps require a storage options getter")
	}

	var settingsStorage rest.Storage
	if b.includeSettings() {
		b.applyDefaultStorageConfig(opts, settingsRI)

		// Share one settings store across all versions.
		unified, err := grafanaregistry.NewRegistryStore(opts.Scheme, settingsRI,
			opts.StorageOptsGetterFor(settingsRI, apistore.StorageOptions{EnableFolderSupport: false}))
		if err != nil {
			return err
		}
		settingsStorage = unified
		if b.opts.LegacyStore != nil && opts.DualWriteBuilder != nil {
			settingsStorage, err = opts.DualWriteBuilder(settingsRI.GroupResource(), b.opts.LegacyStore, unified)
			if err != nil {
				return err
			}
		}
	}

	for _, gv := range b.GetGroupVersions() {
		storage := map[string]rest.Storage{}

		if b.includeSettings() {
			storage[settingsRI.StoragePath()] = settingsStorage

			provider := func(ctx context.Context) (context.Context, backend.PluginContext, error) {
				version := gv.Version
				if info, ok := request.RequestInfoFrom(ctx); ok && info.APIVersion != "" {
					version = info.APIVersion
				}
				return b.getPluginContext(ctx, version)
			}

			storage[settingsRI.StoragePath("health")] = &subHealthREST{
				client:          b.client,
				contextProvider: provider,
			}
			storage[settingsRI.StoragePath("resources")] = &subResourceREST{
				pluginID:        b.pluginJSON.ID,
				client:          b.client,
				contextProvider: provider,
			}
			if len(b.pluginJSON.Routes) > 0 && b.opts.RegisterProxy {
				storage[settingsRI.StoragePath("proxy")] = newProxy(b)
			}
		}

		if len(storage) > 0 {
			apiGroupInfo.VersionedResourcesStorageMap[gv.Version] = storage
		}
	}

	// Direct reads of this plugin's own storage, by group version resource.
	b.getter = func(ctx context.Context, gvr schema.GroupVersionResource, name string) (runtime.Object, error) {
		if gvr.Resource == apppluginV0.APP_RESOURCE_NAME && settingsStorage != nil {
			return settingsStorage.(rest.Getter).Get(ctx, name, &v1.GetOptions{})
		}

		return nil, apierrors.NewInternalError(fmt.Errorf("no storage registered for %s", gvr))
	}
	return nil
}

// appPluginSettingsWildcard is a config key that applies to all app plugin settings
// resources when no plugin-specific override exists. Configure it as:
//
//	[unified_storage.app.*-app]
//	dualWriterMode = 1 // or 5
const appPluginSettingsWildcard = "app.*-app"

// applyDefaultStorageConfig injects a wildcard unified storage config entry for this
// plugin's settings resource if no plugin-specific config exists. This allows operators
// to set a single DualWriter mode for all app plugins at once.
func (b *AppPluginAPIBuilder) applyDefaultStorageConfig(opts builder.APIGroupOptions, ri utils.ResourceInfo) {
	if opts.StorageOpts == nil {
		return
	}
	key := ri.GroupResource().String()
	if _, exists := opts.StorageOpts.UnifiedStorageConfig[key]; exists {
		return
	}
	fallback, hasFallback := opts.StorageOpts.UnifiedStorageConfig[appPluginSettingsWildcard]
	if !hasFallback {
		return
	}
	opts.StorageOpts.UnifiedStorageConfig[key] = setting.UnifiedStorageConfig{
		DualWriterMode: fallback.DualWriterMode,
	}
}

func (b *AppPluginAPIBuilder) AllowedV0Alpha1Resources() []string {
	return []string{builder.AllResourcesAllowed}
}
