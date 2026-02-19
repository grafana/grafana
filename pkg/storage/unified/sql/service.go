package sql

import (
	"context"
	"fmt"
	"hash/fnv"
	"net"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	grpcauth "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/auth"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc/health/grpc_health_v1"

	"github.com/grafana/authlib/grpcutils"
	"github.com/grafana/dskit/kv"
	"github.com/grafana/dskit/netutil"
	"github.com/grafana/dskit/ring"
	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/services/authz"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search"
	"github.com/grafana/grafana/pkg/util/scheduler"
)

var (
	_ resource.UnifiedStorageGrpcService = (*service)(nil)
)

type service struct {
	*services.BasicService

	// Subservices manager
	subservices        []services.Service
	subservicesMngr    *services.Manager
	subservicesWatcher *services.FailureWatcher

	// -- Shared Components
	backend       resource.StorageBackend
	serverStopper resource.ResourceServerStopper
	cfg           *setting.Cfg
	features      featuremgmt.FeatureToggles
	log           log.Logger
	reg           prometheus.Registerer
	tracing       trace.Tracer

	// -- Storage Services
	queue          QOSEnqueueDequeuer
	storageMetrics *resource.StorageMetrics
	scheduler      *scheduler.Scheduler
	searchClient   resourcepb.ResourceIndexClient

	// -- Search Services
	docBuilders      resource.DocumentBuilderSupplier
	indexMetrics     *resource.BleveIndexMetrics
	searchRing       *ring.Ring
	ringLifecycler   *ring.BasicLifecycler // Ring state for sharding
	searchStandalone bool
	authenticator    interceptors.AuthenticatorFunc
}

// ProvideSearchGRPCService provides a gRPC service that only serves search requests.
// ServiceOption allows customizing service behavior
type ServiceOption func(*service)

// WithAuthenticator sets a custom authenticator for the service
// This is primarily intended for testing scenarios
func WithAuthenticator(authn func(ctx context.Context) (context.Context, error)) ServiceOption {
	return func(s *service) {
		s.authenticator = authn
	}
}

func ProvideSearchGRPCService(cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	log log.Logger,
	reg prometheus.Registerer,
	docBuilders resource.DocumentBuilderSupplier,
	indexMetrics *resource.BleveIndexMetrics,
	searchRing *ring.Ring,
	memberlistKVConfig kv.Config,
	httpServerRouter *mux.Router,
	backend resource.StorageBackend,
	provider grpcserver.Provider,
	opts ...ServiceOption,
) (resource.UnifiedStorageGrpcService, error) {
	s := newService(cfg, features, log, reg, otel.Tracer("unified-storage"), docBuilders, nil, indexMetrics, searchRing, backend, nil)
	for _, opt := range opts {
		opt(s)
	}
	s.searchStandalone = true
	if cfg.EnableSharding {
		err := s.withRingLifecycle(memberlistKVConfig, httpServerRouter)
		if err != nil {
			return nil, err
		}
		err = s.initializeSubservicesManager()
		if err != nil {
			return nil, fmt.Errorf("failed to initialize subservices manager: %w", err)
		}
	}

	if err := s.registerServer(provider); err != nil {
		return nil, err
	}

	s.BasicService = services.NewBasicService(s.starting, s.running, s.stopping).WithName(modules.SearchServer)
	return s, nil
}

func ProvideUnifiedStorageGrpcService(cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	log log.Logger,
	reg prometheus.Registerer,
	docBuilders resource.DocumentBuilderSupplier,
	storageMetrics *resource.StorageMetrics,
	indexMetrics *resource.BleveIndexMetrics,
	searchRing *ring.Ring,
	memberlistKVConfig kv.Config,
	httpServerRouter *mux.Router,
	backend resource.StorageBackend,
	searchClient resourcepb.ResourceIndexClient,
	provider grpcserver.Provider,
	opts ...ServiceOption,
) (resource.UnifiedStorageGrpcService, error) {
	s := newService(cfg, features, log, reg, otel.Tracer("unified-storage"), docBuilders, storageMetrics, indexMetrics, searchRing, backend, searchClient)
	for _, opt := range opts {
		opt(s)
	}

	// TODO: move to standalone search once we only use sharding in search servers
	if cfg.EnableSharding {
		err := s.withRingLifecycle(memberlistKVConfig, httpServerRouter)
		if err != nil {
			return nil, err
		}
	}

	if cfg.QOSEnabled {
		qosReg := prometheus.WrapRegistererWithPrefix("resource_server_qos_", reg)
		queue := scheduler.NewQueue(&scheduler.QueueOptions{
			MaxSizePerTenant: cfg.QOSMaxSizePerTenant,
			Registerer:       qosReg,
		})
		scheduler, err := scheduler.NewScheduler(queue, &scheduler.Config{
			NumWorkers: cfg.QOSNumberWorker,
			Logger:     log,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to create qos scheduler: %s", err)
		}

		s.queue = queue
		s.scheduler = scheduler
		s.subservices = append(s.subservices, s.queue, s.scheduler)
	}

	err := s.initializeSubservicesManager()
	if err != nil {
		return nil, fmt.Errorf("failed to initialize subservices manager: %w", err)
	}

	if err := s.registerServer(provider); err != nil {
		return nil, err
	}

	s.BasicService = services.NewBasicService(s.starting, s.running, s.stopping).WithName(modules.StorageServer)
	return s, nil
}

func newService(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	log log.Logger,
	reg prometheus.Registerer,
	tracer trace.Tracer,
	docBuilders resource.DocumentBuilderSupplier,
	storageMetrics *resource.StorageMetrics,
	indexMetrics *resource.BleveIndexMetrics,
	searchRing *ring.Ring,
	backend resource.StorageBackend,
	searchClient resourcepb.ResourceIndexClient,
) *service {
	authn := grpcutils.NewAuthenticator(ReadGrpcServerConfig(cfg), tracer)

	return &service{
		backend:            backend,
		cfg:                cfg,
		features:           features,
		authenticator:      authn,
		tracing:            tracer,
		log:                log,
		reg:                reg,
		docBuilders:        docBuilders,
		storageMetrics:     storageMetrics,
		indexMetrics:       indexMetrics,
		searchRing:         searchRing,
		searchClient:       searchClient,
		subservicesWatcher: services.NewFailureWatcher(),
	}
}

func (s *service) initializeSubservicesManager() error {
	if len(s.subservices) == 0 {
		return nil
	}
	var err error
	s.subservicesMngr, err = services.NewManager(s.subservices...)
	if err != nil {
		return fmt.Errorf("failed to create subservices manager: %w", err)
	}
	return nil
}

func (s *service) withRingLifecycle(memberlistKVConfig kv.Config, httpServerRouter *mux.Router) error {
	ringStore, err := kv.NewClient(
		memberlistKVConfig,
		ring.GetCodec(),
		kv.RegistererWithKVName(s.reg, resource.RingName),
		s.log,
	)
	if err != nil {
		return fmt.Errorf("failed to create KV store client: %w", err)
	}

	lifecyclerCfg, err := toLifecyclerConfig(s.cfg, s.log)
	if err != nil {
		return fmt.Errorf("failed to initialize storage-ring lifecycler config: %w", err)
	}

	// Define lifecycler delegates in reverse order (last to be called defined first because they're
	// chained via "next delegate").
	delegate := ring.BasicLifecyclerDelegate(ring.NewInstanceRegisterDelegate(ring.JOINING, resource.RingNumTokens))
	delegate = ring.NewLeaveOnStoppingDelegate(delegate, s.log)
	delegate = ring.NewAutoForgetDelegate(resource.RingHeartbeatTimeout*2, delegate, s.log)

	s.ringLifecycler, err = ring.NewBasicLifecycler(
		lifecyclerCfg,
		resource.RingName,
		resource.RingKey,
		ringStore,
		delegate,
		s.log,
		s.reg,
	)
	if err != nil {
		return fmt.Errorf("failed to initialize storage-ring lifecycler: %w", err)
	}

	s.ringLifecycler.SetKeepInstanceInTheRingOnShutdown(true)
	if httpServerRouter != nil {
		httpServerRouter.Path("/prepare-downscale").Methods("GET", "POST", "DELETE").Handler(http.HandlerFunc(s.PrepareDownscale))
	}
	s.subservices = append(s.subservices, s.ringLifecycler)
	return nil
}

func (s *service) PrepareDownscale(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		s.log.Info("Preparing for downscale. Will not keep instance in ring on shutdown.")
		s.ringLifecycler.SetKeepInstanceInTheRingOnShutdown(false)
	case http.MethodDelete:
		s.log.Info("Downscale canceled. Will keep instance in ring on shutdown.")
		s.ringLifecycler.SetKeepInstanceInTheRingOnShutdown(true)
	case http.MethodGet:
		// used for delayed downscale use case, which we don't support. Leaving here for completion sake
		s.log.Info("Received GET request for prepare-downscale. Behavior not implemented.")
	default:
	}
}

var (
	// operation used by the search-servers to check if they own the namespace
	searchOwnerRead = ring.NewOp([]ring.InstanceState{ring.JOINING, ring.ACTIVE, ring.LEAVING}, nil)
)

func (s *service) OwnsIndex(key resource.NamespacedResource) (bool, error) {
	if s.searchRing == nil {
		return true, nil
	}

	if st := s.searchRing.State(); st != services.Running {
		return false, fmt.Errorf("ring is not Running: %s", st)
	}

	ringHasher := fnv.New32a()
	_, err := ringHasher.Write([]byte(key.Namespace))
	if err != nil {
		return false, fmt.Errorf("error hashing namespace: %w", err)
	}

	rs, err := s.searchRing.GetWithOptions(ringHasher.Sum32(), searchOwnerRead, ring.WithReplicationFactor(s.searchRing.ReplicationFactor()))
	if err != nil {
		return false, fmt.Errorf("error getting replicaset from ring: %w", err)
	}

	return rs.Includes(s.ringLifecycler.GetInstanceAddr()), nil
}

func (s *service) starting(ctx context.Context) error {
	if s.subservicesMngr != nil {
		s.subservicesWatcher.WatchManager(s.subservicesMngr)
		if err := services.StartManagerAndAwaitHealthy(ctx, s.subservicesMngr); err != nil {
			return fmt.Errorf("failed to start subservices: %w", err)
		}
	}

	// TODO: move to standalone mode once we use sharding in search servers
	if s.cfg.EnableSharding {
		s.log.Info("waiting until resource server is JOINING in the ring")
		lfcCtx, cancel := context.WithTimeout(context.Background(), s.cfg.ResourceServerJoinRingTimeout)
		defer cancel()
		if err := ring.WaitInstanceState(lfcCtx, s.searchRing, s.ringLifecycler.GetInstanceID(), ring.JOINING); err != nil {
			return fmt.Errorf("error switching to JOINING in the ring: %s", err)
		}
		s.log.Info("resource server is JOINING in the ring")

		if err := s.ringLifecycler.ChangeState(ctx, ring.ACTIVE); err != nil {
			return fmt.Errorf("error switching to ACTIVE in the ring: %s", err)
		}
		s.log.Info("resource server is ACTIVE in the ring")
	}

	return nil
}

// registerServer creates the resource/search server and registers the gRPC services on the provided server.
func (s *service) registerServer(provider grpcserver.Provider) error {
	authzClient, err := authz.ProvideStandaloneAuthZClient(s.cfg, s.features, s.tracing, s.reg)
	if err != nil {
		return err
	}

	searchOptions, err := search.NewSearchOptions(s.features, s.cfg, s.docBuilders, s.indexMetrics, s.OwnsIndex)
	if err != nil {
		return err
	}

	serverOptions := ServerOptions{
		Backend:        s.backend,
		Cfg:            s.cfg,
		Tracer:         s.tracing,
		Reg:            s.reg,
		AccessClient:   authzClient,
		SearchOptions:  searchOptions,
		SearchClient:   s.searchClient,
		StorageMetrics: s.storageMetrics,
		IndexMetrics:   s.indexMetrics,
		Features:       s.features,
		QOSQueue:       s.queue,
		OwnsIndexFn:    s.OwnsIndex,
	}

	if !s.searchStandalone && s.cfg.OverridesFilePath != "" {
		overridesSvc, err := resource.NewOverridesService(context.Background(), s.log, s.reg, s.tracing, resource.ReloadOptions{
			FilePath:     s.cfg.OverridesFilePath,
			ReloadPeriod: s.cfg.OverridesReloadInterval,
		})
		if err != nil {
			return err
		}
		serverOptions.OverridesService = overridesSvc
	}

	return s.createAndRegisterServer(provider, serverOptions)
}

func (s *service) running(ctx context.Context) error {
	select {
	case err := <-s.subservicesWatcher.Chan():
		return fmt.Errorf("subservice failure: %w", err)
	case <-ctx.Done():
		s.log.Info("Stopping resource server")
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := s.serverStopper.Stop(ctx); err != nil {
			s.log.Warn("Failed to stop resource server", "error", err)
		} else {
			s.log.Info("Resource server stopped")
		}

		return nil
	}
}

func (s *service) stopping(_ error) error {
	if s.subservicesMngr != nil {
		err := services.StopManagerAndAwaitStopped(context.Background(), s.subservicesMngr)
		if err != nil {
			return fmt.Errorf("failed to stop subservices: %w", err)
		}
	}
	return nil
}

func ReadGrpcServerConfig(cfg *setting.Cfg) *grpcutils.AuthenticatorConfig {
	section := cfg.SectionWithEnvOverrides("grpc_server_authentication")

	return &grpcutils.AuthenticatorConfig{
		SigningKeysURL:   section.Key("signing_keys_url").MustString(""),
		AllowedAudiences: section.Key("allowed_audiences").Strings(","),
		AllowInsecure:    cfg.Env == setting.Dev,
	}
}

func toLifecyclerConfig(cfg *setting.Cfg, logger log.Logger) (ring.BasicLifecyclerConfig, error) {
	instanceAddr, err := ring.GetInstanceAddr(cfg.MemberlistBindAddr, netutil.PrivateNetworkInterfacesWithFallback([]string{"eth0", "en0"}, logger), logger, true)
	if err != nil {
		return ring.BasicLifecyclerConfig{}, err
	}

	instanceId := cfg.InstanceID
	if instanceId == "" {
		hostname, err := os.Hostname()
		if err != nil {
			return ring.BasicLifecyclerConfig{}, err
		}

		instanceId = hostname
	}

	_, grpcPortStr, err := net.SplitHostPort(cfg.GRPCServer.Address)
	if err != nil {
		return ring.BasicLifecyclerConfig{}, fmt.Errorf("could not get grpc port from grpc server address: %s", err)
	}

	grpcPort, err := strconv.Atoi(grpcPortStr)
	if err != nil {
		return ring.BasicLifecyclerConfig{}, fmt.Errorf("error converting grpc address port to int: %s", err)
	}

	return ring.BasicLifecyclerConfig{
		Addr:                fmt.Sprintf("%s:%d", instanceAddr, grpcPort),
		ID:                  instanceId,
		HeartbeatPeriod:     15 * time.Second,
		HeartbeatTimeout:    resource.RingHeartbeatTimeout,
		TokensObservePeriod: 0,
		NumTokens:           resource.RingNumTokens,
	}, nil
}

func (s *service) createAndRegisterServer(provider grpcserver.Provider, opts ServerOptions) error {
	if s.searchStandalone {
		server, err := NewSearchServer(opts)
		if err != nil {
			return err
		}
		s.serverStopper = server
		return s.registerSearchServer(provider, server)
	}
	server, err := NewResourceServer(opts)
	if err != nil {
		return err
	}
	s.serverStopper = server
	return s.registerUnifiedResourceServer(provider, server)
}

// searchServerWithAuth wraps a SearchServer with per-service authentication.
type searchServerWithAuth struct {
	resource.SearchServer
	*interceptors.ServiceWithAuth
}

var _ grpcauth.ServiceAuthFuncOverride = (*searchServerWithAuth)(nil)

func (s *service) registerSearchServer(provider grpcserver.Provider, server resource.SearchServer) error {
	var handler = server
	if sa := interceptors.NewServiceAuth(s.authenticator); sa != nil {
		handler = &searchServerWithAuth{SearchServer: server, ServiceWithAuth: sa}
	}
	srv := provider.GetServer()
	resourcepb.RegisterResourceIndexServer(srv, handler)
	resourcepb.RegisterManagedObjectIndexServer(srv, handler)
	resourcepb.RegisterDiagnosticsServer(srv, handler)
	return s.registerHealthAndReflection(provider, server)
}

// resourceServerWithAuth wraps a ResourceServer with per-service authentication.
type resourceServerWithAuth struct {
	resource.ResourceServer
	*interceptors.ServiceWithAuth
}

var _ grpcauth.ServiceAuthFuncOverride = (*resourceServerWithAuth)(nil)

func (s *service) registerUnifiedResourceServer(provider grpcserver.Provider, server resource.ResourceServer) error {
	var handler = server
	if sa := interceptors.NewServiceAuth(s.authenticator); sa != nil {
		handler = &resourceServerWithAuth{ResourceServer: server, ServiceWithAuth: sa}
	}
	// Register storage services
	srv := provider.GetServer()
	resourcepb.RegisterResourceStoreServer(srv, handler)
	resourcepb.RegisterBulkStoreServer(srv, handler)
	resourcepb.RegisterBlobStoreServer(srv, handler)
	resourcepb.RegisterDiagnosticsServer(srv, handler)
	resourcepb.RegisterQuotasServer(srv, handler)
	// Register search services
	resourcepb.RegisterResourceIndexServer(srv, handler)
	resourcepb.RegisterManagedObjectIndexServer(srv, handler)
	return s.registerHealthAndReflection(provider, server)
}

// registerHealthAndReflection registers the health check and reflection services on the gRPC server.
func (s *service) registerHealthAndReflection(provider grpcserver.Provider, healthChecker resourcepb.DiagnosticsServer) error {
	healthService, err := resource.ProvideHealthService(healthChecker)
	if err != nil {
		return err
	}
	srv := provider.GetServer()
	grpc_health_v1.RegisterHealthServer(srv, healthService)
	_, _ = grpcserver.ProvideReflectionService(s.cfg, provider)

	return nil
}
