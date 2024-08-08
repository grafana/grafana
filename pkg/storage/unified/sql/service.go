package sql

import (
	"context"
	"crypto/tls"
	"net/http"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/dskit/services"
	"github.com/prometheus/client_golang/prometheus"
	"google.golang.org/grpc/health/grpc_health_v1"

	infraDB "github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/services/authn/grpcutils"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

var (
	_ Service = (*service)(nil)
)

type Service interface {
	services.NamedService
}

type service struct {
	*services.BasicService

	cfg       *setting.Cfg
	features  featuremgmt.FeatureToggles
	db        infraDB.DB
	stopCh    chan struct{}
	stoppedCh chan error

	handler grpcserver.Provider

	tracing *tracing.TracingService

	authenticator interceptors.Authenticator

	log log.Logger
}

func ProvideService(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	db infraDB.DB,
	log log.Logger,
) (*service, error) {
	tracingCfg, err := tracing.ProvideTracingConfig(cfg)
	if err != nil {
		return nil, err
	}
	tracingCfg.ServiceName = "unified-storage"

	tracing, err := tracing.ProvideService(tracingCfg)
	if err != nil {
		return nil, err
	}

	authCfg, err := grpcutils.ReadGprcServerConfig(cfg)
	if err != nil {
		return nil, err
	}

	grpcAuthCfg := authnlib.GrpcAuthenticatorConfig{
		KeyRetrieverConfig: authnlib.KeyRetrieverConfig{
			SigningKeysURL: authCfg.SigningKeysURL,
		},
		// TODO(drclau): for ID tokens audience is the tenant
		// VerifierConfig: authnlib.VerifierConfig{
		// 	AllowedAudiences: authCfg.AllowedAudiences,
		// },
	}

	client := http.DefaultClient
	if cfg.Env == "development" {
		// allow insecure connections in development mode to facilitate testing
		client = &http.Client{Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}}}
	}
	keyRetriever := authnlib.NewKeyRetriever(grpcAuthCfg.KeyRetrieverConfig, authnlib.WithHTTPClientKeyRetrieverOpt(client))

	grpcOpts := []authnlib.GrpcAuthenticatorOption{}
	switch authCfg.Mode {
	case grpcutils.ModeInProc:
		// NOOP: IDTokenClaims are added to ctx client-side
		// TODO(drclau): do we need orgId?
	case grpcutils.ModeGRPC:
		grpcOpts = append(grpcOpts,
			// Access token are not yet available on-prem
			authnlib.WithDisableAccessTokenAuthOption(),
			authnlib.WithIDTokenAuthOption(true),
			authnlib.WithKeyRetrieverOption(keyRetriever),
		)
	case grpcutils.ModeCloud:
		grpcOpts = append(grpcOpts,
			authnlib.WithIDTokenAuthOption(true),
			authnlib.WithKeyRetrieverOption(keyRetriever),
		)
	}

	authn, err := authnlib.NewGrpcAuthenticator(
		&grpcAuthCfg,
		grpcOpts...,
	)

	s := &service{
		cfg:           cfg,
		features:      features,
		stopCh:        make(chan struct{}),
		authenticator: authn,
		tracing:       tracing,
		db:            db,
		log:           log,
	}

	// This will be used when running as a dskit service
	s.BasicService = services.NewBasicService(s.start, s.running, nil).WithName(modules.StorageServer)

	return s, nil
}

func (s *service) start(ctx context.Context) error {
	server, err := ProvideResourceServer(s.db, s.cfg, s.features, s.tracing)
	if err != nil {
		return err
	}
	s.handler, err = grpcserver.ProvideService(s.cfg, s.features, s.authenticator, s.tracing, prometheus.DefaultRegisterer)
	if err != nil {
		return err
	}

	healthService, err := resource.ProvideHealthService(server)
	if err != nil {
		return err
	}

	resource.RegisterResourceStoreServer(s.handler.GetServer(), server)
	grpc_health_v1.RegisterHealthServer(s.handler.GetServer(), healthService)

	// register reflection service
	_, err = grpcserver.ProvideReflectionService(s.cfg, s.handler)
	if err != nil {
		return err
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
		if err != nil {
			return err
		}
	case <-ctx.Done():
		close(s.stopCh)
	}
	return nil
}
