package apiserver

import (
	"context"
	"fmt"
	"net/http"
	"path"
	"strings"

	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	genericapifilters "k8s.io/apiserver/pkg/endpoints/filters"
	"k8s.io/apiserver/pkg/endpoints/responsewriter"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/util/notfoundhandler"
	clientrest "k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/kube-openapi/pkg/common"

	"github.com/grafana/authlib/types"
	"github.com/grafana/dskit/services"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	dataplaneaggregator "github.com/grafana/grafana/pkg/aggregator/apiserver"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanaresponsewriter "github.com/grafana/grafana/pkg/apiserver/endpoints/responsewriter"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/modules"
	servicetracing "github.com/grafana/grafana/pkg/modules/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/registry/apis/datasource"
	"github.com/grafana/grafana/pkg/services/apiserver/aggregatorrunner"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
	"github.com/grafana/grafana/pkg/services/apiserver/auth/authenticator"
	"github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	grafanaapiserveroptions "github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/services/apiserver/utils"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/user"
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
)

const MaxRequestBodyBytes = 16 * 1024 * 1024 // 16MB - determined by the size of `mediumtext` on mysql, which is used to save dashboard data

type Service interface {
	services.NamedService
	registry.BackgroundService
	registry.CanBeDisabled
}

type service struct {
	services.NamedService

	options    *grafanaapiserveroptions.Options
	restConfig *clientrest.Config
	scheme     *runtime.Scheme
	codecs     serializer.CodecFactory

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

	pluginClient       plugins.Client
	datasources        datasource.ScopedPluginDatasourceProvider
	contextProvider    datasource.PluginContextWrapper
	pluginStore        pluginstore.Store
	unified            resource.ResourceClient
	restConfigProvider RestConfigProvider

	buildHandlerChainFuncFromBuilders builder.BuildHandlerChainFuncFromBuilders
	aggregatorRunner                  aggregatorrunner.AggregatorRunner
	appInstallers                     []appsdkapiserver.AppInstaller
	builderMetrics                    *builder.BuilderMetrics
	dualWriterMetrics                 *grafanarest.DualWriterMetrics
}

func ProvideService(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	rr routing.RouteRegister,
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
	restConfigProvider RestConfigProvider,
	buildHandlerChainFuncFromBuilders builder.BuildHandlerChainFuncFromBuilders,
	eventualRestConfigProvider *eventualRestConfigProvider,
	reg prometheus.Registerer,
	aggregatorRunner aggregatorrunner.AggregatorRunner,
	appInstallers []appsdkapiserver.AppInstaller,
	builderMetrics *builder.BuilderMetrics,
) (*service, error) {
	scheme := builder.ProvideScheme()
	codecs := builder.ProvideCodecFactory(scheme)
	s := &service{
		scheme:                            scheme,
		codecs:                            codecs,
		log:                               log.New(modules.GrafanaAPIServer),
		cfg:                               cfg,
		features:                          features,
		rr:                                rr,
		stopCh:                            make(chan struct{}),
		builders:                          []builder.APIGroupBuilder{},
		authorizer:                        authorizer.NewGrafanaBuiltInSTAuthorizer(cfg),
		tracing:                           tracing,
		db:                                db, // For Unified storage
		metrics:                           reg,
		kvStore:                           kvStore,
		pluginClient:                      pluginClient,
		datasources:                       datasources,
		contextProvider:                   contextProvider,
		pluginStore:                       pluginStore,
		serverLockService:                 serverLockService,
		storageStatus:                     storageStatus,
		unified:                           unified,
		restConfigProvider:                restConfigProvider,
		buildHandlerChainFuncFromBuilders: buildHandlerChainFuncFromBuilders,
		aggregatorRunner:                  aggregatorRunner,
		appInstallers:                     appInstallers,
		builderMetrics:                    builderMetrics,
		dualWriterMetrics:                 grafanarest.NewDualWriterMetrics(reg),
	}
	// This will be used when running as a dskit service
	service := services.NewBasicService(s.start, s.running, nil).WithName(modules.GrafanaAPIServer)
	s.NamedService = servicetracing.NewServiceTracer(tracing.GetTracerProvider(), service)

	// TODO: this is very hacky
	// We need to register the routes in ProvideService to make sure
	// the routes are registered before the Grafana HTTP server starts.
	proxyHandler := func(k8sRoute routing.RouteRegister) {
		handler := func(c *contextmodel.ReqContext) {
			if err := s.AwaitRunning(c.Req.Context()); err != nil {
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
				// For unauthenticated requests, we set the namespace to the requested one
				if !c.IsSignedIn {
					useNamespaceFromPath(req.URL.Path, c.SignedInUser)
				}

				ctx := identity.WithRequester(req.Context(), c.SignedInUser)
				req = req.WithContext(ctx)
			}

			resp := responsewriter.WrapForHTTP1Or2(c.Resp)
			s.handler.ServeHTTP(resp, req)
		}
		k8sRoute.Any("/features.grafana.app/v0alpha1/*", handler)
		k8sRoute.Any("/", middleware.ReqSignedIn, handler)
		k8sRoute.Any("/*", middleware.ReqSignedIn, handler)
	}

	s.rr.Group("/apis", proxyHandler)
	s.rr.Group("/livez", proxyHandler)
	s.rr.Group("/readyz", proxyHandler)
	s.rr.Group("/healthz", proxyHandler)
	s.rr.Group("/openapi", proxyHandler)
	s.rr.Group("/version", proxyHandler)

	eventualRestConfigProvider.cfg = s
	close(eventualRestConfigProvider.ready)

	return s, nil
}

func (s *service) GetRestConfig(ctx context.Context) (*clientrest.Config, error) {
	if err := s.AwaitRunning(ctx); err != nil {
		return nil, fmt.Errorf("unable to get rest config: %w", err)
	}
	return s.restConfig, nil
}

func (s *service) IsDisabled() bool {
	return false
}

// Run is an adapter for the BackgroundService interface.
func (s *service) Run(ctx context.Context) error {
	if err := s.StartAsync(ctx); err != nil {
		return err
	}

	if err := s.AwaitRunning(ctx); err != nil {
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

	// Install schemas for existing builders
	for _, b := range builders {
		gvs := builder.GetGroupVersions(b)
		groupVersions = append(groupVersions, gvs...)
		if len(gvs) == 0 {
			return fmt.Errorf("no group versions found for builder %T", b)
		}
		if err := b.InstallSchema(s.scheme); err != nil {
			return err
		}
		pvs := s.scheme.PrioritizedVersionsForGroup(gvs[0].Group)

		for _, gv := range pvs {
			if a, ok := b.(builder.APIGroupAuthorizer); ok {
				auth := a.GetAuthorizer()
				if auth != nil {
					s.authorizer.Register(gv, auth)
				}
			}
		}
	}

	// Add schemas from app installers to the scheme before creating options
	additionalGroupVersions, err := appinstaller.AddToScheme(s.appInstallers, s.scheme)
	if err != nil {
		return err
	}
	groupVersions = append(groupVersions, additionalGroupVersions...)

	o := grafanaapiserveroptions.NewOptions(s.codecs.LegacyCodec(groupVersions...))

	// Register admission plugins from app installers after options are created
	if err := appinstaller.RegisterAdmissionPlugins(ctx, s.appInstallers, o); err != nil {
		return err
	}

	// Register authorizers from app installers
	appinstaller.RegisterAuthorizers(ctx, s.appInstallers, s.authorizer)

	err = applyGrafanaConfig(s.cfg, s.features, o)
	if err != nil {
		return err
	}

	if errs := o.Validate(); len(errs) != 0 {
		return errs[0]
	}

	if errs := o.APIEnablementOptions.Validate(s.scheme); len(errs) != 0 {
		return errs[0]
	}

	serverConfig := genericapiserver.NewRecommendedConfig(s.codecs)
	if err := o.ApplyTo(serverConfig); err != nil {
		return err
	}

	if err := o.APIEnablementOptions.ApplyTo(&serverConfig.Config, appinstaller.NewAPIResourceConfig(s.appInstallers), s.scheme); err != nil {
		return err
	}

	serverConfig.Authorization.Authorizer = s.authorizer
	serverConfig.Authentication.Authenticator = authenticator.NewAuthenticator(serverConfig.Authentication.Authenticator)
	serverConfig.TracerProvider = s.tracing.GetTracerProvider()

	// setup loopback transport for the aggregator server
	transport := &grafanaapiserveroptions.RoundTripperFunc{Ready: make(chan struct{})}
	serverConfig.LoopbackClientConfig.Transport = transport
	serverConfig.LoopbackClientConfig.TLSClientConfig = clientrest.TLSClientConfig{}
	serverConfig.MaxRequestBodyBytes = MaxRequestBodyBytes

	var optsregister apistore.StorageOptionsRegister

	if o.StorageOptions.StorageType == grafanaapiserveroptions.StorageTypeEtcd {
		if err := o.RecommendedOptions.Etcd.Validate(); len(err) > 0 {
			return err[0]
		}
		if err := o.RecommendedOptions.Etcd.ApplyTo(&serverConfig.Config); err != nil {
			return err
		}
	} else {
		getter := apistore.NewRESTOptionsGetterForClient(s.unified, o.RecommendedOptions.Etcd.StorageConfig, s.restConfigProvider)
		optsregister = getter.RegisterOptions
		serverConfig.RESTOptionsGetter = getter
	}

	defGetters := []common.GetOpenAPIDefinitions{
		appinstaller.BuildOpenAPIDefGetter(s.appInstallers),
	}

	// Add OpenAPI specs for each group+version (existing builders)
	err = builder.SetupConfig(
		s.scheme,
		serverConfig,
		builders,
		s.cfg.BuildStamp,
		s.cfg.BuildVersion,
		s.cfg.BuildCommit,
		s.cfg.BuildBranch,
		s.buildHandlerChainFuncFromBuilders,
		groupVersions,
		defGetters,
	)
	if err != nil {
		return err
	}

	notFoundHandler := notfoundhandler.New(s.codecs, genericapifilters.NoMuxAndDiscoveryIncompleteKey)

	if err := appinstaller.RegisterPostStartHooks(s.appInstallers, serverConfig); err != nil {
		return fmt.Errorf("failed to register post start hooks for app installers: %w", err)
	}

	// Create the server
	server, err := serverConfig.Complete().New("grafana-apiserver", genericapiserver.NewEmptyDelegateWithCustomHandler(notFoundHandler))
	if err != nil {
		return err
	}

	// Install the API group+version for existing builders
	err = builder.InstallAPIs(s.scheme, s.codecs, server, serverConfig.RESTOptionsGetter, builders, o.StorageOptions,
		s.metrics,
		request.GetNamespaceMapper(s.cfg),
		kvstore.WithNamespace(s.kvStore, 0, "storage.dualwriting"),
		s.serverLockService,
		s.storageStatus,
		optsregister,
		s.features,
		s.dualWriterMetrics,
		s.builderMetrics,
	)
	if err != nil {
		return err
	}

	if err := appinstaller.InstallAPIs(
		ctx,
		s.appInstallers,
		server,
		serverConfig.RESTOptionsGetter,
		o.StorageOptions,
		kvstore.WithNamespace(s.kvStore, 0, "storage.dualwriting"),
		s.serverLockService,
		request.GetNamespaceMapper(s.cfg),
		s.storageStatus,
		s.dualWriterMetrics,
		s.builderMetrics,
		serverConfig.MergedResourceConfig,
	); err != nil {
		return err
	}

	// stash the options for later use
	s.options = o

	delegate := server

	var runningServer *genericapiserver.GenericAPIServer
	isKubernetesAggregatorEnabled := s.features.IsEnabledGlobally(featuremgmt.FlagKubernetesAggregator)
	isDataplaneAggregatorEnabled := s.features.IsEnabledGlobally(featuremgmt.FlagDataplaneAggregator)

	if isKubernetesAggregatorEnabled {
		aggregatorServer, err := s.aggregatorRunner.Configure(s.options, serverConfig, delegate, s.scheme, builders)
		if err != nil {
			return err
		}
		// we are running with KubernetesAggregator FT set to true but with enterprise unlinked, handle this gracefully
		if aggregatorServer != nil {
			if !isDataplaneAggregatorEnabled {
				runningServer, err = s.aggregatorRunner.Run(ctx, transport, s.stoppedCh)
				if err != nil {
					s.log.Error("aggregator runner failed to run", "error", err)
					return err
				}
			} else {
				delegate = aggregatorServer
			}
		} else {
			// even though the FT is set to true, enterprise isn't linked
			isKubernetesAggregatorEnabled = false
		}
	}

	if isDataplaneAggregatorEnabled {
		runningServer, err = s.startDataplaneAggregator(ctx, transport, serverConfig, delegate)
		if err != nil {
			return err
		}
	}

	if !isDataplaneAggregatorEnabled && !isKubernetesAggregatorEnabled {
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
	transport *grafanaapiserveroptions.RoundTripperFunc,
	server *genericapiserver.GenericAPIServer,
) (*genericapiserver.GenericAPIServer, error) {
	// setup the loopback transport and signal that it's ready.
	// ignore the lint error because the response is passed directly to the client,
	// so the client will be responsible for closing the response body.
	// nolint:bodyclose
	transport.Fn = grafanaresponsewriter.WrapHandler(server.Handler)
	close(transport.Ready)

	prepared := server.PrepareRun()
	go func() {
		s.stoppedCh <- prepared.RunWithContext(ctx)
	}()

	return server, nil
}

func (s *service) startDataplaneAggregator(
	ctx context.Context,
	transport *grafanaapiserveroptions.RoundTripperFunc,
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
	transport.Fn = grafanaresponsewriter.WrapHandler(aggregatorServer.GenericAPIServer.Handler)
	close(transport.Ready)

	prepared, err := aggregatorServer.PrepareRun()
	if err != nil {
		return nil, err
	}

	go func() {
		s.stoppedCh <- prepared.RunWithContext(ctx)
	}()

	return aggregatorServer.GenericAPIServer, nil
}

func (s *service) GetDirectRestConfig(c *contextmodel.ReqContext) *clientrest.Config {
	return &clientrest.Config{
		Transport: &grafanaapiserveroptions.RoundTripperFunc{
			Fn: func(req *http.Request) (*http.Response, error) {
				if err := s.AwaitRunning(req.Context()); err != nil {
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
	if err := s.AwaitRunning(r.Context()); err != nil {
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

func useNamespaceFromPath(path string, user *user.SignedInUser) {
	if strings.HasPrefix(path, "/apis/") && len(path) > 6 {
		parts := strings.Split(path[6:], "/")
		if len(parts) >= 4 && parts[2] == "namespaces" {
			ns, err := types.ParseNamespace(parts[3])
			if err == nil {
				user.Namespace = ns.Value
				user.OrgID = ns.OrgID
			}
		}
	}
}
