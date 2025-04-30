package sql

import (
	"context"
	"errors"
	"fmt"
	"net"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc/health/grpc_health_v1"

	"github.com/grafana/authlib/grpcutils"
	"github.com/grafana/dskit/kv"
	"github.com/grafana/dskit/netutil"
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
	"github.com/grafana/grafana/pkg/storage/unified/search"
)

var (
	_ UnifiedStorageGrpcService = (*service)(nil)
)

type UnifiedStorageGrpcService interface {
	services.NamedService

	// Return the address where this service is running
	GetAddress() string
}

type service struct {
	*services.BasicService

	cfg       *setting.Cfg
	features  featuremgmt.FeatureToggles
	db        infraDB.DB
	stopCh    chan struct{}
	stoppedCh chan error

	handler grpcserver.Provider

	tracing trace.Tracer

	authenticator func(ctx context.Context) (context.Context, error)

	log            log.Logger
	reg            prometheus.Registerer
	storageMetrics *resource.StorageMetrics
	indexMetrics   *resource.BleveIndexMetrics

	docBuilders resource.DocumentBuilderSupplier

	storageRing *ring.Ring
	lifecycler  *ring.BasicLifecycler
}

func ProvideUnifiedStorageGrpcService(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	db infraDB.DB,
	log log.Logger,
	reg prometheus.Registerer,
	docBuilders resource.DocumentBuilderSupplier,
	storageMetrics *resource.StorageMetrics,
	indexMetrics *resource.BleveIndexMetrics,
	storageRing *ring.Ring,
	memberlistKVConfig kv.Config,
) (UnifiedStorageGrpcService, error) {
	tracer := otel.Tracer("unified-storage")

	// reg can be nil when running unified storage in standalone mode
	if reg == nil {
		reg = prometheus.DefaultRegisterer
	}

	// FIXME: This is a temporary solution while we are migrating to the new authn interceptor
	// grpcutils.NewGrpcAuthenticator should be used instead.
	authn := NewAuthenticatorWithFallback(cfg, reg, tracer, func(ctx context.Context) (context.Context, error) {
		auth := grpc.Authenticator{Tracer: tracer}
		return auth.Authenticate(ctx)
	})

	s := &service{
		cfg:            cfg,
		features:       features,
		stopCh:         make(chan struct{}),
		authenticator:  authn,
		tracing:        tracer,
		db:             db,
		log:            log,
		reg:            reg,
		docBuilders:    docBuilders,
		storageMetrics: storageMetrics,
		indexMetrics:   indexMetrics,
		storageRing:    storageRing,
	}

	if cfg.EnableSharding {
		ringStore, err := kv.NewClient(
			memberlistKVConfig,
			ring.GetCodec(),
			kv.RegistererWithKVName(reg, "unified_storage_ring"), // TODO reuse const in ring.go
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
		delegate := ring.BasicLifecyclerDelegate(ring.NewInstanceRegisterDelegate(ring.JOINING, 128)) // TODO reuse const in ring.go
		delegate = ring.NewLeaveOnStoppingDelegate(delegate, log)
		delegate = ring.NewAutoForgetDelegate(time.Minute*2, delegate, log) // TODO reuse const in ring.go

		s.lifecycler, err = ring.NewBasicLifecycler(
			lifecyclerCfg,
			"unified_storage_ring", // TODO reuse const in ring.go
			"unified-storage-ring", // TODO reuse const in ring.go
			ringStore,
			delegate,
			log,
			reg,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to initialize storage-ring lifecycler: %s", err)
		}
	}

	// This will be used when running as a dskit service
	s.BasicService = services.NewBasicService(s.start, s.running, s.stopping).WithName(modules.StorageServer)

	return s, nil
}

func (s *service) start(ctx context.Context) error {
	authzClient, err := authz.ProvideStandaloneAuthZClient(s.cfg, s.features, s.tracing)
	if err != nil {
		return err
	}

	searchOptions, err := search.NewSearchOptions(s.features, s.cfg, s.tracing, s.docBuilders, s.indexMetrics)
	if err != nil {
		return err
	}

	server, err := NewResourceServer(s.db, s.cfg, s.tracing, s.reg, authzClient, searchOptions, s.storageMetrics, s.indexMetrics, s.features)
	if err != nil {
		return err
	}
	s.handler, err = grpcserver.ProvideService(s.cfg, s.features, interceptors.AuthenticatorFunc(s.authenticator), s.tracing, prometheus.DefaultRegisterer)
	if err != nil {
		return err
	}

	healthService, err := resource.ProvideHealthService(server)
	if err != nil {
		return err
	}

	srv := s.handler.GetServer()
	resource.RegisterResourceStoreServer(srv, server)
	resource.RegisterBulkStoreServer(srv, server)
	resource.RegisterResourceIndexServer(srv, server)
	resource.RegisterManagedObjectIndexServer(srv, server)
	resource.RegisterBlobStoreServer(srv, server)
	resource.RegisterDiagnosticsServer(srv, server)
	grpc_health_v1.RegisterHealthServer(srv, healthService)

	// register reflection service
	_, err = grpcserver.ProvideReflectionService(s.cfg, s.handler)
	if err != nil {
		return err
	}

	err = s.lifecycler.StartAsync(ctx)
	if err != nil {
		return fmt.Errorf("failed to start the lifecycler: %s", err)
	}

	s.log.Info("waiting until resource server is JOINING in the ring")
	lfcCtx, cancel := context.WithTimeout(context.Background(), time.Second*10)
	defer cancel()
	if err := ring.WaitInstanceState(lfcCtx, s.storageRing, s.lifecycler.GetInstanceID(), ring.JOINING); err != nil {
		return fmt.Errorf("error switching to JOINING in the ring: %s", err)
	}
	s.log.Info("resource server is JOINING in the ring")

	if err := s.lifecycler.ChangeState(ctx, ring.ACTIVE); err != nil {
		return fmt.Errorf("error switching to ACTIVE in the ring: %s", err)
	}
	s.log.Info("resource server is ACTIVE in the ring")

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
		if err != nil {
			return err
		}
	case <-ctx.Done():
		close(s.stopCh)
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

const (
	metricsNamespace = "grafana"
	metricsSubSystem = "grpc_authenticator_with_fallback"
)

var once sync.Once

func newMetrics(reg prometheus.Registerer) *metrics {
	m := &metrics{
		requestsTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: metricsNamespace,
				Subsystem: metricsSubSystem,
				Name:      "requests_total",
				Help:      "Number requests using the authenticator with fallback",
			}, []string{"fallback_used", "result"}),
	}

	if reg != nil {
		once.Do(func() {
			reg.MustRegister(m.requestsTotal)
		})
	}

	return m
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
	return func(ctx context.Context) (context.Context, error) {
		a := &authenticatorWithFallback{
			authenticator: authenticator,
			fallback:      fallback,
			tracer:        tracer,
			metrics:       newMetrics(reg),
		}
		return a.Authenticate(ctx)
	}
}

func (s *service) stopping(err error) error {
	if err != nil && !errors.Is(err, context.Canceled) {
		s.log.Error("stopping unified storage grpc service", "error", err)
		return err
	}
	return nil
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
		HeartbeatTimeout:    time.Minute, // TODO reuse const in ring.go
		TokensObservePeriod: 0,
		NumTokens:           128, // TODO reuse const in ring.go
	}, nil
}
