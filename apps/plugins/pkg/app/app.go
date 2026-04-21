package app

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/k8s"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	restclient "k8s.io/client-go/rest"

	pluginsappapis "github.com/grafana/grafana/apps/plugins/pkg/apis"
	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/apps/plugins/pkg/app/install"
	"github.com/grafana/grafana/apps/plugins/pkg/app/meta"
	"github.com/grafana/grafana/apps/plugins/pkg/app/metrics"
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

	if specificConfig.ChildReconciler.Enabled {
		reconcilerLogger := logger.With("component", "reconciler.children")
		clientGenerator := k8s.NewClientRegistry(cfg.KubeConfig, k8s.DefaultClientConfig())
		registrar := install.NewInstallRegistrar(reconcilerLogger, clientGenerator)
		pluginKind.Reconciler = install.NewChildPluginReconciler(
			reconcilerLogger,
			specificConfig.MetaProviderManager,
			registrar,
			specificConfig.ChildReconciler.OwnershipFilter,
		)
		pluginKind.ReconcileOptions = simple.BasicReconcileOptions{
			UsePlain: true,
		}
	}

	simpleConfig := simple.AppConfig{
		Name:       "plugins",
		KubeConfig: cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{
			InformerSupplier: childReconcilerInformerSupplier(
				specificConfig.ChildReconciler.MemcachedSelector,
				specificConfig.ChildReconciler.OwnershipFilter,
			),
			RetryPolicy: operator.ExponentialBackoffRetryPolicy(5*time.Second, 5),
			InformerOptions: operator.InformerOptions{
				ErrorHandler: func(ctx context.Context, err error) {
					logger.Error("Child plugin informer failed", "error", err)
				},
				// Limit the number of plugin objects being reconciled concurrently.
				// Each worker processes events for a distinct set of plugins sequentially.
				MaxConcurrentWorkers: 5,
				// Use watch-list streaming instead of paginated LIST to reduce API server
				// memory usage. Requires Kubernetes 1.27+.
				UseWatchList: true,
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
	if runnable, ok := specificConfig.ChildReconciler.OwnershipFilter.(app.Runnable); ok {
		a.AddRunnable(runnable)
	}

	return a, nil
}

type PluginAppConfig struct {
	MetaProviderManager *meta.ProviderManager
	ChildReconciler     ChildReconcilerConfig
}

type ChildReconcilerConfig struct {
	Enabled           bool
	MemcachedSelector operator.MemcachedServerSelector
	OwnershipFilter   install.OwnershipFilter
}

type PluginAppInstallerConfig struct {
	Logger               logging.Logger
	Authorizer           authorizer.Authorizer
	MetaProviderManager  *meta.ProviderManager
	PrometheusRegisterer prometheus.Registerer
	ChildReconciler      ChildReconcilerConfig
}

func NewPluginsAppInstaller(config PluginAppInstallerConfig) (*PluginAppInstaller, error) {
	metrics.MustRegister(config.PrometheusRegisterer)

	specificConfig := &PluginAppConfig{
		MetaProviderManager: config.MetaProviderManager,
		ChildReconciler: ChildReconcilerConfig{
			Enabled:           config.ChildReconciler.Enabled,
			MemcachedSelector: config.ChildReconciler.MemcachedSelector,
			OwnershipFilter:   config.ChildReconciler.OwnershipFilter,
		},
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
		authorizer:   config.Authorizer,
		metaManager:  config.MetaProviderManager,
		logger:       config.Logger,
		ready:        make(chan struct{}),
	}
	return appInstaller, nil
}

type readinessGate interface {
	WaitUntilReady(context.Context) error
}

type gatedInformer struct {
	operator.Informer
	gate readinessGate
}

func (g *gatedInformer) Run(ctx context.Context) error {
	if g.gate != nil {
		if err := g.gate.WaitUntilReady(ctx); err != nil {
			return err
		}
	}
	return g.Informer.Run(ctx)
}

func (g *gatedInformer) WaitForSync(ctx context.Context) error {
	if g.gate != nil {
		if err := g.gate.WaitUntilReady(ctx); err != nil {
			return err
		}
	}
	return g.Informer.WaitForSync(ctx)
}

func childReconcilerInformerSupplier(selector operator.MemcachedServerSelector, ownershipFilter install.OwnershipFilter) simple.InformerSupplier {
	var gate readinessGate
	if readyFilter, ok := ownershipFilter.(readinessGate); ok {
		gate = readyFilter
	}

	baseSupplier := simple.OptimizedInformerSupplier
	if selector == nil {
		return func(kind resource.Kind, clients resource.ClientGenerator, options operator.InformerOptions) (operator.Informer, error) {
			inf, err := baseSupplier(kind, clients, options)
			if err != nil {
				return nil, err
			}
			if gate != nil && kind.GroupVersionKind() == pluginsv0alpha1.PluginKind().GroupVersionKind() {
				return &gatedInformer{Informer: inf, gate: gate}, nil
			}
			return inf, nil
		}
	}

	baseSupplier = func(kind resource.Kind, clients resource.ClientGenerator, options operator.InformerOptions) (operator.Informer, error) {
		client, err := clients.ClientFor(kind)
		if err != nil {
			return nil, err
		}

		inf, err := operator.NewMemcachedInformer(kind, client, operator.MemcachedInformerOptions{
			ServerSelector: selector,
			CustomCacheInformerOptions: operator.CustomCacheInformerOptions{
				InformerOptions: options,
			},
		})
		if err != nil {
			return nil, err
		}

		return operator.NewConcurrentInformerFromOptions(inf, options)
	}

	return func(kind resource.Kind, clients resource.ClientGenerator, options operator.InformerOptions) (operator.Informer, error) {
		inf, err := baseSupplier(kind, clients, options)
		if err != nil {
			return nil, err
		}
		if gate != nil && kind.GroupVersionKind() == pluginsv0alpha1.PluginKind().GroupVersionKind() {
			return &gatedInformer{Informer: inf, gate: gate}, nil
		}
		return inf, nil
	}
}

type PluginAppInstaller struct {
	appsdkapiserver.AppInstaller
	metaManager *meta.ProviderManager
	authorizer  authorizer.Authorizer
	logger      logging.Logger

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
	replacedStorage := map[schema.GroupVersionResource]rest.Storage{
		pluginMetaGVR: NewMetaStorage(p.logger, p.metaManager, clientFactory),
	}
	wrappedServer := &customStorageWrapper{
		wrapped: server,
		replace: replacedStorage,
	}
	return p.AppInstaller.InstallAPIs(wrappedServer, restOptsGetter)
}

func (p *PluginAppInstaller) GetAuthorizer() authorizer.Authorizer {
	return p.authorizer
}
