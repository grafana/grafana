package sql

import (
	"context"
	"errors"
	"fmt"
	"hash/fnv"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/grafana/authlib/grpcutils"
	"github.com/grafana/dskit/kv"
	"github.com/grafana/dskit/ring"
	"github.com/grafana/dskit/services"
	infraDB "github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/services/authz"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"github.com/grafana/grafana/pkg/storage/unified/resource/grpc"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	"github.com/grafana/grafana/pkg/util/scheduler"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc/health/grpc_health_v1"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

var (
	//_ UnifiedGrpcService = (*service)(nil)
	_ UnifiedGrpcService = (*searchService)(nil)
	_ UnifiedGrpcService = (*storageService)(nil)
)

type UnifiedGrpcService interface {
	services.NamedService

	// Return the address where this service is running
	GetAddress() string
}

type service struct {
	*services.BasicService

	backend        resource.StorageBackend
	cfg            *setting.Cfg
	features       featuremgmt.FeatureToggles
	stopCh         chan struct{}
	stoppedCh      chan error
	authenticator  func(context.Context) (context.Context, error)
	tracing        trace.Tracer
	db             infraDB.DB
	log            log.Logger
	reg            prometheus.Registerer
	docBuilders    resource.DocumentBuilderSupplier
	storageMetrics *resource.StorageMetrics
	indexMetrics   *resource.BleveIndexMetrics
	searchRing     *ring.Ring

	// Handler for the gRPC server
	handler grpcserver.Provider

	// Ring lifecycle and sharding support
	ringLifecycler *ring.BasicLifecycler

	// QoS support
	queue     QOSEnqueueDequeuer
	scheduler *scheduler.Scheduler

	// Subservices management
	hasSubservices     bool
	subservices        *services.Manager
	subservicesWatcher *services.FailureWatcher
}

// ProvideUnifiedStorageGrpcService provides a combined storage and search service running on the same gRPC server.
// This is used when running Grafana as a monolith where both services share the same process.
// Each service (storage and search) maintains its own lifecycle but shares the gRPC server.
func ProvideUnifiedStorageGrpcService(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	db infraDB.DB,
	log log.Logger,
	reg prometheus.Registerer,
	docBuilders resource.DocumentBuilderSupplier,
	storageMetrics *resource.StorageMetrics,
	indexMetrics *resource.BleveIndexMetrics,
	searchRing *ring.Ring,
	memberlistKVConfig kv.Config,
	httpServerRouter *mux.Router,
	backend resource.StorageBackend,
) (UnifiedGrpcService, error) {
	var err error
	tracer := otel.Tracer("unified-storage-combined")

	// FIXME: This is a temporary solution while we are migrating to the new authn interceptor
	// grpcutils.NewGrpcAuthenticator should be used instead.
	authn := NewAuthenticatorWithFallback(cfg, reg, tracer, func(ctx context.Context) (context.Context, error) {
		auth := grpc.Authenticator{Tracer: tracer}
		return auth.Authenticate(ctx)
	})

	s := &service{
		backend:            backend,
		cfg:                cfg,
		features:           features,
		stopCh:             make(chan struct{}),
		stoppedCh:          make(chan error, 1),
		authenticator:      authn,
		tracing:            tracer,
		db:                 db,
		log:                log,
		reg:                reg,
		docBuilders:        docBuilders,
		storageMetrics:     storageMetrics,
		indexMetrics:       indexMetrics,
		searchRing:         searchRing,
		subservicesWatcher: services.NewFailureWatcher(),
	}

	subservices := []services.Service{}
	if cfg.EnableSharding {
		ringStore, err := kv.NewClient(
			memberlistKVConfig,
			ring.GetCodec(),
			kv.RegistererWithKVName(reg, resource.RingName),
			log,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to create KV store client: %s", err)
		}

		lifecyclerCfg, err := toLifecyclerConfig(cfg, log)
		if err != nil {
			return nil, fmt.Errorf("failed to initialize storage-ring lifecycler config: %s", err)
		}

		// Define lifecycler delegates in reverse order (last to be called defined first because they're
		// chained via "next delegate").
		delegate := ring.BasicLifecyclerDelegate(ring.NewInstanceRegisterDelegate(ring.JOINING, resource.RingNumTokens))
		delegate = ring.NewLeaveOnStoppingDelegate(delegate, log)
		delegate = ring.NewAutoForgetDelegate(resource.RingHeartbeatTimeout*2, delegate, log)

		s.ringLifecycler, err = ring.NewBasicLifecycler(
			lifecyclerCfg,
			resource.RingName,
			resource.RingKey,
			ringStore,
			delegate,
			log,
			reg,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to initialize storage-ring lifecycler: %s", err)
		}

		s.ringLifecycler.SetKeepInstanceInTheRingOnShutdown(true)
		subservices = append(subservices, s.ringLifecycler)

		if httpServerRouter != nil {
			httpServerRouter.Path("/prepare-downscale").Methods("GET", "POST", "DELETE").Handler(http.HandlerFunc(s.PrepareDownscale))
		}
	}

	if cfg.QOSEnabled {
		qosReg := prometheus.WrapRegistererWithPrefix("resource_server_qos_", reg)
		queue := scheduler.NewQueue(&scheduler.QueueOptions{
			MaxSizePerTenant: cfg.QOSMaxSizePerTenant,
			Registerer:       qosReg,
		})
		sched, err := scheduler.NewScheduler(queue, &scheduler.Config{
			NumWorkers: cfg.QOSNumberWorker,
			Logger:     log,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to create qos scheduler: %s", err)
		}

		s.queue = queue
		s.scheduler = sched
		subservices = append(subservices, s.queue, s.scheduler)
	}

	if len(subservices) > 0 {
		s.hasSubservices = true
		s.subservices, err = services.NewManager(subservices...)
		if err != nil {
			return nil, fmt.Errorf("failed to create subservices manager: %w", err)
		}
	}

	// This will be used when running as a dskit service
	// Note: We use StorageServer as the module name for backward compatibility
	s.BasicService = services.NewBasicService(s.starting, s.running, s.stopping).WithName(modules.StorageServer)

	return s, nil
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
	if s.hasSubservices {
		s.subservicesWatcher.WatchManager(s.subservices)
		if err := services.StartManagerAndAwaitHealthy(ctx, s.subservices); err != nil {
			return fmt.Errorf("failed to start subservices: %w", err)
		}
	}

	authzClient, err := authz.ProvideStandaloneAuthZClient(s.cfg, s.features, s.tracing, s.reg)
	if err != nil {
		return err
	}

	// Setup overrides service if enabled
	var overridesSvc *resource.OverridesService
	if s.cfg.OverridesFilePath != "" {
		overridesSvc, err = resource.NewOverridesService(context.Background(), s.log, s.reg, s.tracing, resource.ReloadOptions{
			FilePath:     s.cfg.OverridesFilePath,
			ReloadPeriod: s.cfg.OverridesReloadInterval,
		})
		if err != nil {
			return err
		}
	}

	// Ensure we have a backend - create one if needed
	// This is critical: we create the backend ONCE and share it between search and storage servers
	// to avoid duplicate metrics registration
	backend := s.backend
	if backend == nil {
		eDB, err := dbimpl.ProvideResourceDB(s.db, s.cfg, s.tracing)
		if err != nil {
			return fmt.Errorf("failed to create resource DB: %w", err)
		}

		isHA := isHighAvailabilityEnabled(s.cfg.SectionWithEnvOverrides("database"),
			s.cfg.SectionWithEnvOverrides("resource_api"))

		b, err := NewBackend(BackendOptions{
			DBProvider:           eDB,
			Reg:                  s.reg,
			IsHA:                 isHA,
			storageMetrics:       s.storageMetrics,
			LastImportTimeMaxAge: s.cfg.MaxFileIndexAge,
		})
		if err != nil {
			return fmt.Errorf("failed to create backend: %w", err)
		}

		// Initialize the backend
		if err := b.Init(context.Background()); err != nil {
			return fmt.Errorf("failed to initialize backend: %w", err)
		}
		backend = b
	}

	var searchServer resource.SearchServer
	if s.cfg.EnableSearch {
		// Create search options for the search server
		searchOptions, err := search.NewSearchOptions(s.cfg, s.docBuilders, s.indexMetrics, s.OwnsIndex)
		if err != nil {
			return err
		}

		// Create the search server - pass the shared backend
		searchServer, err = NewSearchServer(SearchServerOptions{
			Backend:       backend, // Use the shared backend
			DB:            s.db,
			Cfg:           s.cfg,
			Tracer:        s.tracing,
			Reg:           s.reg,
			AccessClient:  authzClient,
			SearchOptions: searchOptions,
			IndexMetrics:  s.indexMetrics,
			OwnsIndexFn:   s.OwnsIndex,
		})
		if err != nil {
			return err
		}
	}

	// Create the storage server - pass the shared backend
	storageServer, err := NewStorageServer(&StorageServerOptions{
		Backend:          backend, // Use the shared backend
		OverridesService: overridesSvc,
		DB:               s.db,
		Cfg:              s.cfg,
		Tracer:           s.tracing,
		Reg:              s.reg,
		AccessClient:     authzClient,
		StorageMetrics:   s.storageMetrics,
		Features:         s.features,
		QOSQueue:         s.queue,
	})
	if err != nil {
		return err
	}

	s.handler, err = grpcserver.ProvideService(s.cfg, s.features, interceptors.AuthenticatorFunc(s.authenticator), s.tracing, prometheus.DefaultRegisterer)
	if err != nil {
		return err
	}

	healthService, err := resource.ProvideHealthService(storageServer)
	if err != nil {
		return err
	}

	srv := s.handler.GetServer()
	// Register storage services
	resourcepb.RegisterResourceStoreServer(srv, storageServer)
	resourcepb.RegisterBulkStoreServer(srv, storageServer)
	resourcepb.RegisterBlobStoreServer(srv, storageServer)
	resourcepb.RegisterDiagnosticsServer(srv, storageServer)
	resourcepb.RegisterQuotasServer(srv, storageServer)
	// Register search services
	resourcepb.RegisterResourceIndexServer(srv, searchServer)
	resourcepb.RegisterManagedObjectIndexServer(srv, searchServer)
	grpc_health_v1.RegisterHealthServer(srv, healthService)

	// register reflection service
	_, err = grpcserver.ProvideReflectionService(s.cfg, s.handler)
	if err != nil {
		return err
	}

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

	// start the gRPC server
	go func() {
		err := s.handler.Run(ctx)
		if err != nil {
			s.stoppedCh <- err
		} else {
			s.stoppedCh <- nil
		}
	}()
	return nil
}

// GetAddress returns the address of the gRPC server.
func (s *service) GetAddress() string {
	return s.handler.GetAddress()
}

func (s *service) running(ctx context.Context) error {
	select {
	case err := <-s.stoppedCh:
		if err != nil && !errors.Is(err, context.Canceled) {
			return err
		}
	case err := <-s.subservicesWatcher.Chan():
		return fmt.Errorf("subservice failure: %w", err)
	case <-ctx.Done():
		close(s.stopCh)
	}
	return nil
}

func (s *service) stopping(_ error) error {
	if s.hasSubservices {
		err := services.StopManagerAndAwaitStopped(context.Background(), s.subservices)
		if err != nil {
			return fmt.Errorf("failed to stop subservices: %w", err)
		}
	}
	return nil
}

type authenticatorWithFallback struct {
	authenticator func(ctx context.Context) (context.Context, error)
	fallback      func(ctx context.Context) (context.Context, error)
	metrics       *metrics
	tracer        trace.Tracer
}

type metrics struct {
	requestsTotal *prometheus.CounterVec
}

func (f *authenticatorWithFallback) Authenticate(ctx context.Context) (context.Context, error) {
	ctx, span := f.tracer.Start(ctx, "grpcutils.AuthenticatorWithFallback.Authenticate")
	defer span.End()

	// Try to authenticate with the new authenticator first
	span.SetAttributes(attribute.Bool("fallback_used", false))
	newCtx, err := f.authenticator(ctx)
	if err == nil {
		// fallback not used, authentication successful
		f.metrics.requestsTotal.WithLabelValues("false", "true").Inc()
		return newCtx, nil
	}

	// In case of error, fallback to the legacy authenticator
	span.SetAttributes(attribute.Bool("fallback_used", true))
	newCtx, err = f.fallback(ctx)
	if newCtx != nil {
		newCtx = resource.WithFallback(newCtx)
	}
	f.metrics.requestsTotal.WithLabelValues("true", fmt.Sprintf("%t", err == nil)).Inc()
	return newCtx, err
}

func newMetrics(reg prometheus.Registerer) *metrics {
	return &metrics{
		requestsTotal: promauto.With(reg).NewCounterVec(
			prometheus.CounterOpts{
				Name: "grafana_grpc_authenticator_with_fallback_requests_total",
				Help: "Number requests using the authenticator with fallback",
			}, []string{"fallback_used", "result"}),
	}
}

func ReadGrpcServerConfig(cfg *setting.Cfg) *grpcutils.AuthenticatorConfig {
	section := cfg.SectionWithEnvOverrides("grpc_server_authentication")

	return &grpcutils.AuthenticatorConfig{
		SigningKeysURL:   section.Key("signing_keys_url").MustString(""),
		AllowedAudiences: section.Key("allowed_audiences").Strings(","),
		AllowInsecure:    cfg.Env == setting.Dev,
	}
}

func NewAuthenticatorWithFallback(cfg *setting.Cfg, reg prometheus.Registerer, tracer trace.Tracer, fallback func(context.Context) (context.Context, error)) func(context.Context) (context.Context, error) {
	authCfg := ReadGrpcServerConfig(cfg)
	authenticator := grpcutils.NewAuthenticator(authCfg, tracer)
	metrics := newMetrics(reg)
	return func(ctx context.Context) (context.Context, error) {
		a := &authenticatorWithFallback{
			authenticator: authenticator,
			fallback:      fallback,
			tracer:        tracer,
			metrics:       metrics,
		}
		return a.Authenticate(ctx)
	}
}
