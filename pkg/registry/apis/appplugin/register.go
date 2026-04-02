package appplugin

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"

	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	apppluginv0alpha1 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
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

// AppPluginAPIBuilder builds an apiserver for a single app plugin.
type AppPluginAPIBuilder struct {
	pluginID       string
	groupVersion   schema.GroupVersion
	pluginSettings pluginsettings.Service
	accessControl  ac.AccessControl
}

func RegisterAPIService(
	apiRegistrar builder.APIRegistrar,
	pluginSources sources.Registry,
	pluginSettings pluginsettings.Service,
	accessControl ac.AccessControl,
) (*AppPluginAPIBuilder, error) {
	ctx := context.Background()
	if !openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagAppPluginAPIServer, false, openfeature.TransactionContext(ctx)) {
		return nil, nil
	}

	pluginJSONs, err := getAppPlugins(ctx, pluginSources)
	if err != nil {
		return nil, fmt.Errorf("error getting list of app plugins: %w", err)
	}

	var last *AppPluginAPIBuilder
	for _, pluginJSON := range pluginJSONs {
		groupName := pluginJSON.ID + ".grafana.app"
		b := &AppPluginAPIBuilder{
			pluginID: pluginJSON.ID,
			groupVersion: schema.GroupVersion{
				Group:   groupName,
				Version: apppluginv0alpha1.VERSION,
			},
			pluginSettings: pluginSettings,
			accessControl:  accessControl,
		}
		apiRegistrar.RegisterAPI(b)
		last = b
	}
	return last, nil
}

// getAppPlugins discovers all installed app plugins.
func getAppPlugins(ctx context.Context, pluginSources sources.Registry) ([]plugins.JSONData, error) {
	var pluginJSONs []plugins.JSONData
	uniquePlugins := map[string]bool{}

	for _, pluginSource := range pluginSources.List(ctx) {
		res, err := pluginSource.Discover(ctx)
		if err != nil {
			return nil, err
		}
		for _, p := range res {
			if p.Primary.JSONData.Type != plugins.TypeApp {
				continue
			}

			if _, found := uniquePlugins[p.Primary.JSONData.ID]; found {
				backend.Logger.Debug("Found duplicate app plugin %s when registering API groups.", p.Primary.JSONData.ID)
				continue
			}

			uniquePlugins[p.Primary.JSONData.ID] = true
			pluginJSONs = append(pluginJSONs, p.Primary.JSONData)
		}
	}
	return pluginJSONs, nil
}

func (b *AppPluginAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return b.groupVersion
}

func (b *AppPluginAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	if err := apppluginv0alpha1.AddKnownTypes(scheme, b.groupVersion); err != nil {
		return err
	}
	return scheme.SetVersionPriority(b.groupVersion)
}

func (b *AppPluginAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	settingsRI := apppluginv0alpha1.SettingsResourceInfo.WithGroupAndShortName(
		b.groupVersion.Group, b.pluginID,
	)

	if opts.StorageOptsRegister != nil {
		opts.StorageOptsRegister(settingsRI.GroupResource(), apistore.StorageOptions{
			EnableFolderSupport: false,
			Scheme:              opts.Scheme,
		})
	}

	b.applyDefaultStorageConfig(opts, settingsRI)

	storage := map[string]rest.Storage{}

	if opts.DualWriteBuilder != nil {
		legacyStore := &settingsStorage{
			pluginID:       b.pluginID,
			pluginSettings: b.pluginSettings,
			resourceInfo:   &settingsRI,
		}
		unified, err := grafanaregistry.NewRegistryStore(opts.Scheme, settingsRI, opts.OptsGetter)
		if err != nil {
			return err
		}
		storage[settingsRI.StoragePath()], err = opts.DualWriteBuilder(settingsRI.GroupResource(), legacyStore, unified)
		if err != nil {
			return err
		}
	} else {
		storage[settingsRI.StoragePath()] = &settingsStorage{
			pluginID:       b.pluginID,
			pluginSettings: b.pluginSettings,
			resourceInfo:   &settingsRI,
		}
	}

	apiGroupInfo.VersionedResourcesStorageMap[b.groupVersion.Version] = storage
	return nil
}

// appPluginSettingsWildcard is a config key that applies to all app plugin settings
// resources when no plugin-specific override exists. Configure it as:
//
//	[unified_storage.settings.*.grafana.app]
//	dualWriterMode = 2
const appPluginSettingsWildcard = "settings.*.grafana.app"

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

func (b *AppPluginAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return apppluginv0alpha1.GetOpenAPIDefinitions
}

func (b *AppPluginAPIBuilder) AllowedV0Alpha1Resources() []string {
	return []string{builder.AllResourcesAllowed}
}
