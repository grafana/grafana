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
	"k8s.io/klog/v2"

	pluginsappapis "github.com/grafana/grafana/apps/plugins/pkg/apis"
	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/apps/plugins/pkg/app/install"
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

	if specificConfig.EnableChildReconciler {
		logger := logging.DefaultLogger.With("app", "plugins.app")
		clientGenerator := k8s.NewClientRegistry(cfg.KubeConfig, k8s.DefaultClientConfig())
		registrar := install.NewInstallRegistrar(logger, clientGenerator)
		pluginKind.Reconciler = install.NewChildPluginReconciler(logger, specificConfig.MetaProviderManager, registrar)
	}

	simpleConfig := simple.AppConfig{
		Name:       "plugins",
		KubeConfig: cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{
			InformerOptions: operator.InformerOptions{
				ErrorHandler: func(ctx context.Context, err error) {
					klog.ErrorS(err, "Informer processing error")
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
	MetaProviderManager   *meta.ProviderManager
	EnableChildReconciler bool
	InstallManager        install.InstallManager
}

func NewPluginsAppInstaller(
	logger logging.Logger,
	authorizer authorizer.Authorizer,
	metaProviderManager *meta.ProviderManager,
	enableChildReconciler bool,
	installManager install.InstallManager,
) (*PluginAppInstaller, error) {
	specificConfig := &PluginAppConfig{
		MetaProviderManager:   metaProviderManager,
		EnableChildReconciler: enableChildReconciler,
		InstallManager:        installManager,
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
		AppInstaller:   defaultInstaller,
		authorizer:     authorizer,
		metaManager:    metaProviderManager,
		installManager: installManager,
		logger:         logger,
		ready:          make(chan struct{}),
	}
	return appInstaller, nil
}

type PluginAppInstaller struct {
	appsdkapiserver.AppInstaller
	metaManager    *meta.ProviderManager
	installManager install.InstallManager
	authorizer     authorizer.Authorizer
	logger         logging.Logger

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
	// Create a client factory function for MetaStorage, which needs to list Plugin resources.
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

	// captured holds the SDK's default storage for GVRs we replace, so PluginStorage
	// can delegate List/Get/persistence to it directly (no loopback HTTP calls).
	captured := map[schema.GroupVersionResource]rest.Storage{}

	replacedStorage := map[schema.GroupVersionResource]rest.Storage{
		pluginMetaGVR: meta.NewMetaStorage(p.logger, p.metaManager, clientFactory),
	}

	// Only register custom PluginStorage if install manager is provided
	var pluginStorage *install.PluginStorage
	if p.installManager != nil {
		pluginStorage = install.NewPluginStorage(p.logger, p.installManager)
		replacedStorage[pluginGVR] = pluginStorage
	}

	wrappedServer := &customStorageWrapper{
		wrapped:  server,
		replace:  replacedStorage,
		captured: captured,
	}

	if err := p.AppInstaller.InstallAPIs(wrappedServer, restOptsGetter); err != nil {
		return err
	}

	// Wire the captured SDK default storage into PluginStorage so it can delegate
	// List/Get and persistence without making loopback HTTP calls.
	if pluginStorage != nil {
		if delegate, ok := captured[pluginGVR]; ok {
			if err := pluginStorage.SetDelegateStorage(delegate); err != nil {
				return fmt.Errorf("wiring plugin storage delegate: %w", err)
			}
		}
	}

	return nil
}

func (p *PluginAppInstaller) GetAuthorizer() authorizer.Authorizer {
	return p.authorizer
}
