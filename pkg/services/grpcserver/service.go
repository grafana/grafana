package grpcserver

import (
	"context"
	"fmt"
	"net"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"github.com/grafana/grafana/pkg/services/mtctx"
	"github.com/grafana/grafana/pkg/setting"
	grpc_middleware "github.com/grpc-ecosystem/go-grpc-middleware"
	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/auth"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
)

type Provider interface {
	services.Service
	GetServer() *grpc.Server
	GetAddress() string
}

type GPRCServerService struct {
	*services.BasicService
	cfg     *setting.Cfg
	logger  log.Logger
	server  *grpc.Server
	address string
	errors  chan error
}

func ProvideService(cfg *setting.Cfg, authenticator interceptors.Authenticator, tracer tracing.Tracer, mt mtctx.Service) (Provider, error) {
	s := &GPRCServerService{
		cfg:    cfg,
		logger: log.New("grpc-server"),
		errors: make(chan error),
	}

	var opts []grpc.ServerOption

	// Default auth is admin token check, but this can be overridden by
	// services which implement ServiceAuthFuncOverride interface.
	// See https://github.com/grpc-ecosystem/go-grpc-middleware/blob/master/auth/auth.go#L30.
	opts = append(opts, []grpc.ServerOption{
		grpc.UnaryInterceptor(
			grpc_middleware.ChainUnaryServer(
				grpcAuth.UnaryServerInterceptor(authenticator.Authenticate),
				interceptors.TracingUnaryInterceptor(tracer),
				interceptors.StackIdUnaryInterceptor(mt),
			),
		),
		grpc.StreamInterceptor(
			grpc_middleware.ChainStreamServer(
				interceptors.TracingStreamInterceptor(tracer),
				grpcAuth.StreamServerInterceptor(authenticator.Authenticate),
				interceptors.StackIdStreamInterceptor(mt),
			),
		),
	}...)

	if s.cfg.GRPCServerTLSConfig != nil {
		opts = append(opts, grpc.Creds(credentials.NewTLS(cfg.GRPCServerTLSConfig)))
	}

	s.BasicService = services.NewBasicService(s.start, s.run, s.stop)
	s.server = grpc.NewServer(opts...)
	return s, nil
}

func (s *GPRCServerService) start(ctx context.Context) error {
	s.logger.Info("Running GRPC server", "address", s.cfg.GRPCServerAddress, "network", s.cfg.GRPCServerNetwork, "tls", s.cfg.GRPCServerTLSConfig != nil)

	listener, err := net.Listen(s.cfg.GRPCServerNetwork, s.cfg.GRPCServerAddress)
	if err != nil {
		return fmt.Errorf("GRPC server: failed to listen: %w", err)
	}
	s.address = listener.Addr().String()

	go func() {
		s.logger.Info("GRPC server: starting")
		err := s.server.Serve(listener)
		if err != nil {
			s.logger.Error("GRPC server: stopping due to error", "err", err)
			s.errors <- err
		}
	}()

	return nil
}

func (s *GPRCServerService) run(ctx context.Context) error {
	for {
		select {
		case err := <-s.errors:
			s.logger.Error("GRPC server: failed to serve", "err", err)
			return err
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (s *GPRCServerService) stop(failure error) error {
	if failure != nil {
		s.logger.Error("GRPC server: failed", "err", failure)
	}
	s.server.Stop()
	return nil
}

func (s *GPRCServerService) IsDisabled() bool {
	if s.cfg == nil {
		return true
	}
	return !s.cfg.IsFeatureToggleEnabled(featuremgmt.FlagGrpcServer)
}

func (s *GPRCServerService) GetServer() *grpc.Server {
	return s.server
}

func (s *GPRCServerService) GetAddress() string {
	return s.address
}
