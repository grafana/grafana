package authz

import (
	"context"
	"errors"
	"fmt"

	"github.com/fullstorydev/grpchan/inprocgrpc"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/dskit/services"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/prometheus/client_golang/prometheus"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	zclient "github.com/grafana/grafana/pkg/services/authz/zanzana/client"
	zserver "github.com/grafana/grafana/pkg/services/authz/zanzana/server"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/setting"
)

// ProvideZanzana used to register ZanzanaClient.
// It will also start an embedded ZanzanaSever if mode is set to "embedded".
func ProvideZanzana(cfg *setting.Cfg, db db.DB, features featuremgmt.FeatureToggles) (zanzana.Client, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagZanzana) {
		return zclient.NewNoop(), nil
	}

	logger := log.New("zanzana")

	var client zanzana.Client
	switch cfg.Zanzana.Mode {
	case setting.ZanzanaModeClient:
		conn, err := grpc.NewClient(cfg.Zanzana.Addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
		if err != nil {
			return nil, fmt.Errorf("failed to create zanzana client to remote server: %w", err)
		}

		client, err = zclient.NewClient(context.Background(), conn, cfg)
		if err != nil {
			return nil, fmt.Errorf("failed to initialize zanzana client: %w", err)
		}
	case setting.ZanzanaModeEmbedded:
		store, err := zanzana.NewEmbeddedStore(cfg, db, logger)
		if err != nil {
			return nil, fmt.Errorf("failed to start zanzana: %w", err)
		}

		openfga, err := zserver.NewOpenFGA(&cfg.Zanzana, store, logger)
		if err != nil {
			return nil, fmt.Errorf("failed to start zanzana: %w", err)
		}

		srv, err := zserver.NewAuthzServer(cfg, openfga)
		if err != nil {
			return nil, fmt.Errorf("failed to start zanzana: %w", err)
		}
		channel := &inprocgrpc.Channel{}
		openfgav1.RegisterOpenFGAServiceServer(channel, openfga)
		authzv1.RegisterAuthzServiceServer(channel, srv)
		authzextv1.RegisterAuthzExtentionServiceServer(channel, srv)

		client, err = zclient.NewClient(context.Background(), channel, cfg)
		if err != nil {
			return nil, fmt.Errorf("failed to initialize zanzana client: %w", err)
		}

	default:
		return nil, fmt.Errorf("unsupported zanzana mode: %s", cfg.Zanzana.Mode)
	}

	return client, nil
}

type ZanzanaService interface {
	services.NamedService
}

var _ ZanzanaService = (*Zanzana)(nil)

// ProvideZanzanaService is used to register zanzana as a module so we can run it seperatly from grafana.
func ProvideZanzanaService(cfg *setting.Cfg, features featuremgmt.FeatureToggles) (*Zanzana, error) {
	s := &Zanzana{
		cfg:      cfg,
		features: features,
		logger:   log.New("zanzana"),
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
}

func (z *Zanzana) start(ctx context.Context) error {
	store, err := zanzana.NewStore(z.cfg, z.logger)
	if err != nil {
		return fmt.Errorf("failed to initilize zanana store: %w", err)
	}

	openfga, err := zserver.NewOpenFGA(&z.cfg.Zanzana, store, z.logger)
	if err != nil {
		return fmt.Errorf("failed to start zanzana: %w", err)
	}

	srv, err := zserver.NewAuthzServer(z.cfg, openfga)
	if err != nil {
		return fmt.Errorf("failed to start zanzana: %w", err)
	}

	tracingCfg, err := tracing.ProvideTracingConfig(z.cfg)
	if err != nil {
		return err
	}
	tracingCfg.ServiceName = "zanzana"

	tracer, err := tracing.ProvideService(tracingCfg)
	if err != nil {
		return err
	}

	// FIXME(kalleep): For now we use noopAuthenticator but we should create an authenticator that can be shared
	// between different services.
	z.handle, err = grpcserver.ProvideService(z.cfg, z.features, noopAuthenticator{}, tracer, prometheus.DefaultRegisterer)
	if err != nil {
		return fmt.Errorf("failed to create zanzana grpc server: %w", err)
	}

	s := z.handle.GetServer()
	openfgav1.RegisterOpenFGAServiceServer(s, openfga)
	authzv1.RegisterAuthzServiceServer(s, srv)
	authzextv1.RegisterAuthzExtentionServiceServer(s, srv)

	if _, err := grpcserver.ProvideReflectionService(z.cfg, z.handle); err != nil {
		return fmt.Errorf("failed to register reflection for zanzana: %w", err)
	}

	return nil
}

func (z *Zanzana) running(ctx context.Context) error {
	if z.cfg.Env == setting.Dev && z.cfg.Zanzana.ListenHTTP {
		go func() {
			z.logger.Info("Starting OpenFGA HTTP server")
			err := zserver.StartOpenFGAHttpSever(z.cfg, z.handle, z.logger)
			if err != nil {
				z.logger.Error("failed to start OpenFGA HTTP server", "error", err)
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

type noopAuthenticator struct{}

func (n noopAuthenticator) Authenticate(ctx context.Context) (context.Context, error) {
	return ctx, nil
}
