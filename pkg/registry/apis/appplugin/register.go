package appplugin

import (
	"context"
	"fmt"
	"strings"

	"github.com/open-feature/go-sdk/openfeature"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/pluginschema"
	"github.com/grafana/grafana/apps/secret/pkg/decrypt"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
	pluginspec "github.com/grafana/grafana/pkg/plugins/openapi"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

var (
	_ builder.APIGroupBuilder         = (*AppPluginAPIBuilder)(nil)
	_ builder.APIGroupVersionProvider = (*AppPluginAPIBuilder)(nil)
)

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

	// When this exists, dual write settings will be used
	LegacyStore grafanarest.Storage
}

// AppPluginAPIBuilder builds an apiserver for a single app plugin.
type AppPluginAPIBuilder struct {
	pluginJSON      plugins.JSONData
	groupVersion    schema.GroupVersion
	client          PluginClient // will only ever be called with the same plugin id!
	contextProvider PluginContextWrapper
	schemas         map[string]*pluginschema.PluginSchema
	decrypter       decrypt.DecryptService // Used with unified storage
	accessControl   PluginAccessChecker

	// optional configuration
	opts AppPluginRunnerOptions

	// Populated in UpdateAPIGroupInfo
	getter rest.Getter
}

func NewAppPluginAPIBuilder(
	plugin pluginspec.PluginInfo,
	apiVersion string,
	client PluginClient, // will only ever be called with the same plugin id!
	contextProvider PluginContextWrapper,
	decrypter decrypt.DecryptService, // when not reading legacy
	accessControl PluginAccessChecker,
	opts AppPluginRunnerOptions, // can change without updating wire :)
) (*AppPluginAPIBuilder, error) {
	return &AppPluginAPIBuilder{
		pluginJSON: plugin.JSONData,
		groupVersion: schema.GroupVersion{
			Group:   plugin.JSONData.ID,
			Version: apiVersion,
		},
		client:          client,
		contextProvider: contextProvider,
		schemas:         plugin.Schemas,
		decrypter:       decrypter,
		accessControl:   accessControl,
		opts:            opts,
	}, nil
}

// Called in ST Grafana to register
func RegisterAPIService(
	apiRegistrar builder.APIRegistrar,
	pluginClient plugins.Client, // access to everything
	contextProvider PluginContextWrapper,
	pluginSources sources.Registry,
	pluginSettings pluginsettings.Service,
	accessControl ac.AccessControl,
	decrypter decrypt.DecryptService,
) (*AppPluginAPIBuilder, error) {
	ctx := context.Background()
	if !openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagApppluginsRegisterAPIServer, false, openfeature.TransactionContext(ctx)) {
		return nil, nil
	}
	registerProxy := openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagApppluginsHandleProxyRequests, false, openfeature.TransactionContext(ctx))

	// Find all local plugins
	pluginInfos, err := pluginspec.LoadPlugins(ctx, pluginSources,
		func(jsonData plugins.JSONData) bool {
			if jsonData.Type == plugins.TypeApp {
				// Enforce that the plugin ID ends with -app so it is OK to live as a root api group
				// Alternatively, we could fail or append -app to the name
				if strings.HasSuffix(jsonData.ID, "-app") {
					backend.Logger.Warn("app plugin with invalid suffix: %s", jsonData.ID)
				}
				return true
			}
			return false
		}, true)

	if err != nil {
		return nil, fmt.Errorf("error getting list of datasource plugins: %s", err)
	}

	var last *AppPluginAPIBuilder
	for _, plugin := range pluginInfos {
		b, err := NewAppPluginAPIBuilder(plugin,
			apppluginV0.VERSION, // v0alpha1
			pluginClient,        // scoped to a single plugin!
			contextProvider,
			decrypter,
			NewPluginAccessChecker(accessControl),
			AppPluginRunnerOptions{
				RegisterProxy: registerProxy, // FROM feature toggles
				LegacyStore:   NewLegacySettingsStore(plugin.JSONData.ID, pluginSettings),
			},
		)
		if err != nil {
			return nil, err
		}
		apiRegistrar.RegisterAPI(b)
		last = b
	}
	return last, nil
}

func (b *AppPluginAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return b.groupVersion
}

func (b *AppPluginAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	if err := apppluginV0.AddKnownTypes(scheme, b.groupVersion); err != nil {
		return err
	}
	return scheme.SetVersionPriority(b.groupVersion)
}

func (b *AppPluginAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	registerSubresourceMetrics(opts.MetricsRegister)

	settingsRI := apppluginV0.SettingsResourceInfo.WithGroupAndShortName(
		b.groupVersion.Group, b.pluginJSON.ID,
	)

	if opts.StorageOptsRegister != nil {
		opts.StorageOptsRegister(settingsRI.GroupResource(), apistore.StorageOptions{
			EnableFolderSupport: false,
			Scheme:              opts.Scheme,
		})
	}

	b.applyDefaultStorageConfig(opts, settingsRI)

	storage := map[string]rest.Storage{}

	unified, err := grafanaregistry.NewRegistryStore(opts.Scheme, settingsRI, opts.OptsGetter)
	if err != nil {
		return err
	}
	storage[settingsRI.StoragePath()] = unified
	if b.opts.LegacyStore != nil && opts.DualWriteBuilder != nil {
		store, err := opts.DualWriteBuilder(settingsRI.GroupResource(), b.opts.LegacyStore, unified)
		if err != nil {
			return err
		}
		storage[settingsRI.StoragePath()] = store
	}

	storage[settingsRI.StoragePath("health")] = &subHealthREST{
		client:          b.client,
		contextProvider: b.getPluginContext,
	}
	storage[settingsRI.StoragePath("resources")] = &subResourceREST{
		pluginID:        b.pluginJSON.ID,
		client:          b.client,
		contextProvider: b.getPluginContext,
	}
	if len(b.pluginJSON.Routes) > 0 && b.opts.RegisterProxy {
		storage[settingsRI.StoragePath("proxy")] = newProxy(b)
	}

	b.getter = storage[settingsRI.StoragePath()].(rest.Getter)
	apiGroupInfo.VersionedResourcesStorageMap[b.groupVersion.Version] = storage
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
