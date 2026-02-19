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
	apppluginv0alpha1 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginassets"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/updatemanager"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ builder.APIGroupBuilder         = (*AppPluginAPIBuilder)(nil)
	_ builder.APIGroupVersionProvider = (*AppPluginAPIBuilder)(nil)
)

const VERSION = "v0alpha1"

// AppPluginAPIBuilder builds an apiserver for a single app plugin.
type AppPluginAPIBuilder struct {
	pluginID             string
	groupVersion         schema.GroupVersion
	pluginStore          pluginstore.Store
	pluginSettings       pluginsettings.Service
	pluginsUpdateChecker *updatemanager.PluginsService
	pluginAssets         *pluginassets.Service
	cfg                  *setting.Cfg
	accessControl        ac.AccessControl
}

// NewAppPluginAPIBuilder creates a single AppPluginAPIBuilder for the given plugin ID.
// This is used by the standalone factory (factory.go) where plugin discovery isn't available.
func NewAppPluginAPIBuilder(
	pluginID string,
	pluginStore pluginstore.Store,
	pluginSettings pluginsettings.Service,
	pluginsUpdateChecker *updatemanager.PluginsService,
	pluginAssets *pluginassets.Service,
	cfg *setting.Cfg,
	accessControl ac.AccessControl,
) *AppPluginAPIBuilder {
	groupName := pluginID + ".app.grafana.app"
	return &AppPluginAPIBuilder{
		pluginID: pluginID,
		groupVersion: schema.GroupVersion{
			Group:   groupName,
			Version: VERSION,
		},
		pluginStore:          pluginStore,
		pluginSettings:       pluginSettings,
		pluginsUpdateChecker: pluginsUpdateChecker,
		pluginAssets:         pluginAssets,
		cfg:                  cfg,
		accessControl:        accessControl,
	}
}

func RegisterAPIService(
	apiRegistrar builder.APIRegistrar,
	pluginSources sources.Registry,
	pluginStore pluginstore.Store,
	pluginSettings pluginsettings.Service,
	pluginsUpdateChecker *updatemanager.PluginsService,
	pluginAssets *pluginassets.Service,
	cfg *setting.Cfg,
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
		groupName := pluginJSON.ID + ".app.grafana.app"
		b := &AppPluginAPIBuilder{
			pluginID: pluginJSON.ID,
			groupVersion: schema.GroupVersion{
				Group:   groupName,
				Version: VERSION,
			},
			pluginStore:          pluginStore,
			pluginSettings:       pluginSettings,
			pluginsUpdateChecker: pluginsUpdateChecker,
			pluginAssets:         pluginAssets,
			cfg:                  cfg,
			accessControl:        accessControl,
		}
		apiRegistrar.RegisterAPI(b)
		last = b
	}
	return last, nil // only used for wire
}

// getAppPlugins discovers all installed backend app plugins.
func getAppPlugins(ctx context.Context, pluginSources sources.Registry) ([]plugins.JSONData, error) {
	var pluginJSONs []plugins.JSONData
	uniquePlugins := map[string]bool{}

	for _, pluginSource := range pluginSources.List(ctx) {
		res, err := pluginSource.Discover(ctx)
		if err != nil {
			return nil, err
		}
		for _, p := range res {
			if !p.Primary.JSONData.Backend || p.Primary.JSONData.Type != plugins.TypeApp {
				continue
			}

			if _, found := uniquePlugins[p.Primary.JSONData.ID]; found {
				backend.Logger.Info("Found duplicate app plugin %s when registering API groups.", p.Primary.JSONData.ID)
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
	storage := map[string]rest.Storage{}
	storage["settings"] = &settingsStorage{
		pluginID:             b.pluginID,
		pluginStore:          b.pluginStore,
		pluginSettings:       b.pluginSettings,
		pluginsUpdateChecker: b.pluginsUpdateChecker,
		pluginAssets:         b.pluginAssets,
		cfg:                  b.cfg,
		resource:             b.groupVersion.WithResource("settings").GroupResource(),
	}
	apiGroupInfo.VersionedResourcesStorageMap[b.groupVersion.Version] = storage
	return nil
}

func (b *AppPluginAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return apppluginv0alpha1.GetOpenAPIDefinitions
}

func (b *AppPluginAPIBuilder) AllowedV0Alpha1Resources() []string {
	return []string{builder.AllResourcesAllowed}
}
