package authz

import (
	"context"
	"errors"
	"fmt"

	"github.com/fullstorydev/grpchan/inprocgrpc"
	authnlib "github.com/grafana/authlib/authn"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/grpcutils"
	"github.com/grafana/authlib/types"
	"github.com/grafana/dskit/services"
	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/auth"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/prometheus/client_golang/prometheus"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	healthv1pb "google.golang.org/grpc/health/grpc_health_v1"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"github.com/grafana/grafana/pkg/setting"
)

// ProvideZanzana used to register ZanzanaClient.
// It will also start an embedded ZanzanaSever if mode is set to "embedded".
func ProvideZanzana(cfg *setting.Cfg, db db.DB, tracer tracing.Tracer, features featuremgmt.FeatureToggles, reg prometheus.Registerer) (zanzana.Client, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagZanzana) {
		return zanzana.NewNoopClient(), nil
	}

	logger := log.New("zanzana.server")

	var client zanzana.Client
	switch cfg.ZanzanaClient.Mode {
	case setting.ZanzanaModeClient:
		tokenClient, err := authnlib.NewTokenExchangeClient(authnlib.TokenExchangeConfig{
			Token:            cfg.ZanzanaClient.Token,
			TokenExchangeURL: cfg.ZanzanaClient.TokenExchangeURL,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to initialize token exchange client: %w", err)
		}

		if cfg.StackID == "" {
			return nil, fmt.Errorf("missing stack ID")
		}

		transportCredentials := insecure.NewCredentials()
		if cfg.ZanzanaClient.ServerCertFile != "" {
			transportCredentials, err = credentials.NewClientTLSFromFile(cfg.ZanzanaClient.ServerCertFile, "")
			if err != nil {
				return nil, fmt.Errorf("failed to initialize TLS certificate: %w", err)
			}
		}
		dialOptions := []grpc.DialOption{
			grpc.WithTransportCredentials(transportCredentials),
			grpc.WithPerRPCCredentials(
				NewGRPCTokenAuth(AuthzServiceAudience, fmt.Sprintf("stacks-%s", cfg.StackID), tokenClient),
			),
		}

		conn, err := grpc.NewClient(cfg.ZanzanaClient.Addr, dialOptions...)
		if err != nil {
			return nil, fmt.Errorf("failed to create zanzana client to remote server: %w", err)
		}

		client, err = zanzana.NewClient(conn)
		if err != nil {
			return nil, fmt.Errorf("failed to initialize zanzana client: %w", err)
		}
	case setting.ZanzanaModeEmbedded:
		store, err := zanzana.NewEmbeddedStore(cfg, db, logger)
		if err != nil {
			return nil, fmt.Errorf("failed to start zanzana: %w", err)
		}

		openfga, err := zanzana.NewOpenFGAServer(cfg.ZanzanaServer, store)
		if err != nil {
			return nil, fmt.Errorf("failed to start zanzana: %w", err)
		}

		srv, err := zanzana.NewServer(cfg.ZanzanaServer, openfga, logger, tracer, reg)
		if err != nil {
			return nil, fmt.Errorf("failed to start zanzana: %w", err)
		}

		channel := &inprocgrpc.Channel{}
		// Put * as a namespace so we can properly authorize request with in-proc mode
		channel.WithServerUnaryInterceptor(grpcAuth.UnaryServerInterceptor(func(ctx context.Context) (context.Context, error) {
			ctx = types.WithAuthInfo(ctx, authnlib.NewAccessTokenAuthInfo(authnlib.Claims[authnlib.AccessTokenClaims]{
				Rest: authnlib.AccessTokenClaims{
					Namespace: "*",
				},
			}))
			return ctx, nil
		}))

		openfgav1.RegisterOpenFGAServiceServer(channel, openfga)
		authzv1.RegisterAuthzServiceServer(channel, srv)
		authzextv1.RegisterAuthzExtentionServiceServer(channel, srv)

		client, err = zanzana.NewClient(channel)
		if err != nil {
			return nil, fmt.Errorf("failed to initialize zanzana client: %w", err)
		}

	default:
		return nil, fmt.Errorf("unsupported zanzana mode: %s", cfg.ZanzanaClient.Mode)
	}

	return client, nil
}

type ZanzanaService interface {
	services.NamedService
}

var _ ZanzanaService = (*Zanzana)(nil)

// ProvideZanzanaService is used to register zanzana as a module so we can run it seperatly from grafana.
func ProvideZanzanaService(cfg *setting.Cfg, features featuremgmt.FeatureToggles, reg prometheus.Registerer) (*Zanzana, error) {
	s := &Zanzana{
		cfg:      cfg,
		features: features,
		logger:   log.New("zanzana.server"),
		reg:      reg,
	}

	s.BasicService = services.NewBasicService(s.start, s.running, s.stopping).WithName("zanzana")

	return s, nil
}

type Zanzana struct {
	*services.BasicService

	cfg *setting.Cfg

	logger   log.Logger
	handle   grpcserver.Provider
	features featuremgmt.FeatureToggles
	reg      prometheus.Registerer
}

func (z *Zanzana) start(ctx context.Context) error {
	tracingCfg, err := tracing.ProvideTracingConfig(z.cfg)
	if err != nil {
		return err
	}

	tracingCfg.ServiceName = "zanzana"

	tracer, err := tracing.ProvideService(tracingCfg)
	if err != nil {
		return err
	}

	store, err := zanzana.NewStore(z.cfg, z.logger)
	if err != nil {
		return fmt.Errorf("failed to initilize zanana store: %w", err)
	}

	openfgaServer, err := zanzana.NewOpenFGAServer(z.cfg.ZanzanaServer, store)
	if err != nil {
		return fmt.Errorf("failed to start zanzana: %w", err)
	}

	zanzanaServer, err := zanzana.NewServer(z.cfg.ZanzanaServer, openfgaServer, z.logger, tracer, z.reg)
	if err != nil {
		return fmt.Errorf("failed to start zanzana: %w", err)
	}

	var authenticatorInterceptor interceptors.Authenticator
	if z.cfg.ZanzanaServer.AllowInsecure && z.cfg.Env == setting.Dev {
		z.logger.Info("Allowing insecure connections to OpenFGA HTTP server")
		authenticatorInterceptor = noopAuthenticator{}
	} else {
		z.logger.Info("Requiring secure connections to OpenFGA HTTP server")
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
				tracer,
			),
		)
	}

	z.handle, err = grpcserver.ProvideService(
		z.cfg,
		z.features,
		authenticatorInterceptor,
		tracer,
		prometheus.DefaultRegisterer,
	)
	if err != nil {
		return fmt.Errorf("failed to create zanzana grpc server: %w", err)
	}

	grpcServer := z.handle.GetServer()
	openfgav1.RegisterOpenFGAServiceServer(grpcServer, openfgaServer)
	authzv1.RegisterAuthzServiceServer(grpcServer, zanzanaServer)
	authzextv1.RegisterAuthzExtentionServiceServer(grpcServer, zanzanaServer)

	// register grpc health server
	healthServer := zanzana.NewHealthServer(zanzanaServer)
	healthv1pb.RegisterHealthServer(grpcServer, healthServer)

	if _, err := grpcserver.ProvideReflectionService(z.cfg, z.handle); err != nil {
		return fmt.Errorf("failed to register reflection for zanzana: %w", err)
	}

	return nil
}

func (z *Zanzana) running(ctx context.Context) error {
	if z.cfg.Env == setting.Dev && z.cfg.ZanzanaServer.OpenFGAHttpAddr != "" {
		go func() {
			srv, err := zanzana.NewOpenFGAHttpServer(z.cfg.ZanzanaServer, z.handle)
			if err != nil {
				z.logger.Error("failed to create OpenFGA HTTP server", "error", err)
			} else {
				z.logger.Info("Starting OpenFGA HTTP server")
				if z.cfg.ZanzanaServer.AllowInsecure {
					z.logger.Warn("Allowing unauthenticated connections!")
				}
				if err := srv.ListenAndServe(); err != nil {
					z.logger.Error("failed to start OpenFGA HTTP server", "error", err)
				}
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
	return nil
}

// TODO this impl might be more broadly useful in authlib
type noopAuthenticator struct {
}

func (n noopAuthenticator) Authenticate(ctx context.Context) (context.Context, error) {
	return ctx, nil
}
