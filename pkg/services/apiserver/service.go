package apiserver

import (
	"context"
	"fmt"
	"net/http"
	"path"

	"github.com/prometheus/client_golang/prometheus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	genericapifilters "k8s.io/apiserver/pkg/endpoints/filters"
	"k8s.io/apiserver/pkg/endpoints/responsewriter"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/util/notfoundhandler"
	clientrest "k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	aggregatorapiserver "k8s.io/kube-aggregator/pkg/apiserver"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	dataplaneaggregator "github.com/grafana/grafana/pkg/aggregator/apiserver"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanaresponsewriter "github.com/grafana/grafana/pkg/apiserver/endpoints/responsewriter"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/modules"
	servicetracing "github.com/grafana/grafana/pkg/modules/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/registry/apis/datasource"
	kubeaggregator "github.com/grafana/grafana/pkg/services/apiserver/aggregator"
	"github.com/grafana/grafana/pkg/services/apiserver/auth/authenticator"
	"github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	grafanaapiserveroptions "github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/services/apiserver/utils"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

var (
	_ Service                    = (*service)(nil)
	_ RestConfigProvider         = (*service)(nil)
	_ registry.BackgroundService = (*service)(nil)
	_ registry.CanBeDisabled     = (*service)(nil)

	Scheme = runtime.NewScheme()
	Codecs = serializer.NewCodecFactory(Scheme)

	unversionedVersion = schema.GroupVersion{Group: "", Version: "v1"}
	unversionedTypes   = []runtime.Object{
		&metav1.Status{},
		&metav1.WatchEvent{},
		&metav1.APIVersions{},
		&metav1.APIGroupList{},
		&metav1.APIGroup{},
		&metav1.APIResourceList{},
		&metav1.PartialObjectMetadata{},
		&metav1.PartialObjectMetadataList{},
	}

	// internal provider of the package level client Config
	restConfig RestConfigProvider
	ready      = make(chan struct{})
)

func init() {
	// we need to add the options to empty v1
	metav1.AddToGroupVersion(Scheme, schema.GroupVersion{Group: "", Version: "v1"})
	Scheme.AddUnversionedTypes(unversionedVersion, unversionedTypes...)
}

// GetRestConfig return a client Config mounted at package level
// This resolves circular dependency issues between apiserver, authz,
// and Folder Service.
// The client Config gets initialized during the first call to
// ProvideService.
// Any call to GetRestConfig will block until we have a restConfig available
func GetRestConfig(ctx context.Context) (*clientrest.Config, error) {
	<-ready
	return restConfig.GetRestConfig(ctx)
}

type Service interface {
	services.NamedService
	registry.BackgroundService
	registry.CanBeDisabled
}

type RestConfigProvider interface {
	GetRestConfig(context.Context) (*clientrest.Config, error)
}

type DirectRestConfigProvider interface {
	// GetDirectRestConfig returns a k8s client configuration that will use the same
	// logged in user as the current request context.  This is useful when
	// creating clients that map legacy API handlers to k8s backed services
	GetDirectRestConfig(c *contextmodel.ReqContext) *clientrest.Config

	// This can be used to rewrite incoming requests to path now supported under /apis
	DirectlyServeHTTP(w http.ResponseWriter, r *http.Request)
}

type service struct {
	services.NamedService

	options    *grafanaapiserveroptions.Options
	restConfig *clientrest.Config

	cfg      *setting.Cfg
	features featuremgmt.FeatureToggles
	log      log.Logger

	stopCh    chan struct{}
	stoppedCh chan error

	db       db.DB
	rr       routing.RouteRegister
	handler  http.Handler
	builders []builder.APIGroupBuilder

	tracing *tracing.TracingService
	metrics prometheus.Registerer

	authorizer        *authorizer.GrafanaAuthorizer
	serverLockService builder.ServerLockService
	storageStatus     dualwrite.Service
	kvStore           kvstore.KVStore

	pluginClient    plugins.Client
	datasources     datasource.ScopedPluginDatasourceProvider
	contextProvider datasource.PluginContextWrapper
	pluginStore     pluginstore.Store
	unified         resource.ResourceClient

	buildHandlerChainFuncFromBuilders builder.BuildHandlerChainFuncFromBuilders
}

func ProvideService(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	rr routing.RouteRegister,
	orgService org.Service,
	tracing *tracing.TracingService,
	serverLockService *serverlock.ServerLockService,
	db db.DB,
	kvStore kvstore.KVStore,
	pluginClient plugins.Client,
	datasources datasource.ScopedPluginDatasourceProvider,
	contextProvider datasource.PluginContextWrapper,
	pluginStore pluginstore.Store,
	storageStatus dualwrite.Service,
	unified resource.ResourceClient,
	buildHandlerChainFuncFromBuilders builder.BuildHandlerChainFuncFromBuilders,
) (*service, error) {
	s := &service{
		log:                               log.New(modules.GrafanaAPIServer),
		cfg:                               cfg,
		features:                          features,
		rr:                                rr,
		stopCh:                            make(chan struct{}),
		builders:                          []builder.APIGroupBuilder{},
		authorizer:                        authorizer.NewGrafanaAuthorizer(cfg, orgService),
		tracing:                           tracing,
		db:                                db, // For Unified storage
		metrics:                           metrics.ProvideRegisterer(),
		kvStore:                           kvStore,
		pluginClient:                      pluginClient,
		datasources:                       datasources,
		contextProvider:                   contextProvider,
		pluginStore:                       pluginStore,
		serverLockService:                 serverLockService,
		storageStatus:                     storageStatus,
		unified:                           unified,
		buildHandlerChainFuncFromBuilders: buildHandlerChainFuncFromBuilders,
	}
	// This will be used when running as a dskit service
	service := services.NewBasicService(s.start, s.running, nil).WithName(modules.GrafanaAPIServer)
	s.NamedService = servicetracing.NewServiceTracer(tracing.GetTracerProvider(), service)

	// TODO: this is very hacky
	// We need to register the routes in ProvideService to make sure
	// the routes are registered before the Grafana HTTP server starts.
	proxyHandler := func(k8sRoute routing.RouteRegister) {
		handler := func(c *contextmodel.ReqContext) {
			if err := s.NamedService.AwaitRunning(c.Req.Context()); err != nil {
				c.Resp.WriteHeader(http.StatusInternalServerError)
				_, _ = c.Resp.Write([]byte(http.StatusText(http.StatusInternalServerError)))
				return
			}

			if s.handler == nil {
				c.Resp.WriteHeader(http.StatusNotFound)
				_, _ = c.Resp.Write([]byte(http.StatusText(http.StatusNotFound)))
				return
			}

			req := c.Req
			if req.URL.Path == "" {
				req.URL.Path = "/"
			}

			if c.SignedInUser != nil {
				ctx := identity.WithRequester(req.Context(), c.SignedInUser)
				req = req.WithContext(ctx)
			}

			resp := responsewriter.WrapForHTTP1Or2(c.Resp)
			s.handler.ServeHTTP(resp, req)
		}
		k8sRoute.Any("/", middleware.ReqSignedIn, handler)
		k8sRoute.Any("/*", middleware.ReqSignedIn, handler)
	}

	s.rr.Group("/apis", proxyHandler)
	s.rr.Group("/livez", proxyHandler)
	s.rr.Group("/readyz", proxyHandler)
	s.rr.Group("/healthz", proxyHandler)
	s.rr.Group("/openapi", proxyHandler)
	s.rr.Group("/version", proxyHandler)

	// only set the package level restConfig once
	if restConfig == nil {
		restConfig = s
		close(ready)
	}

	return s, nil
}

func (s *service) GetRestConfig(ctx context.Context) (*clientrest.Config, error) {
	if err := s.NamedService.AwaitRunning(ctx); err != nil {
		return nil, fmt.Errorf("unable to get rest config: %w", err)
	}
	return s.restConfig, nil
}

func (s *service) IsDisabled() bool {
	return false
}

// Run is an adapter for the BackgroundService interface.
func (s *service) Run(ctx context.Context) error {
	if err := s.NamedService.StartAsync(ctx); err != nil {
		return err
	}

	if err := s.NamedService.AwaitRunning(ctx); err != nil {
		return err
	}
	return s.AwaitTerminated(ctx)
}

func (s *service) RegisterAPI(b builder.APIGroupBuilder) {
	s.builders = append(s.builders, b)
}

// nolint:gocyclo
func (s *service) start(ctx context.Context) error {
	// Get the list of groups the server will support
	builders := s.builders
	groupVersions := make([]schema.GroupVersion, 0, len(builders))

	// Install schemas
	for i, b := range builders {
		gvs := builder.GetGroupVersions(b)
		groupVersions = append(groupVersions, gvs...)
		if len(gvs) == 0 {
			return fmt.Errorf("no group versions found for builder %T", b)
		}
		if err := b.InstallSchema(Scheme); err != nil {
			return err
		}
		pvs := Scheme.PrioritizedVersionsForGroup(gvs[0].Group)

		for j, gv := range pvs {
			if s.features.IsEnabledGlobally(featuremgmt.FlagKubernetesAggregator) {
				// set the priority for the group+version
				kubeaggregator.APIVersionPriorities[gv] = kubeaggregator.Priority{Group: int32(15000 + i), Version: int32(len(pvs) - j)}
			}

			if a, ok := b.(builder.APIGroupAuthorizer); ok {
				auth := a.GetAuthorizer()
				if auth != nil {
					s.authorizer.Register(gv, auth)
				}
			}
		}
	}

	o := grafanaapiserveroptions.NewOptions(Codecs.LegacyCodec(groupVersions...))
	err := applyGrafanaConfig(s.cfg, s.features, o)
	if err != nil {
		return err
	}

	if errs := o.Validate(); len(errs) != 0 {
		// TODO: handle multiple errors
		return errs[0]
	}

	// This will check that required feature toggles are enabled for more advanced storage modes
	// Any required preconditions should be hardcoded here
	if o.StorageOptions != nil {
		if err := o.StorageOptions.EnforceFeatureToggleAfterMode1(s.features); err != nil {
			return err
		}
	}

	serverConfig := genericapiserver.NewRecommendedConfig(Codecs)
	if err := o.ApplyTo(serverConfig); err != nil {
		return err
	}
	serverConfig.Authorization.Authorizer = s.authorizer
	serverConfig.Authentication.Authenticator = authenticator.NewAuthenticator(serverConfig.Authentication.Authenticator)
	serverConfig.TracerProvider = s.tracing.GetTracerProvider()

	// setup loopback transport for the aggregator server
	transport := &roundTripperFunc{ready: make(chan struct{})}
	serverConfig.LoopbackClientConfig.Transport = transport
	serverConfig.LoopbackClientConfig.TLSClientConfig = clientrest.TLSClientConfig{}

	var optsregister apistore.StorageOptionsRegister

	if o.StorageOptions.StorageType == grafanaapiserveroptions.StorageTypeEtcd {
		if err := o.RecommendedOptions.Etcd.Validate(); len(err) > 0 {
			return err[0]
		}
		if err := o.RecommendedOptions.Etcd.ApplyTo(&serverConfig.Config); err != nil {
			return err
		}
	} else {
		getter := apistore.NewRESTOptionsGetterForClient(s.unified, o.RecommendedOptions.Etcd.StorageConfig)
		optsregister = getter.RegisterOptions

		// Use unified storage client
		serverConfig.Config.RESTOptionsGetter = getter
	}

	// Add OpenAPI specs for each group+version
	err = builder.SetupConfig(
		Scheme,
		serverConfig,
		builders,
		s.cfg.BuildStamp,
		s.cfg.BuildVersion,
		s.cfg.BuildCommit,
		s.cfg.BuildBranch,
		s.buildHandlerChainFuncFromBuilders,
	)
	if err != nil {
		return err
	}

	notFoundHandler := notfoundhandler.New(Codecs, genericapifilters.NoMuxAndDiscoveryIncompleteKey)

	// Create the server
	server, err := serverConfig.Complete().New("grafana-apiserver", genericapiserver.NewEmptyDelegateWithCustomHandler(notFoundHandler))
	if err != nil {
		return err
	}

	// Install the API group+version
	err = builder.InstallAPIs(Scheme, Codecs, server, serverConfig.RESTOptionsGetter, builders, o.StorageOptions,
		// Required for the dual writer initialization
		s.metrics, request.GetNamespaceMapper(s.cfg), kvstore.WithNamespace(s.kvStore, 0, "storage.dualwriting"),
		s.serverLockService,
		s.storageStatus,
		optsregister,
	)
	if err != nil {
		return err
	}

	// stash the options for later use
	s.options = o

	delegate := server
	var aggregatorServer *aggregatorapiserver.APIAggregator
	if s.features.IsEnabledGlobally(featuremgmt.FlagKubernetesAggregator) {
		aggregatorServer, err = s.createKubeAggregator(serverConfig, server, s.metrics)
		if err != nil {
			return err
		}
		delegate = aggregatorServer.GenericAPIServer
	}

	var runningServer *genericapiserver.GenericAPIServer
	if s.features.IsEnabledGlobally(featuremgmt.FlagDataplaneAggregator) {
		runningServer, err = s.startDataplaneAggregator(ctx, transport, serverConfig, delegate)
		if err != nil {
			return err
		}
	} else if s.features.IsEnabledGlobally(featuremgmt.FlagKubernetesAggregator) {
		runningServer, err = s.startKubeAggregator(ctx, transport, aggregatorServer)
		if err != nil {
			return err
		}
	} else {
		runningServer, err = s.startCoreServer(ctx, transport, server)
		if err != nil {
			return err
		}
	}

	// only write kubeconfig in dev mode
	if o.ExtraOptions.DevMode {
		if err := ensureKubeConfig(runningServer.LoopbackClientConfig, o.StorageOptions.DataPath); err != nil {
			return err
		}
	}

	// used by the proxy wrapper registered in ProvideService
	s.handler = runningServer.Handler
	// used by local clients to make requests to the server
	s.restConfig = runningServer.LoopbackClientConfig

	return nil
}

func (s *service) startCoreServer(
	ctx context.Context,
	transport *roundTripperFunc,
	server *genericapiserver.GenericAPIServer,
) (*genericapiserver.GenericAPIServer, error) {
	// setup the loopback transport and signal that it's ready.
	// ignore the lint error because the response is passed directly to the client,
	// so the client will be responsible for closing the response body.
	// nolint:bodyclose
	transport.fn = grafanaresponsewriter.WrapHandler(server.Handler)
	close(transport.ready)

	prepared := server.PrepareRun()
	go func() {
		s.stoppedCh <- prepared.RunWithContext(ctx)
	}()

	return server, nil
}

func (s *service) startDataplaneAggregator(
	ctx context.Context,
	transport *roundTripperFunc,
	serverConfig *genericapiserver.RecommendedConfig,
	delegate *genericapiserver.GenericAPIServer,
) (*genericapiserver.GenericAPIServer, error) {
	config := &dataplaneaggregator.Config{
		GenericConfig: serverConfig,
		ExtraConfig: dataplaneaggregator.ExtraConfig{
			PluginClient: s.pluginClient,
			PluginContextProvider: &pluginContextProvider{
				pluginStore:     s.pluginStore,
				datasources:     s.datasources,
				contextProvider: s.contextProvider,
			},
		},
	}

	if err := s.options.GrafanaAggregatorOptions.ApplyTo(config, s.options.RecommendedOptions.Etcd); err != nil {
		return nil, err
	}

	completedConfig := config.Complete()

	aggregatorServer, err := completedConfig.NewWithDelegate(delegate)
	if err != nil {
		return nil, err
	}

	// setup the loopback transport for the aggregator server and signal that it's ready
	// ignore the lint error because the response is passed directly to the client,
	// so the client will be responsible for closing the response body.
	// nolint:bodyclose
	transport.fn = grafanaresponsewriter.WrapHandler(aggregatorServer.GenericAPIServer.Handler)
	close(transport.ready)

	prepared, err := aggregatorServer.PrepareRun()
	if err != nil {
		return nil, err
	}

	go func() {
		s.stoppedCh <- prepared.RunWithContext(ctx)
	}()

	return aggregatorServer.GenericAPIServer, nil
}

func (s *service) createKubeAggregator(
	serverConfig *genericapiserver.RecommendedConfig,
	server *genericapiserver.GenericAPIServer,
	reg prometheus.Registerer,
) (*aggregatorapiserver.APIAggregator, error) {
	namespaceMapper := request.GetNamespaceMapper(s.cfg)

	aggregatorConfig, err := kubeaggregator.CreateAggregatorConfig(s.options, *serverConfig, namespaceMapper(1))
	if err != nil {
		return nil, err
	}

	return kubeaggregator.CreateAggregatorServer(aggregatorConfig, server, reg)
}

func (s *service) startKubeAggregator(
	ctx context.Context,
	transport *roundTripperFunc,
	aggregatorServer *aggregatorapiserver.APIAggregator,
) (*genericapiserver.GenericAPIServer, error) {
	// setup the loopback transport for the aggregator server and signal that it's ready
	// ignore the lint error because the response is passed directly to the client,
	// so the client will be responsible for closing the response body.
	// nolint:bodyclose
	transport.fn = grafanaresponsewriter.WrapHandler(aggregatorServer.GenericAPIServer.Handler)
	close(transport.ready)

	prepared, err := aggregatorServer.PrepareRun()
	if err != nil {
		return nil, err
	}

	go func() {
		s.stoppedCh <- prepared.Run(ctx)
	}()

	return aggregatorServer.GenericAPIServer, nil
}

func (s *service) GetDirectRestConfig(c *contextmodel.ReqContext) *clientrest.Config {
	return &clientrest.Config{
		Transport: &roundTripperFunc{
			fn: func(req *http.Request) (*http.Response, error) {
				if err := s.NamedService.AwaitRunning(req.Context()); err != nil {
					return nil, err
				}
				ctx := identity.WithRequester(req.Context(), c.SignedInUser)
				wrapped := grafanaresponsewriter.WrapHandler(s.handler)
				return wrapped(req.WithContext(ctx))
			},
		},
	}
}

func (s *service) DirectlyServeHTTP(w http.ResponseWriter, r *http.Request) {
	if err := s.NamedService.AwaitRunning(r.Context()); err != nil {
		return
	}
	s.handler.ServeHTTP(w, r)
}

func (s *service) running(ctx context.Context) error {
	select {
	case err := <-s.stoppedCh:
		if err != nil {
			return err
		}
	case <-ctx.Done():
		return ctx.Err()
	}
	return nil
}

func ensureKubeConfig(restConfig *clientrest.Config, dir string) error {
	return clientcmd.WriteToFile(
		utils.FormatKubeConfig(restConfig),
		path.Join(dir, "grafana.kubeconfig"),
	)
}

type roundTripperFunc struct {
	ready chan struct{}
	fn    func(req *http.Request) (*http.Response, error)
}

func (f *roundTripperFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	if f.fn == nil {
		<-f.ready
	}
	return f.fn(req)
}

type pluginContextProvider struct {
	pluginStore     pluginstore.Store
	datasources     datasource.ScopedPluginDatasourceProvider
	contextProvider datasource.PluginContextWrapper
}

func (p *pluginContextProvider) GetPluginContext(ctx context.Context, pluginID string, uid string) (backend.PluginContext, error) {
	all := p.pluginStore.Plugins(ctx)

	var datasourceProvider datasource.PluginDatasourceProvider
	for _, plugin := range all {
		if plugin.ID == pluginID {
			datasourceProvider = p.datasources.GetDatasourceProvider(plugin.JSONData)
		}
	}
	if datasourceProvider == nil {
		return backend.PluginContext{}, fmt.Errorf("plugin not found")
	}

	s, err := datasourceProvider.GetInstanceSettings(ctx, uid)
	if err != nil {
		return backend.PluginContext{}, err
	}

	return p.contextProvider.PluginContextForDataSource(ctx, s)
}
