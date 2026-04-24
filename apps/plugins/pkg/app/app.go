package app

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	json "github.com/goccy/go-json"
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/k8s"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/redis/go-redis/v9"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	restclient "k8s.io/client-go/rest"
	"k8s.io/client-go/tools/cache"

	pluginsappapis "github.com/grafana/grafana/apps/plugins/pkg/apis"
	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/apps/plugins/pkg/app/install"
	"github.com/grafana/grafana/apps/plugins/pkg/app/meta"
	"github.com/grafana/grafana/apps/plugins/pkg/app/metrics"
)

var noRetryPolicy operator.RetryPolicy = func(error, int) (bool, time.Duration) {
	return false, 0
}

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
			InformerSupplier: childReconcilerInformerSupplier(specificConfig.ChildReconciler),
			RetryPolicy:      childReconcilerRetryPolicy(specificConfig.ChildReconciler),
			InformerOptions:  childReconcilerInformerOptions(logger, specificConfig.ChildReconciler),
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
	Enabled              bool
	RedisCache           RedisCacheConfig
	OwnershipFilter      install.OwnershipFilter
	RetryPolicy          operator.RetryPolicy
	DisableRetries       bool
	CacheResyncInterval  time.Duration
	MaxConcurrentWorkers uint64
	UseWatchList         *bool
}

type PluginAppInstallerConfig struct {
	Logger               logging.Logger
	Authorizer           authorizer.Authorizer
	MetaProviderManager  *meta.ProviderManager
	PrometheusRegisterer prometheus.Registerer
	ChildReconciler      ChildReconcilerConfig
}

type RedisCacheConfig struct {
	Context      context.Context
	Client       redis.UniversalClient
	Prefix       string
	IndexBuckets int
	ScanCount    int64
	GetBatchSize int
}

func NewPluginsAppInstaller(config PluginAppInstallerConfig) (*PluginAppInstaller, error) {
	metrics.MustRegister(config.PrometheusRegisterer)

	specificConfig := &PluginAppConfig{
		MetaProviderManager: config.MetaProviderManager,
		ChildReconciler: ChildReconcilerConfig{
			Enabled:              config.ChildReconciler.Enabled,
			RedisCache:           config.ChildReconciler.RedisCache,
			OwnershipFilter:      config.ChildReconciler.OwnershipFilter,
			RetryPolicy:          config.ChildReconciler.RetryPolicy,
			DisableRetries:       config.ChildReconciler.DisableRetries,
			CacheResyncInterval:  config.ChildReconciler.CacheResyncInterval,
			MaxConcurrentWorkers: config.ChildReconciler.MaxConcurrentWorkers,
			UseWatchList:         config.ChildReconciler.UseWatchList,
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

func childReconcilerInformerSupplier(cfg ChildReconcilerConfig) simple.InformerSupplier {
	var gate readinessGate
	if readyFilter, ok := cfg.OwnershipFilter.(readinessGate); ok {
		gate = readyFilter
	}

	wrapPluginInformer := func(inf operator.Informer, kind resource.Kind) operator.Informer {
		if kind.GroupVersionKind() != pluginsv0alpha1.PluginKind().GroupVersionKind() {
			return inf
		}

		filtered := &filteredPluginInformer{Informer: inf}
		if gate != nil {
			return &gatedInformer{Informer: filtered, gate: gate}
		}
		return filtered
	}

	baseSupplier := simple.OptimizedInformerSupplier
	if cfg.RedisCache.Client == nil {
		return func(kind resource.Kind, clients resource.ClientGenerator, options operator.InformerOptions) (operator.Informer, error) {
			inf, err := baseSupplier(kind, clients, options)
			if err != nil {
				return nil, err
			}
			return wrapPluginInformer(inf, kind), nil
		}
	}

	baseSupplier = func(kind resource.Kind, clients resource.ClientGenerator, options operator.InformerOptions) (operator.Informer, error) {
		client, err := clients.ClientFor(kind)
		if err != nil {
			return nil, err
		}

		var store cache.Store
		store, err = NewRedisStore(kind, cfg.RedisCache)
		if err != nil {
			return nil, err
		}

		inf := operator.NewCustomCacheInformer(
			store,
			operator.NewListerWatcher(client, kind, options.ListWatchOptions),
			kind,
			operator.CustomCacheInformerOptions{
				InformerOptions: options,
			},
		)

		return operator.NewConcurrentInformerFromOptions(inf, options)
	}

	return func(kind resource.Kind, clients resource.ClientGenerator, options operator.InformerOptions) (operator.Informer, error) {
		inf, err := baseSupplier(kind, clients, options)
		if err != nil {
			return nil, err
		}
		return wrapPluginInformer(inf, kind), nil
	}
}

type filteredPluginInformer struct {
	operator.Informer
}

func (f *filteredPluginInformer) AddEventHandler(handler operator.ResourceWatcher) error {
	return f.Informer.AddEventHandler(&operator.SimpleWatcher{
		AddFunc: func(ctx context.Context, object resource.Object) error {
			logging.DefaultLogger.Debug("filteredPluginInformer.AddFunc", "type", fmt.Sprintf("%T", object))
			plugin, ok := toTypedPlugin(object)
			if !ok {
				logging.DefaultLogger.Warn("filteredPluginInformer.AddFunc: toTypedPlugin failed", "type", fmt.Sprintf("%T", object))
				return nil
			}
			if !install.ShouldHandlePlugin(plugin) {
				return nil
			}
			logging.DefaultLogger.Info("filteredPluginInformer.AddFunc: passing plugin to reconciler", "id", plugin.Spec.Id, "namespace", plugin.Namespace)
			return handler.Add(ctx, plugin)
		},
		UpdateFunc: func(ctx context.Context, src, tgt resource.Object) error {
			plugin, ok := toTypedPlugin(tgt)
			if !ok || !install.ShouldHandlePlugin(plugin) {
				return nil
			}
			srcPlugin, ok := toTypedPlugin(src)
			if !ok {
				return nil
			}
			return handler.Update(ctx, srcPlugin, plugin)
		},
		DeleteFunc: func(ctx context.Context, object resource.Object) error {
			plugin, ok := toTypedPlugin(object)
			if !ok || !install.ShouldHandlePlugin(plugin) {
				return nil
			}
			return handler.Delete(ctx, plugin)
		},
	})
}

// toTypedPlugin converts a resource.Object to *pluginsv0alpha1.Plugin.
//
// The SDK informer pipeline may deliver objects as *resource.UntypedObject (from list
// responses), *k8s.UntypedObjectWrapper, or *unstructured.Unstructured (from the native
// Kubernetes watch interface). The fast path handles already-typed objects; the fallback
// marshals to JSON and decodes into the typed struct, which is correct for all other
// representations including Kubernetes unstructured objects.
func toTypedPlugin(obj resource.Object) (*pluginsv0alpha1.Plugin, bool) {
	if p, ok := obj.(*pluginsv0alpha1.Plugin); ok {
		return p, true
	}
	// Fast path for SDK UntypedObject: read fields directly from the in-memory map
	// to avoid a marshal round-trip.
	if untyped, ok := obj.(*resource.UntypedObject); ok {
		p := &pluginsv0alpha1.Plugin{}
		p.TypeMeta = untyped.TypeMeta
		p.ObjectMeta = untyped.ObjectMeta
		if id, ok2 := untyped.Spec["id"].(string); ok2 {
			p.Spec.Id = id
		}
		if version, ok2 := untyped.Spec["version"].(string); ok2 {
			p.Spec.Version = version
		}
		if url, ok2 := untyped.Spec["url"].(string); ok2 {
			p.Spec.Url = &url
		}
		if parentId, ok2 := untyped.Spec["parentId"].(string); ok2 {
			p.Spec.ParentId = &parentId
		}
		if statusRaw, ok2 := untyped.Subresources["status"]; ok2 {
			_ = json.Unmarshal(statusRaw, &p.Status)
		}
		return p, true
	}
	// Fallback for Kubernetes unstructured types (e.g. *unstructured.Unstructured,
	// *k8s.UntypedObjectWrapper) returned by the native watch interface.
	data, err := json.Marshal(obj)
	if err != nil {
		return nil, false
	}
	p := &pluginsv0alpha1.Plugin{}
	if err := json.Unmarshal(data, p); err != nil {
		return nil, false
	}
	return p, true
}

func childReconcilerRetryPolicy(cfg ChildReconcilerConfig) operator.RetryPolicy {
	if cfg.DisableRetries {
		return noRetryPolicy
	}
	if cfg.RetryPolicy != nil {
		return cfg.RetryPolicy
	}
	return nil
}

func childReconcilerInformerOptions(logger logging.Logger, cfg ChildReconcilerConfig) operator.InformerOptions {
	maxConcurrentWorkers := uint64(5)
	if cfg.MaxConcurrentWorkers > 0 {
		maxConcurrentWorkers = cfg.MaxConcurrentWorkers
	}

	useWatchList := true
	if cfg.UseWatchList != nil {
		useWatchList = *cfg.UseWatchList
	}

	return operator.InformerOptions{
		ErrorHandler:        childReconcilerErrorHandler(logger),
		CacheResyncInterval: cfg.CacheResyncInterval,
		// Limit the number of plugin objects being reconciled concurrently.
		// Each worker processes events for a distinct set of plugins sequentially.
		MaxConcurrentWorkers: maxConcurrentWorkers,
		// Use watch-list streaming instead of paginated LIST to reduce API server
		// memory usage. Requires Kubernetes 1.27+.
		UseWatchList: useWatchList,
	}
}

func childReconcilerErrorHandler(logger logging.Logger) func(context.Context, error) {
	return func(ctx context.Context, err error) {
		log := logger.WithContext(ctx)

		var reconcileErr *install.ChildPluginReconcilerError
		if errors.As(err, &reconcileErr) {
			log.Error(
				"Child plugin reconciliation failed",
				"failureSource", reconcileErr.Source,
				"pluginId", reconcileErr.PluginID,
				"requestNamespace", reconcileErr.Namespace,
				"version", reconcileErr.Version,
				"error", reconcileErr.Err,
			)
			return
		}

		log.Error("Child plugin informer failed", "error", err)
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
