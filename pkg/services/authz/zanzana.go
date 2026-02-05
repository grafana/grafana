package authz

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/fullstorydev/grpchan/inprocgrpc"
	authnlib "github.com/grafana/authlib/authn"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/grpcutils"
	"github.com/grafana/authlib/types"
	"github.com/grafana/dskit/middleware"
	"github.com/grafana/dskit/services"
	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/auth"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	healthv1pb "google.golang.org/grpc/health/grpc_health_v1"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	zClient "github.com/grafana/grafana/pkg/services/authz/zanzana/client"
	zServer "github.com/grafana/grafana/pkg/services/authz/zanzana/server"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/server/reconciler"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"github.com/grafana/grafana/pkg/setting"
)

// ProvideZanzanaClient used to register ZanzanaClient.
// It will also start an embedded ZanzanaSever if mode is set to "embedded".
func ProvideZanzanaClient(cfg *setting.Cfg, db db.DB, zanzanaServer zanzana.Server, features featuremgmt.FeatureToggles, reg prometheus.Registerer) (zanzana.Client, error) {
	//nolint:staticcheck // not yet migrated to OpenFeature
	if !features.IsEnabledGlobally(featuremgmt.FlagZanzana) {
		return zClient.NewNoopClient(), nil
	}

	switch cfg.ZanzanaClient.Mode {
	case setting.ZanzanaModeClient:
		zanzanaConfig := ZanzanaClientConfig{
			Addr:             cfg.ZanzanaClient.Addr,
			Token:            cfg.ZanzanaClient.Token,
			TokenExchangeURL: cfg.ZanzanaClient.TokenExchangeURL,
			TokenNamespace:   cfg.ZanzanaClient.TokenNamespace,
			ServerCertFile:   cfg.ZanzanaClient.ServerCertFile,
		}
		return NewRemoteZanzanaClient(zanzanaConfig, reg)

	case setting.ZanzanaModeEmbedded:
		channel := &inprocgrpc.Channel{}
		// Put * as a namespace so we can properly authorize request with in-proc mode
		channel.WithServerUnaryInterceptor(grpcAuth.UnaryServerInterceptor(func(ctx context.Context) (context.Context, error) {
			ctx = types.WithAuthInfo(ctx, authnlib.NewAccessTokenAuthInfo(authnlib.Claims[authnlib.AccessTokenClaims]{
				Rest: authnlib.AccessTokenClaims{
					Namespace: "*",
					Permissions: []string{
						zanzana.TokenPermissionUpdate,
					},
				},
			}))
			return ctx, nil
		}))

		authzv1.RegisterAuthzServiceServer(channel, zanzanaServer)
		authzextv1.RegisterAuthzExtentionServiceServer(channel, zanzanaServer)

		client, err := zClient.New(channel, reg)
		if err != nil {
			return nil, fmt.Errorf("failed to initialize zanzana client: %w", err)
		}
		return client, nil

	default:
		return nil, fmt.Errorf("unsupported zanzana mode: %s", cfg.ZanzanaClient.Mode)
	}
}

// ProvideEmbeddedZanzanaServer creates and registers embedded ZanzanaServer.
func ProvideEmbeddedZanzanaServer(cfg *setting.Cfg, db db.DB, tracer tracing.Tracer, features featuremgmt.FeatureToggles, reg prometheus.Registerer) (zanzana.Server, error) {
	//nolint:staticcheck // not yet migrated to OpenFeature
	if !features.IsEnabledGlobally(featuremgmt.FlagZanzana) {
		return zServer.NewNoopServer(), nil
	}

	logger := log.New("zanzana.server")

	srv, err := zServer.NewEmbeddedZanzanaServer(cfg, db, logger, tracer, reg)
	if err != nil {
		return nil, fmt.Errorf("failed to start zanzana: %w", err)
	}

	return srv, nil
}

// ProvideEmbeddedZanzanaService creates a background service wrapper for the embedded zanzana server
// to ensure proper cleanup when Grafana shuts down.
func ProvideEmbeddedZanzanaService(server zanzana.Server) *EmbeddedZanzanaService {
	return &EmbeddedZanzanaService{
		server: server,
	}
}

// EmbeddedZanzanaService wraps the embedded zanzana server as a background service
// to ensure Close() is called during shutdown.
type EmbeddedZanzanaService struct {
	server zanzana.Server
}

func (s *EmbeddedZanzanaService) Run(ctx context.Context) error {
	// The zanzana server doesn't have a blocking Run method,
	// so we just wait for shutdown
	<-ctx.Done()
	if s.server != nil {
		s.server.Close()
	}
	return nil
}

func (s *EmbeddedZanzanaService) IsDisabled() bool {
	return s.server == nil
}

// ProvideStandaloneZanzanaClient provides a standalone Zanzana client, without registering the Zanzana service.
// Client connects to a remote Zanzana server specified in the configuration.
func ProvideStandaloneZanzanaClient(cfg *setting.Cfg, features featuremgmt.FeatureToggles, reg prometheus.Registerer) (zanzana.Client, error) {
	//nolint:staticcheck // not yet migrated to OpenFeature
	if !features.IsEnabledGlobally(featuremgmt.FlagZanzana) {
		return zClient.NewNoopClient(), nil
	}

	zanzanaConfig := ZanzanaClientConfig{
		Addr:             cfg.ZanzanaClient.Addr,
		Token:            cfg.ZanzanaClient.Token,
		TokenExchangeURL: cfg.ZanzanaClient.TokenExchangeURL,
		TokenNamespace:   cfg.ZanzanaClient.TokenNamespace,
		ServerCertFile:   cfg.ZanzanaClient.ServerCertFile,
	}

	return NewRemoteZanzanaClient(zanzanaConfig, reg)
}

type ZanzanaClientConfig struct {
	Addr             string
	Token            string
	TokenExchangeURL string
	TokenNamespace   string
	ServerCertFile   string
}

// NewRemoteZanzanaClient creates a new Zanzana client that connects to remote Zanzana server.
func NewRemoteZanzanaClient(cfg ZanzanaClientConfig, reg prometheus.Registerer) (zanzana.Client, error) {
	tokenClient, err := authnlib.NewTokenExchangeClient(authnlib.TokenExchangeConfig{
		Token:            cfg.Token,
		TokenExchangeURL: cfg.TokenExchangeURL,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create token exchange client: %w", err)
	}

	transportCredentials := insecure.NewCredentials()
	if cfg.ServerCertFile != "" {
		transportCredentials, err = credentials.NewClientTLSFromFile(cfg.ServerCertFile, "")
		if err != nil {
			return nil, fmt.Errorf("failed to initialize TLS certificate: %w", err)
		}
	}

	authzRequestDuration := promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
		Name:                            "authz_zanzana_grpc_client_request_duration_seconds",
		Help:                            "Time spent executing requests to zanzana server.",
		NativeHistogramBucketFactor:     1.1,
		NativeHistogramMaxBucketNumber:  160,
		NativeHistogramMinResetDuration: time.Hour,
	}, []string{"operation", "status_code"})
	unaryInterceptors, streamInterceptors := instrument(authzRequestDuration, middleware.ReportGRPCStatusOption)

	dialOptions := []grpc.DialOption{
		grpc.WithTransportCredentials(transportCredentials),
		grpc.WithPerRPCCredentials(
			NewGRPCTokenAuth(AuthzServiceAudience, cfg.TokenNamespace, tokenClient),
		),
		grpc.WithChainUnaryInterceptor(unaryInterceptors...),
		grpc.WithChainStreamInterceptor(streamInterceptors...),
	}

	conn, err := grpc.NewClient(cfg.Addr, dialOptions...)
	if err != nil {
		return nil, fmt.Errorf("failed to create zanzana client to remote server: %w", err)
	}

	client, err := zClient.New(conn, reg)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize zanzana client: %w", err)
	}

	return client, nil
}

type ZanzanaService interface {
	services.NamedService
}

var _ ZanzanaService = (*Zanzana)(nil)

// ProvideZanzanaService is used to register zanzana as a module so we can run it seperatly from grafana.
func ProvideZanzanaService(cfg *setting.Cfg, features featuremgmt.FeatureToggles, reg prometheus.Registerer, clientFactory resources.ClientFactory) (*Zanzana, error) {
	tracingCfg, err := tracing.ProvideTracingConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to provide tracing config: %w", err)
	}

	tracingCfg.ServiceName = "zanzana"

	tracer, err := tracing.ProvideService(tracingCfg)
	if err != nil {
		return nil, fmt.Errorf("failed to provide tracing service: %w", err)
	}

	s := &Zanzana{
		cfg:           cfg,
		features:      features,
		logger:        log.New("zanzana.server"),
		reg:           reg,
		tracer:        tracer,
		clientFactory: clientFactory,
	}

	s.BasicService = services.NewBasicService(s.start, s.running, s.stopping).WithName("zanzana")

	return s, nil
}

type Zanzana struct {
	*services.BasicService

	cfg           *setting.Cfg
	zanzanaServer zanzana.Server
	logger        log.Logger
	tracer        tracing.Tracer
	handle        grpcserver.Provider
	features      featuremgmt.FeatureToggles
	reg           prometheus.Registerer
	clientFactory resources.ClientFactory
}

func (z *Zanzana) start(ctx context.Context) error {
	zanzanaServer, err := zServer.NewZanzanaServer(z.cfg, z.logger, z.tracer, z.reg)
	if err != nil {
		return fmt.Errorf("failed to start zanzana: %w", err)
	}
	z.zanzanaServer = zanzanaServer

	var authenticatorInterceptor interceptors.Authenticator
	if z.cfg.ZanzanaServer.AllowInsecure && z.cfg.Env == setting.Dev {
		z.logger.Info("Allowing insecure connections to zanzana server")
		authenticatorInterceptor = noopAuthenticator{}
	} else {
		z.logger.Info("Requiring secure connections to zanzana server")
		authenticator := authnlib.NewAccessTokenAuthenticator(
			authnlib.NewAccessTokenVerifier(
				authnlib.VerifierConfig{AllowedAudiences: []string{AuthzServiceAudience}},
				authnlib.NewKeyRetriever(authnlib.KeyRetrieverConfig{
					SigningKeysURL: z.cfg.ZanzanaServer.SigningKeysURL,
				}),
			),
		)
		authenticatorInterceptor = interceptors.AuthenticatorFunc(
			grpcutils.NewAuthenticatorInterceptor(
				authenticator,
				z.tracer,
			),
		)
	}

	z.handle, err = grpcserver.ProvideService(
		z.cfg,
		z.features,
		authenticatorInterceptor,
		z.tracer,
		prometheus.DefaultRegisterer,
	)
	if err != nil {
		return fmt.Errorf("failed to create zanzana grpc server: %w", err)
	}

	grpcServer := z.handle.GetServer()
	authzv1.RegisterAuthzServiceServer(grpcServer, zanzanaServer)
	authzextv1.RegisterAuthzExtentionServiceServer(grpcServer, zanzanaServer)

	// register grpc health server
	healthServer := zServer.NewHealthServer(zanzanaServer)
	healthv1pb.RegisterHealthServer(grpcServer, healthServer)

	if z.cfg.ZanzanaServer.OpenFGAHttpAddr != "" {
		// Register OpenFGA service server to pass to the HTTP server
		openfgav1.RegisterOpenFGAServiceServer(grpcServer, zanzanaServer.GetOpenFGAServer())
	}

	if _, err := grpcserver.ProvideReflectionService(z.cfg, z.handle); err != nil {
		return fmt.Errorf("failed to register reflection for zanzana: %w", err)
	}

	return nil
}

func (z *Zanzana) running(ctx context.Context) error {
	if z.cfg.ZanzanaServer.OpenFGAHttpAddr != "" {
		go func() {
			if err := z.runHTTPServer(); err != nil {
				z.logger.Error("failed to run OpenFGA HTTP server", "error", err)
			}
		}()
	}

	if z.cfg.ZanzanaServer.ReconcilerEnabled {
		go func() {
			rec := reconciler.NewReconciler(
				z.zanzanaServer.(*zServer.Server),
				z.clientFactory,
				reconciler.Config{
					Workers:        z.cfg.ZanzanaServer.ReconcilerWorkers,
					Interval:       z.cfg.ZanzanaServer.ReconcilerInterval,
					WriteBatchSize: z.cfg.ZanzanaServer.ReconcilerWriteBatchSize,
				},
				z.logger,
				z.tracer,
			)
			if err := rec.Run(ctx); err != nil {
				z.logger.Error("reconciler stopped with error", "error", err)
			}
		}()
	}

	// Run is blocking so we can just run it here
	return z.handle.Run(ctx)
}

func (z *Zanzana) stopping(err error) error {
	if err != nil && !errors.Is(err, context.Canceled) {
		z.logger.Error("Stopping zanzana due to unexpected error", "err", err)
	}
	z.zanzanaServer.Close()
	return nil
}

func (z *Zanzana) runHTTPServer() error {
	if z.cfg.Env != setting.Dev && z.cfg.ZanzanaServer.AllowInsecure {
		return fmt.Errorf("allow_insecure is only supported in dev mode")
	}

	z.logger.Info("Initializing OpenFGA HTTP server", "address", z.cfg.ZanzanaServer.OpenFGAHttpAddr)

	httpSrv, err := zServer.NewOpenFGAHttpServer(z.cfg.ZanzanaServer, z.handle)
	if err != nil {
		z.logger.Error("failed to create OpenFGA HTTP server", "error", err)
		return err
	} else {
		z.logger.Info("Starting OpenFGA HTTP server", "address", z.cfg.ZanzanaServer.OpenFGAHttpAddr)
		if z.cfg.ZanzanaServer.AllowInsecure {
			z.logger.Warn("Allowing unauthenticated connections!")
		}
		if err := httpSrv.ListenAndServe(); err != nil {
			z.logger.Error("failed to start OpenFGA HTTP server", "error", err)
			return err
		}
	}

	return nil
}

// TODO this impl might be more broadly useful in authlib
type noopAuthenticator struct {
}

func (n noopAuthenticator) Authenticate(ctx context.Context) (context.Context, error) {
	return ctx, nil
}
