package plugins

import (
	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	restclient "k8s.io/client-go/rest"

	"github.com/grafana/grafana/apps/plugins/pkg/apis"
	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	pluginsapp "github.com/grafana/grafana/apps/plugins/pkg/app"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ appsdkapiserver.AppInstaller    = (*PluginsAppInstaller)(nil)
	_ appinstaller.AuthorizerProvider = (*PluginsAppInstaller)(nil)
	_ appinstaller.OptionsProvider    = (*PluginsAppInstaller)(nil)
)

type PluginsAppInstaller struct {
	appsdkapiserver.AppInstaller
	namespaceMapper request.NamespaceMapper
	pluginRegistry  pluginsapp.PluginRegistry
	pluginConfig    *pluginsapp.Config
	pluginOptions   *pluginsapp.Options
}

func RegisterAppInstaller(
	cfg *setting.Cfg,
	inMemoryRegistry *registry.InMemoryAdapter,
) (*PluginsAppInstaller, error) {
	installer := &PluginsAppInstaller{
		namespaceMapper: request.GetNamespaceMapper(cfg),
		pluginRegistry:  inMemoryRegistry,
		pluginOptions:   pluginsapp.NewOptions(),
	}
	installer.pluginConfig = &pluginsapp.Config{}
	provider := simple.NewAppProvider(apis.LocalManifest(), installer.pluginConfig, pluginsapp.New)
	appConfig := app.Config{
		KubeConfig:     restclient.Config{}, // this will be overridden by the installer's InitializeApp method
		ManifestData:   *apis.LocalManifest().ManifestData,
		SpecificConfig: installer.pluginConfig,
	}
	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, apis.ManifestGoTypeAssociator, apis.ManifestCustomRouteResponsesAssociator)
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

	pluginConfig := p.GetConfig()
	if pluginConfig.InMemoryRegistry != nil {
		pluginInstallGVR := schema.GroupVersionResource{
			Group:    pluginsv0alpha1.GroupVersion.Group,
			Version:  pluginsv0alpha1.GroupVersion.Version,
			Resource: pluginsv0alpha1.PluginInstallKind().Plural(),
		}
		registryAdapter := p.pluginConfig.InMemoryRegistry
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

// ApplyGrafanaConfig applies the grafana config to the plugins app.
func (p *PluginsAppInstaller) ApplyGrafanaConfig(cfg *setting.Cfg) error {
	section := cfg.Raw.Section("plugins")
	installSource := section.Key("install_source").MustString(p.pluginOptions.InstallSource.String())
	if err := p.pluginOptions.InstallSource.Set(installSource); err != nil {
		return err
	}
	return nil
}

// GetConfig returns the config for the plugins app.
func (p *PluginsAppInstaller) GetConfig() *pluginsapp.Config {
	if p.pluginOptions.InstallSource == pluginsapp.InstallSourceTypeDisk {
		p.pluginConfig.InMemoryRegistry = p.pluginRegistry
	}
	return p.pluginConfig
}
