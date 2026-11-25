package appsettings

import (
	"context"
	"fmt"
	"sync"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"

	"github.com/grafana/grafana-app-sdk/app"
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
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

var (
	_ builder.APIGroupBuilder          = (*Builder)(nil)
	_ builder.APIGroupVersionsProvider = (*Builder)(nil)
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

type Options struct {
	RegisterProxy bool
	// ReadOnly disables settings writes and watches without changing storage selection.
	ReadOnly bool

	DataProxyLogging         bool // from cfg
	SendUserHeader           bool // from cfg
	PluginsAppsSkipVerifyTLS bool // from cfg

	// When this exists, dual write settings will be used
	LegacyStore grafanarest.Storage

	// Direct access to legacy access control, for settings writes and the proxy
	AccessControl ac.AccessControl
}

// Builder serves app settings and their v2 health, resource and proxy endpoints.
type Builder struct {
	// The settings API group is the plugin ID.
	group           string
	pluginJSON      plugins.JSONData
	settings        *app.ManifestData // declares the resources and proxy routes
	client          PluginClient      // will only ever be called with the same plugin id!
	contextProvider PluginContextWrapper
	schemas         map[string]*pluginschema.PluginSchema
	decrypter       decrypt.DecryptService
	authorizer      authorizer.Authorizer
	features        featuremgmt.FeatureToggles
	tracer          tracing.Tracer

	// optional configuration
	opts Options

	// Get values from storage
	getter getter

	secureValues secureValuesCache
	proxy        *proxyHandler

	routesOnce sync.Once
	routes     *settingsRoutes
}

func NewBuilder(
	plugin definition.PluginDefinition,
	client PluginClient, // will only ever be called with the same plugin id!
	contextProvider PluginContextWrapper,
	decrypter decrypt.DecryptService, // when not reading legacy
	accessChecker pluginaccesscontrol.AppAccessChecker,
	opts Options, // can change without updating wire :)
	tracer tracing.Tracer, // needed for proxy
	features featuremgmt.FeatureToggles, // needed for proxy
) (*Builder, error) {
	if client == nil || contextProvider == nil {
		return nil, fmt.Errorf("plugin %q: settings require a plugin client and context provider", plugin.JSONData.ID)
	}
	return &Builder{
		group:           plugin.JSONData.ID,
		pluginJSON:      plugin.JSONData,
		settings:        plugin.Settings,
		client:          client,
		contextProvider: contextProvider,
		schemas:         plugin.Schemas,
		decrypter:       decrypter,
		authorizer:      newSettingsAuthorizer(plugin.JSONData.ID, accessChecker, opts),
		opts:            opts,
		features:        features,
		tracer:          tracer,
	}, nil
}

// settingsRoutes returns the routes the settings manifest declares. When they
// cannot be compiled, none are served or published.
func (b *Builder) settingsRoutes() *settingsRoutes {
	b.routesOnce.Do(func() {
		routes, err := compileSettingsRoutes(b.settings)
		if err != nil {
			logger.Warn("plugin settings routes are not served", "plugin", b.group, "reason", err)
			routes = &settingsRoutes{}
		}
		b.routes = routes
	})
	return b.routes
}

// proxyRoutes returns the proxy routes the settings manifest declares, or nil
// when the proxy is not registered or there are none.
func (b *Builder) proxyRoutes() *proxyRoutes {
	if !b.opts.RegisterProxy {
		return nil
	}
	return b.settingsRoutes().proxy
}

// GetGroupVersions returns the settings API version.
func (b *Builder) GetGroupVersions() []schema.GroupVersion {
	return []schema.GroupVersion{{Group: b.group, Version: apppluginV0.VERSION}}
}

func (b *Builder) InstallSchema(scheme *runtime.Scheme) error {
	gv := b.GetGroupVersions()[0]
	if err := apppluginV0.AddKnownTypes(scheme, gv); err != nil {
		return err
	}
	return scheme.SetVersionPriority(gv)
}

func (b *Builder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	registerSubresourceMetrics(opts.MetricsRegister)
	settingsRI := apppluginV0.SettingsResourceInfo.WithGroupAndShortName(
		b.group, b.pluginJSON.ID,
	)

	if opts.OptsGetter == nil {
		return fmt.Errorf("apps require a storage options getter")
	}

	b.applyDefaultStorageConfig(opts, settingsRI)
	unified, err := grafanaregistry.NewRegistryStore(opts.Scheme, settingsRI,
		opts.StorageOptsGetterFor(settingsRI, apistore.StorageOptions{
			EnableFolderSupport: false,
			SharedStorage: &apistore.SharedStorage{
				Group: apppluginV0.GROUP,
				Name: &apistore.SharedName{
					Served: apppluginV0.INSTANCE_NAME,
					Stored: b.pluginJSON.ID,
				},
			},
		}))
	if err != nil {
		return err
	}
	var settingsStorage grafanarest.Storage = unified
	if b.opts.LegacyStore != nil && opts.DualWriteBuilder != nil {
		settingsStorage, err = opts.DualWriteBuilder(settingsRI.GroupResource(), b.opts.LegacyStore, unified)
		if err != nil {
			return err
		}
	}
	if b.opts.ReadOnly {
		return b.installSettingsStorage(apiGroupInfo, readOnlyStorage{settingsStorage})
	}

	// The subresources are served by SubresourceHandler.
	return b.installSettingsStorage(apiGroupInfo, settingsStorage)
}

func (b *Builder) installSettingsStorage(apiGroupInfo *genericapiserver.APIGroupInfo, settingsStorage rest.Storage) error {
	apiGroupInfo.VersionedResourcesStorageMap[apppluginV0.VERSION] = map[string]rest.Storage{
		apppluginV0.APP_RESOURCE_NAME: settingsStorage,
	}

	// Direct reads of this plugin's own storage, by group version resource.
	b.getter = func(ctx context.Context, gvr schema.GroupVersionResource, name string) (runtime.Object, error) {
		if gvr.Resource == apppluginV0.APP_RESOURCE_NAME {
			return settingsStorage.(rest.Getter).Get(ctx, name, &v1.GetOptions{})
		}

		return nil, apierrors.NewInternalError(fmt.Errorf("no storage registered for %s", gvr))
	}
	return nil
}

// applyDefaultStorageConfig injects a wildcard unified storage config entry for this
// plugin's settings resource if no plugin-specific config exists. This allows operators
// to set a single DualWriter mode for all app plugins at once.
func (b *Builder) applyDefaultStorageConfig(opts builder.APIGroupOptions, ri utils.ResourceInfo) {
	if opts.StorageOpts == nil {
		return
	}
	applyDefaultSettingsStorageConfig(opts.StorageOpts.UnifiedStorageConfig, ri)
}

// ApplyDefaultSettingsStorageConfig resolves the wildcard settings storage config
// for pluginID into cfg. The dual-write service reads the shared config map, so
// callers that install settings on a copy of it must resolve the default here first.
func ApplyDefaultSettingsStorageConfig(cfg map[string]setting.UnifiedStorageConfig, pluginID string) {
	applyDefaultSettingsStorageConfig(cfg, apppluginV0.SettingsResourceInfo.WithGroupAndShortName(pluginID, pluginID))
}

func applyDefaultSettingsStorageConfig(cfg map[string]setting.UnifiedStorageConfig, ri utils.ResourceInfo) {
	if cfg == nil {
		return
	}
	key := ri.GroupResource().String()
	if _, exists := cfg[key]; exists {
		return
	}
	fallback, hasFallback := cfg[setting.AppPluginSettingsWildcard]
	if !hasFallback {
		return
	}
	cfg[key] = setting.UnifiedStorageConfig{
		DualWriterMode: fallback.DualWriterMode,
	}
}

func (b *Builder) AllowedV0Alpha1Resources() []string {
	return []string{builder.AllResourcesAllowed}
}
