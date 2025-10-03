package plugins

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	restclient "k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/plugins/pkg/apis"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/setting"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	pluginsapp "github.com/grafana/grafana/apps/plugins/pkg/app"
	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
)

var (
	_ appsdkapiserver.AppInstaller    = (*PluginsAppInstaller)(nil)
	_ appinstaller.AuthorizerProvider = (*PluginsAppInstaller)(nil)
	_ appinstaller.OptionsProvider    = (*PluginsAppInstaller)(nil)
)

type PluginsAppInstaller struct {
	appsdkapiserver.AppInstaller
	namespaceMapper request.NamespaceMapper
	pluginRegistry  *registry.InMemoryAdapter
	pluginConfig    *pluginsapp.Config
	pluginOptions   *pluginsapp.Options
}

func RegisterAppInstaller(
	cfgProvider configprovider.ConfigProvider,
	inMemoryRegistry *registry.InMemoryAdapter,
) (*PluginsAppInstaller, error) {
	cfg, err := cfgProvider.Get(context.Background())
	if err != nil {
		return nil, err
	}
	installer := &PluginsAppInstaller{
		namespaceMapper: request.GetNamespaceMapper(cfg),
		pluginRegistry:  inMemoryRegistry,
		pluginOptions:   pluginsapp.NewOptions(),
		pluginConfig:    &pluginsapp.Config{},
	}
	provider := simple.NewAppProvider(apis.LocalManifest(), installer.pluginConfig, pluginsapp.New)
	appConfig := app.Config{
		KubeConfig:     restclient.Config{}, // this will be overridden by the installer's InitializeApp method
		ManifestData:   *apis.LocalManifest().ManifestData,
		SpecificConfig: installer.GetSpecificConfig(),
	}
	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, &apis.GoTypeAssociator{})
	if err != nil {
		return nil, err
	}
	installer.AppInstaller = i
	return installer, nil
}

func (p *PluginsAppInstaller) InstallAPIs(
	server appsdkapiserver.GenericAPIServer,
	restOptsGetter generic.RESTOptionsGetter,
) error {
	pluginMetaGVR := schema.GroupVersionResource{
		Group:    pluginsv0alpha1.GroupVersion.Group,
		Version:  pluginsv0alpha1.GroupVersion.Version,
		Resource: pluginsv0alpha1.PluginMetaKind().Plural(),
	}

	replacedStorage := map[schema.GroupVersionResource]rest.Storage{
		pluginMetaGVR: pluginsapp.NewPluginMetaStorage(p.namespaceMapper),
	}

	if p.pluginConfig.InstallSource == pluginsapp.InstallSourceTypeDisk {
		pluginInstallGVR := schema.GroupVersionResource{
			Group:    pluginsv0alpha1.GroupVersion.Group,
			Version:  pluginsv0alpha1.GroupVersion.Version,
			Resource: pluginsv0alpha1.PluginInstallKind().Plural(),
		}
		registryAdapter := p.pluginRegistry
		replacedStorage[pluginInstallGVR] = pluginsapp.NewPluginInstallStorage(p.namespaceMapper, registryAdapter)
	}

	wrappedServer := &customStorageWrapper{
		wrapped: server,
		replace: replacedStorage,
	}
	return p.AppInstaller.InstallAPIs(wrappedServer, restOptsGetter)
}

// GetAuthorizer returns the authorizer for the plugins app.
func (p *PluginsAppInstaller) GetAuthorizer() authorizer.Authorizer {
	return pluginsapp.GetAuthorizer()
}

// GetOptions returns the options for the plugins app.
func (p *PluginsAppInstaller) GetOptions() appinstaller.Options {
	return p.pluginOptions
}

// ApplyGrafanaConfig applies the grafana config to the plugins app options.
func (p *PluginsAppInstaller) ApplyGrafanaConfig(cfg *setting.Cfg) error {
	section := cfg.Raw.Section("plugins")
	installSource := section.Key("install_source").MustString(p.pluginOptions.InstallSource.String())
	if err := p.pluginOptions.InstallSource.Set(installSource); err != nil {
		return err
	}
	return nil
}

func (p *PluginsAppInstaller) GetSpecificConfig() any {
	return p.pluginConfig
}
