package sql

import (
	"context"
	"errors"
	"fmt"
	"hash/fnv"
	"net"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	"github.com/grafana/dskit/netutil"
	"github.com/grafana/grafana/pkg/storage/unified/search"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc/health/grpc_health_v1"

	"github.com/grafana/dskit/kv"
	"github.com/grafana/dskit/ring"
	"github.com/grafana/dskit/services"

	infraDB "github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/services/authz"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resource/grpc"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// operation used by the search-servers to check if they own the namespace
var (
	searchOwnerRead = ring.NewOp([]ring.InstanceState{ring.JOINING, ring.ACTIVE, ring.LEAVING}, nil)
)

type searchService struct {
	*services.BasicService

	backend          resource.StorageBackend
	cfg              *setting.Cfg
	features         featuremgmt.FeatureToggles
	db               infraDB.DB
	stopCh           chan struct{}
	stoppedCh        chan error
	handler          grpcserver.Provider
	tracing          trace.Tracer
	authenticator    func(ctx context.Context) (context.Context, error)
	httpServerRouter *mux.Router

	log          log.Logger
	reg          prometheus.Registerer
	docBuilders  resource.DocumentBuilderSupplier
	indexMetrics *resource.BleveIndexMetrics
	searchRing   *ring.Ring

	// Ring lifecycle and sharding support
	ringLifecycler *ring.BasicLifecycler

	// Subservices manager
	subservices        *services.Manager
	subservicesWatcher *services.FailureWatcher
	hasSubservices     bool
}

func ProvideSearchGrpcService(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	db infraDB.DB,
	log log.Logger,
	reg prometheus.Registerer,
	docBuilders resource.DocumentBuilderSupplier,
	indexMetrics *resource.BleveIndexMetrics,
	searchRing *ring.Ring,
	memberlistKVConfig kv.Config,
	backend resource.StorageBackend,
	httpServerRouter *mux.Router,
) (UnifiedGrpcService, error) {
	var err error
	tracer := otel.Tracer("unified-search-server")

	authn := NewAuthenticatorWithFallback(cfg, reg, tracer, func(ctx context.Context) (context.Context, error) {
		auth := grpc.Authenticator{Tracer: tracer}
		return auth.Authenticate(ctx)
	})

	s := &searchService{
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
		indexMetrics:       indexMetrics,
		searchRing:         searchRing,
		httpServerRouter:   httpServerRouter,
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
			return nil, fmt.Errorf("failed to initialize search-ring lifecycler config: %s", err)
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
			return nil, fmt.Errorf("failed to initialize search-ring lifecycler: %s", err)
		}

		s.ringLifecycler.SetKeepInstanceInTheRingOnShutdown(true)
		subservices = append(subservices, s.ringLifecycler)
	}

	if len(subservices) > 0 {
		s.hasSubservices = true
		s.subservices, err = services.NewManager(subservices...)
		if err != nil {
			return nil, fmt.Errorf("failed to create subservices manager: %w", err)
		}
	}

	// This will be used when running as a dskit service
	s.BasicService = services.NewBasicService(s.starting, s.running, s.stopping).WithName(modules.SearchServer)

	// Register HTTP endpoints if router is provided
	s.RegisterHTTPEndpoints(httpServerRouter)

	return s, nil
}

func (s *searchService) PrepareDownscale(w http.ResponseWriter, r *http.Request) {
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

func (s *searchService) OwnsIndex(key resource.NamespacedResource) (bool, error) {
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

func (s *searchService) starting(ctx context.Context) error {
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

	// Create search options for the search server
	searchOptions, err := search.NewSearchOptions(s.features, s.cfg, s.docBuilders, s.indexMetrics, s.OwnsIndex)
	if err != nil {
		return err
	}

	// Create the search server
	searchServer, err := NewSearchServer(SearchServerOptions{
		Backend:       s.backend,
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

	s.handler, err = grpcserver.ProvideService(s.cfg, s.features, interceptors.AuthenticatorFunc(s.authenticator), s.tracing, prometheus.DefaultRegisterer)
	if err != nil {
		return err
	}

	healthService, err := resource.ProvideHealthService(searchServer)
	if err != nil {
		return err
	}

	srv := s.handler.GetServer()
	// Register search services
	resourcepb.RegisterResourceIndexServer(srv, searchServer)
	resourcepb.RegisterManagedObjectIndexServer(srv, searchServer)
	resourcepb.RegisterDiagnosticsServer(srv, searchServer)
	grpc_health_v1.RegisterHealthServer(srv, healthService)

	// register reflection service
	_, err = grpcserver.ProvideReflectionService(s.cfg, s.handler)
	if err != nil {
		return err
	}

	if s.cfg.EnableSharding {
		s.log.Info("waiting until search server is JOINING in the ring")
		lfcCtx, cancel := context.WithTimeout(context.Background(), s.cfg.ResourceServerJoinRingTimeout)
		defer cancel()
		if err := ring.WaitInstanceState(lfcCtx, s.searchRing, s.ringLifecycler.GetInstanceID(), ring.JOINING); err != nil {
			return fmt.Errorf("error switching to JOINING in the ring: %s", err)
		}
		s.log.Info("search server is JOINING in the ring")

		if err := s.ringLifecycler.ChangeState(ctx, ring.ACTIVE); err != nil {
			return fmt.Errorf("error switching to ACTIVE in the ring: %s", err)
		}
		s.log.Info("search server is ACTIVE in the ring")
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
func (s *searchService) GetAddress() string {
	return s.handler.GetAddress()
}

func (s *searchService) running(ctx context.Context) error {
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

func (s *searchService) stopping(_ error) error {
	if s.hasSubservices {
		err := services.StopManagerAndAwaitStopped(context.Background(), s.subservices)
		if err != nil {
			return fmt.Errorf("failed to stop subservices: %w", err)
		}
	}
	return nil
}

func (s *searchService) RegisterHTTPEndpoints(httpServerRouter *mux.Router) {
	if httpServerRouter != nil && s.cfg.EnableSharding {
		httpServerRouter.Path("/prepare-downscale").Methods("GET", "POST", "DELETE").Handler(http.HandlerFunc(s.PrepareDownscale))
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
