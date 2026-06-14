package app

import (
	"context"
	"fmt"
	"sync"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/k8s"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	restclient "k8s.io/client-go/rest"

	pluginsappapis "github.com/grafana/grafana/apps/plugins/pkg/apis"
	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/apps/plugins/pkg/app/meta"
)

func New(cfg app.Config) (app.App, error) {
	specificConfig, ok := cfg.SpecificConfig.(*PluginAppConfig)
	if !ok {
		return nil, fmt.Errorf("invalid config type")
	}

	metaKind := simple.AppManagedKind{
		Kind: pluginsv0alpha1.MetaKind(),
	}
	pluginKind := simple.AppManagedKind{
		Kind: pluginsv0alpha1.PluginKind(),
	}
	logger := logging.DefaultLogger.With("app", "plugins.app")

	simpleConfig := simple.AppConfig{
		Name:       "plugins",
		KubeConfig: cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{
			InformerOptions: operator.InformerOptions{
				ErrorHandler: func(ctx context.Context, err error) {
					logger.Error("Child plugin informer failed", "error", err)
				},
			},
		},
		ManagedKinds: []simple.AppManagedKind{metaKind, pluginKind},
	}

	a, err := simple.NewApp(simpleConfig)
	if err != nil {
		return nil, err
	}

	err = a.ValidateManifest(cfg.ManifestData)
	if err != nil {
		return nil, err
	}

	// Register MetaProviderManager as a runnable so its cleanup goroutine is managed by the app lifecycle
	a.AddRunnable(specificConfig.MetaProviderManager)

	return a, nil
}

type PluginAppConfig struct {
	MetaProviderManager *meta.ProviderManager
}

type PluginAppInstallerConfig struct {
	Logger              logging.Logger
	Authorizer          authorizer.Authorizer
	MetaProviderManager *meta.ProviderManager
	// DecoratePluginStorageHookProvider, if non-nil, wraps the default
	// PluginStorageHookProvider (built around the resolved storage) with
	// additional behavior — e.g. recording installs in an external system. It
	// receives the default provider and returns the provider to install; return
	// the default unchanged to opt out, or a different provider entirely. If nil,
	// the default is used.
	DecoratePluginStorageHookProvider func(base PluginStorageHookProvider) PluginStorageHookProvider
}

func NewPluginsAppInstaller(
	installerConfig PluginAppInstallerConfig,
) (*PluginAppInstaller, error) {
	specificConfig := &PluginAppConfig{
		MetaProviderManager: installerConfig.MetaProviderManager,
	}
	provider := simple.NewAppProvider(pluginsappapis.LocalManifest(), specificConfig, New)
	appConfig := app.Config{
		KubeConfig:     restclient.Config{}, // this will be overridden by the installer's InitializeApp method
		ManifestData:   *pluginsappapis.LocalManifest().ManifestData,
		SpecificConfig: specificConfig,
	}
	defaultInstaller, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, pluginsappapis.NewGoTypeAssociator())
	if err != nil {
		return nil, err
	}

	appInstaller := &PluginAppInstaller{
		AppInstaller: defaultInstaller,
		config:       installerConfig,
		ready:        make(chan struct{}),
	}
	return appInstaller, nil
}

type PluginAppInstaller struct {
	appsdkapiserver.AppInstaller
	config PluginAppInstallerConfig

	// restConfig is set during InitializeApp and used by the client factory
	restConfig *restclient.Config
	ready      chan struct{}
	readyOnce  sync.Once
}

func (p *PluginAppInstaller) InitializeApp(restConfig restclient.Config) error {
	if p.restConfig == nil {
		p.restConfig = &restConfig
		p.readyOnce.Do(func() {
			close(p.ready)
		})
	}
	return p.AppInstaller.InitializeApp(restConfig)
}

func (p *PluginAppInstaller) InstallAPIs(
	server appsdkapiserver.GenericAPIServer,
	restOptsGetter generic.RESTOptionsGetter,
) error {
	// Create a client factory function that will be called lazily when the client is needed.
	// This uses the rest config from the app, which is set during InitializeApp.
	clientFactory := func(ctx context.Context) (*pluginsv0alpha1.PluginClient, error) {
		<-p.ready
		if p.restConfig == nil {
			return nil, fmt.Errorf("rest config not yet initialized, app must be initialized before client can be created")
		}

		clientGenerator := k8s.NewClientRegistry(*p.restConfig, k8s.DefaultClientConfig())
		client, err := pluginsv0alpha1.NewPluginClientFromGenerator(clientGenerator)
		if err != nil {
			return nil, fmt.Errorf("failed to create plugin client: %w", err)
		}

		return client, nil
	}

	pluginMetaGVR := pluginsv0alpha1.MetaKind().GroupVersionResource()
	pluginGVR := pluginsv0alpha1.PluginKind().GroupVersionResource()
	replacedStorage := map[schema.GroupVersionResource]rest.Storage{
		pluginMetaGVR: NewMetaStorage(p.config.Logger, p.config.MetaProviderManager, clientFactory),
	}
	wrappedStorage := map[schema.GroupVersionResource]func(rest.Storage) (rest.Storage, error){
		pluginGVR: func(storage rest.Storage) (rest.Storage, error) {
			return newPluginStorage(storage, p.config.Logger, p.config.MetaProviderManager, p.config.DecoratePluginStorageHookProvider)
		},
	}
	wrappedServer := &customStorageWrapper{
		wrapped: server,
		replace: replacedStorage,
		wrap:    wrappedStorage,
	}
	return p.AppInstaller.InstallAPIs(wrappedServer, restOptsGetter)
}

func (p *PluginAppInstaller) GetAuthorizer() authorizer.Authorizer {
	return p.config.Authorizer
}
