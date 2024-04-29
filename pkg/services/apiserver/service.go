package apiserver

import (
	"context"
	"fmt"
	"net/http"
	"path"

	"github.com/grafana/dskit/services"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/responsewriter"
	genericapiserver "k8s.io/apiserver/pkg/server"
	clientrest "k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/kube-openapi/pkg/common"

	playlist "github.com/grafana/grafana/apps/playlist"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apiserver/builder"
	grafanaresponsewriter "github.com/grafana/grafana/pkg/apiserver/endpoints/responsewriter"
	filestorage "github.com/grafana/grafana/pkg/apiserver/storage/file"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/apiserver/aggregator"
	"github.com/grafana/grafana/pkg/services/apiserver/auth/authenticator"
	"github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	grafanaapiserveroptions "github.com/grafana/grafana/pkg/services/apiserver/options"
	entitystorage "github.com/grafana/grafana/pkg/services/apiserver/storage/entity"
	"github.com/grafana/grafana/pkg/services/apiserver/utils"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/store/entity/db/dbimpl"
	"github.com/grafana/grafana/pkg/services/store/entity/sqlstash"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ Service                    = (*service)(nil)
	_ RestConfigProvider         = (*service)(nil)
	_ registry.BackgroundService = (*service)(nil)
	_ registry.CanBeDisabled     = (*service)(nil)
)

type Service interface {
	services.NamedService
	registry.BackgroundService
	registry.CanBeDisabled
}

type RestConfigProvider interface {
	GetRestConfig() *clientrest.Config
}

type DirectRestConfigProvider interface {
	// GetDirectRestConfig returns a k8s client configuration that will use the same
	// logged logged in user as the current request context.  This is useful when
	// creating clients that map legacy API handlers to k8s backed services
	GetDirectRestConfig(c *contextmodel.ReqContext) *clientrest.Config

	// This can be used to rewrite incoming requests to path now supported under /apis
	DirectlyServeHTTP(w http.ResponseWriter, r *http.Request)
}

type service struct {
	*services.BasicService

	options    *grafanaapiserveroptions.Options
	restConfig *clientrest.Config

	cfg      *setting.Cfg
	features featuremgmt.FeatureToggles

	stopCh    chan struct{}
	stoppedCh chan error

	db       db.DB
	rr       routing.RouteRegister
	handler  http.Handler
	builders []builder.APIGroupBuilder

	tracing *tracing.TracingService

	authorizer *authorizer.GrafanaAuthorizer
}

func ProvideService(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	rr routing.RouteRegister,
	orgService org.Service,
	tracing *tracing.TracingService,
	db db.DB,
) (*service, error) {
	s := &service{
		cfg:        cfg,
		features:   features,
		rr:         rr,
		stopCh:     make(chan struct{}),
		builders:   []builder.APIGroupBuilder{},
		authorizer: authorizer.NewGrafanaAuthorizer(cfg, orgService),
		tracing:    tracing,
		db:         db, // For Unified storage
	}

	// This will be used when running as a dskit service
	s.BasicService = services.NewBasicService(s.start, s.running, nil).WithName(modules.GrafanaAPIServer)

	// TODO: this is very hacky
	// We need to register the routes in ProvideService to make sure
	// the routes are registered before the Grafana HTTP server starts.
	proxyHandler := func(k8sRoute routing.RouteRegister) {
		handler := func(c *contextmodel.ReqContext) {
			if s.handler == nil {
				c.Resp.WriteHeader(404)
				_, _ = c.Resp.Write([]byte("Not found"))
				return
			}

			req := c.Req
			if req.URL.Path == "" {
				req.URL.Path = "/"
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

	return s, nil
}

func (s *service) GetRestConfig() *clientrest.Config {
	return s.restConfig
}

func (s *service) IsDisabled() bool {
	return false
}

// Run is an adapter for the BackgroundService interface.
func (s *service) Run(ctx context.Context) error {
	if err := s.start(ctx); err != nil {
		return err
	}
	return s.running(ctx)
}

func (s *service) RegisterAPI(b builder.APIGroupBuilder) {
	s.builders = append(s.builders, b)
}

func (s *service) start(ctx context.Context) error {
	o := grafanaapiserveroptions.NewOptions(playlist.ResourceGroups()...)

	// Get the list of groups the server will support
	builders := s.builders

	applyGrafanaConfig(s.cfg, s.features, o)

	if errs := o.Validate(); len(errs) != 0 {
		// TODO: handle multiple errors
		return errs[0]
	}

	serverConfig, err := o.APIServerOptions.Config()
	if err != nil {
		return err
	}

	serverConfig.ExtraConfig.OpenAPIDefinitionGetters = []common.GetOpenAPIDefinitions{builder.GetOpenAPIDefinitions(builders)}

	versionPriority := int32(len(aggregator.APIVersionPriorities))
	if s.features.IsEnabledGlobally(featuremgmt.FlagKubernetesAggregator) {
		for _, g := range serverConfig.ExtraConfig.ResourceGroups {
			for _, r := range g.Resources {
				versionPriority += 1
				gv := schema.GroupVersion{
					Group:   r.Kind.Group(),
					Version: r.Kind.Version(),
				}
				// set the priority for the group+version
				aggregator.APIVersionPriorities[gv] = aggregator.Priority{Group: 15000, Version: versionPriority}
			}
		}
	}

	if err := o.ApplyTo(serverConfig.RecommendedConfig); err != nil {
		return err
	}
	// Install schemas
	for _, b := range builders {
		versionPriority += 1
		if err := b.InstallSchema(serverConfig.ExtraConfig.Scheme); err != nil {
			return err
		}

		if s.features.IsEnabledGlobally(featuremgmt.FlagKubernetesAggregator) {
			// set the priority for the group+version
			aggregator.APIVersionPriorities[b.GetGroupVersion()] = aggregator.Priority{Group: 15000, Version: versionPriority}
		}

		auth := b.GetAuthorizer()
		if auth != nil {
			s.authorizer.Register(b.GetGroupVersion(), auth)
		}
	}
	serverConfig.Authorization.Authorizer = s.authorizer
	serverConfig.Authentication.Authenticator = authenticator.NewAuthenticator(serverConfig.Authentication.Authenticator)
	serverConfig.TracerProvider = s.tracing.GetTracerProvider()

	// setup loopback transport for the aggregator server
	transport := &roundTripperFunc{ready: make(chan struct{})}
	serverConfig.LoopbackClientConfig.Transport = transport
	serverConfig.LoopbackClientConfig.TLSClientConfig = clientrest.TLSClientConfig{}

	switch o.StorageOptions.StorageType {
	case grafanaapiserveroptions.StorageTypeEtcd:
		if err := o.RecommendedOptions.Etcd.Validate(); len(err) > 0 {
			return err[0]
		}
		if err := o.RecommendedOptions.Etcd.ApplyTo(&serverConfig.Config); err != nil {
			return err
		}

	case grafanaapiserveroptions.StorageTypeUnified:
		if !s.features.IsEnabledGlobally(featuremgmt.FlagUnifiedStorage) {
			return fmt.Errorf("unified storage requires the unifiedStorage feature flag")
		}

		eDB, err := dbimpl.ProvideEntityDB(s.db, s.cfg, s.features)
		if err != nil {
			return err
		}

		storeServer, err := sqlstash.ProvideSQLEntityServer(eDB, s.tracing)
		if err != nil {
			return err
		}

		store := entity.NewEntityStoreClientLocal(storeServer)

		serverConfig.Config.RESTOptionsGetter = entitystorage.NewRESTOptionsGetter(s.cfg, store, o.RecommendedOptions.Etcd.StorageConfig.Codec)

	case grafanaapiserveroptions.StorageTypeUnifiedGrpc:
		// Create a connection to the gRPC server
		conn, err := grpc.Dial(o.StorageOptions.Address, grpc.WithTransportCredentials(insecure.NewCredentials()))
		if err != nil {
			return err
		}

		// TODO: determine when to close the connection, we cannot defer it here
		// defer conn.Close()

		// Create a client instance
		store := entity.NewEntityStoreClientGRPC(conn)

		serverConfig.Config.RESTOptionsGetter = entitystorage.NewRESTOptionsGetter(s.cfg, store, o.RecommendedOptions.Etcd.StorageConfig.Codec)

	case grafanaapiserveroptions.StorageTypeLegacy:
		fallthrough
	case grafanaapiserveroptions.StorageTypeFile:
		restOptionsGetter, err := filestorage.NewRESTOptionsGetter(o.StorageOptions.DataPath, o.RecommendedOptions.Etcd.StorageConfig)
		if err != nil {
			return err
		}
		serverConfig.RESTOptionsGetter = restOptionsGetter
	}

	// Add OpenAPI specs for each group+version
	err = builder.SetupConfig(
		serverConfig.ExtraConfig.Scheme,
		serverConfig.RecommendedConfig,
		builders,
		s.cfg.BuildStamp,
		s.cfg.BuildVersion,
		s.cfg.BuildCommit,
		s.cfg.BuildBranch,
	)
	if err != nil {
		return err
	}

	// Create the server
	server, err := serverConfig.Complete().NewServer(genericapiserver.NewEmptyDelegate())
	if err != nil {
		return err
	}

	// dual writing is only enabled when the storage type is not legacy.
	// this is needed to support setting a default RESTOptionsGetter for new APIs that don't
	// support the legacy storage type.
	dualWriteEnabled := o.StorageOptions.StorageType != grafanaapiserveroptions.StorageTypeLegacy

	// Install the API group+version
	err = builder.InstallAPIs(serverConfig.ExtraConfig.Scheme, serverConfig.ExtraConfig.Codecs, server.GenericAPIServer, serverConfig.RESTOptionsGetter, builders, dualWriteEnabled)
	if err != nil {
		return err
	}

	// stash the options for later use
	s.options = o

	// example of adding a post start hook
	server.AddPostStartHook("playlist-controller", func(context genericapiserver.PostStartHookContext) error {
		ctrl, err := playlist.NewController(s.restConfig)
		if err != nil {
			return err
		}
		return ctrl.Run(context.StopCh)
	})

	var prepared runnable
	if s.features.IsEnabledGlobally(featuremgmt.FlagKubernetesAggregator) {
		prepared, err = s.prepareAggregator(transport, serverConfig.RecommendedConfig, server.GenericAPIServer)
		if err != nil {
			return err
		}
	} else {
		prepared = s.prepareCoreServer(transport, server.GenericAPIServer)
	}

	// only write kubeconfig in dev mode
	if o.ExtraOptions.DevMode {
		if err := ensureKubeConfig(server.LoopbackClientConfig, o.StorageOptions.DataPath); err != nil {
			return err
		}
	}

	go func() {
		s.stoppedCh <- prepared.Run(s.stopCh)
	}()

	return nil
}

func (s *service) prepareCoreServer(
	transport *roundTripperFunc,
	server *genericapiserver.GenericAPIServer,
) runnable {
	// setup the loopback transport and signal that it's ready.
	// ignore the lint error because the response is passed directly to the client,
	// so the client will be responsible for closing the response body.
	// nolint:bodyclose
	transport.fn = grafanaresponsewriter.WrapHandler(server.Handler)
	close(transport.ready)

	prepared := server.PrepareRun()
	// used by the proxy wrapper registered in ProvideService
	s.handler = server.Handler
	// used by local clients to make requests to the server
	s.restConfig = server.LoopbackClientConfig

	return prepared
}

func (s *service) prepareAggregator(
	transport *roundTripperFunc,
	serverConfig *genericapiserver.RecommendedConfig,
	server *genericapiserver.GenericAPIServer,
) (runnable, error) {
	namespaceMapper := request.GetNamespaceMapper(s.cfg)

	aggregatorConfig, err := aggregator.CreateAggregatorConfig(s.options, *serverConfig, namespaceMapper(1))
	if err != nil {
		return nil, err
	}

	aggregatorServer, err := aggregator.CreateAggregatorServer(aggregatorConfig, server)
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

	// used by the proxy wrapper registered in ProvideService
	s.handler = prepared.GenericAPIServer.Handler
	// used by local clients to make requests to the server
	s.restConfig = prepared.GenericAPIServer.LoopbackClientConfig

	return prepared, nil
}

func (s *service) GetDirectRestConfig(c *contextmodel.ReqContext) *clientrest.Config {
	return &clientrest.Config{
		Transport: &roundTripperFunc{
			fn: func(req *http.Request) (*http.Response, error) {
				ctx := appcontext.WithUser(req.Context(), c.SignedInUser)
				wrapped := grafanaresponsewriter.WrapHandler(s.handler)
				return wrapped(req.WithContext(ctx))
			},
		},
	}
}

func (s *service) DirectlyServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.handler.ServeHTTP(w, r)
}

func (s *service) running(ctx context.Context) error {
	select {
	case err := <-s.stoppedCh:
		if err != nil {
			return err
		}
	case <-ctx.Done():
		close(s.stopCh)
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

type runnable interface {
	Run(stopCh <-chan struct{}) error
}
