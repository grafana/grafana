package authz

import (
	"context"
	"errors"
	"fmt"

	"github.com/fullstorydev/grpchan/inprocgrpc"
	"github.com/grafana/dskit/services"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/setting"
)

// TODO: probably create a wrapper for openfga client
func ProvideZanzana(cfg *setting.Cfg) (openfgav1.OpenFGAServiceClient, error) {
	srv, err := zanzana.New(zanzana.NewStore())
	if err != nil {
		return nil, fmt.Errorf("failed to start zanana: %w", err)
	}

	var client openfgav1.OpenFGAServiceClient

	// FIXME(kalleep): add config for connecting to remote zanana instance
	switch cfg.Zanzana.Mode {
	case setting.ZanzanaModeClient:
		panic("unimplemented")
	case setting.ZanzanaModeEmbedded:
		// run zanana embedded in grafana
		channel := &inprocgrpc.Channel{}
		openfgav1.RegisterOpenFGAServiceServer(channel, srv)
		client = openfgav1.NewOpenFGAServiceClient(channel)

	default:
		return nil, fmt.Errorf("unsupported zanana mode: %s", cfg.Zanzana.Mode)
	}

	return client, nil
}

type Service interface {
	services.NamedService
}

var _ Service = (*Zanzana)(nil)

// ProvideZanzanaService is used to register zanana as a module so we can run it seperatly from grafana.
func ProvideZanzanaService(cfg *setting.Cfg, features featuremgmt.FeatureToggles) (*Zanzana, error) {
	s := &Zanzana{
		cfg:      cfg,
		features: features,
		logger:   log.New("zanzana"),
	}
	// We need to use dskit service for when we are ready to use this as a standalone module
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
	srv, err := zanzana.New(zanzana.NewStore())
	if err != nil {
		return fmt.Errorf("failed to start zanana: %w", err)
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

	// authenticator interceptors.Authenticator
	z.handle, err = grpcserver.ProvideService(z.cfg, z.features, noopAuthenticator{}, tracer, prometheus.DefaultRegisterer)
	if err != nil {
		return fmt.Errorf("failed to create zanzana grpc server: %w", err)
	}

	openfgav1.RegisterOpenFGAServiceServer(z.handle.GetServer(), srv)
	grpcserver.ProvideReflectionService(z.cfg, z.handle)

	return nil
}

func (z *Zanzana) running(ctx context.Context) error {
	// handle.Run is blocking so we can just run it here
	return z.handle.Run(ctx)
}

func (z *Zanzana) stopping(err error) error {
	if err != nil && !errors.Is(err, context.Canceled) {
		z.logger.Error("Stopping zanzana due to unexpected error", "err", err)
	}
	return nil
}

type noopAuthenticator struct{}

// for now don't perform any authentication
func (n noopAuthenticator) Authenticate(ctx context.Context) (context.Context, error) {
	return ctx, nil
}
