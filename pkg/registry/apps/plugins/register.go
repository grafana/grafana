package plugins

import (
	"context"
	"fmt"
	"os"

	"github.com/grafana/grafana-app-sdk/k8s"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	restclient "k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"

	pluginsappapis "github.com/grafana/grafana/apps/plugins/pkg/apis"
	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	pluginsapp "github.com/grafana/grafana/apps/plugins/pkg/app"
	"github.com/grafana/grafana/apps/plugins/pkg/app/meta"
	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

var (
	_ appsdkapiserver.AppInstaller    = (*AppInstaller)(nil)
	_ appinstaller.AuthorizerProvider = (*AppInstaller)(nil)
)

type AppInstaller struct {
	metaManager        *meta.ProviderManager
	cfgProvider        configprovider.ConfigProvider
	restConfigProvider apiserver.RestConfigProvider

	appsdkapiserver.AppInstaller
}

func RegisterAppInstaller(
	cfgProvider configprovider.ConfigProvider,
	restConfigProvider apiserver.RestConfigProvider,
) (*AppInstaller, error) {
	grafanaComAPIURL := os.Getenv("GRAFANA_COM_API_URL")
	if grafanaComAPIURL == "" {
		grafanaComAPIURL = "https://grafana.com/api/plugins"
	}

	coreProvider := meta.NewCoreProvider()
	cloudProvider := meta.NewCloudProvider(grafanaComAPIURL)
	metaProviderManager := meta.NewProviderManager(coreProvider, cloudProvider)
	specificConfig := &pluginsapp.PluginAppConfig{
		MetaProviderManager: metaProviderManager,
	}
	provider := simple.NewAppProvider(pluginsappapis.LocalManifest(), specificConfig, pluginsapp.New)
	appConfig := app.Config{
		KubeConfig:     restclient.Config{}, // this will be overridden by the installer's InitializeApp method
		ManifestData:   *pluginsappapis.LocalManifest().ManifestData,
		SpecificConfig: specificConfig,
	}
	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, pluginsappapis.NewGoTypeAssociator())
	if err != nil {
		return nil, err
	}

	return &AppInstaller{
		metaManager:        metaProviderManager,
		cfgProvider:        cfgProvider,
		restConfigProvider: restConfigProvider,
		AppInstaller:       i,
	}, nil
}

func (p *AppInstaller) InstallAPIs(
	server appsdkapiserver.GenericAPIServer,
	restOptsGetter generic.RESTOptionsGetter,
) error {
	ctx := context.Background()
	cfg, err := p.cfgProvider.Get(ctx)
	if err != nil {
		return err
	}

	// Create a client factory function that will be called lazily when the client is needed.
	// This avoids deadlock issues since the restConfigProvider/API server will not be ready during API installation.
	clientFactory := func(ctx context.Context) (*pluginsv0alpha1.PluginClient, error) {
		kubeConfig, err := p.restConfigProvider.GetRestConfig(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to get rest config: %w", err)
		}

		clientGenerator := k8s.NewClientRegistry(*kubeConfig, k8s.DefaultClientConfig())
		client, err := pluginsv0alpha1.NewPluginClientFromGenerator(clientGenerator)
		if err != nil {
			return nil, fmt.Errorf("failed to create plugin client: %w", err)
		}

		return client, nil
	}

	pluginMetaGVR := pluginsv0alpha1.PluginMetaKind().GroupVersionResource()
	replacedStorage := map[schema.GroupVersionResource]rest.Storage{
		pluginMetaGVR: pluginsapp.NewPluginMetaStorage(p.metaManager, clientFactory, request.GetNamespaceMapper(cfg)),
	}
	wrappedServer := &customStorageWrapper{
		wrapped: server,
		replace: replacedStorage,
	}
	return p.AppInstaller.InstallAPIs(wrappedServer, restOptsGetter)
}

// GetAuthorizer returns the authorizer for the plugins app.
func (p *AppInstaller) GetAuthorizer() authorizer.Authorizer {
	return pluginsapp.GetAuthorizer()
}
