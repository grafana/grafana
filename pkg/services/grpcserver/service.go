package grpcserver

import (
	"context"
	"fmt"
	"net"

	grpc_middleware "github.com/grpc-ecosystem/go-grpc-middleware"
	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/auth"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"

	"github.com/grafana/dskit/services"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"github.com/grafana/grafana/pkg/setting"
)

type Provider interface {
	GetServer() *grpc.Server
	GetAddress() string
}

type GPRCServerService struct {
	cfg      *setting.Cfg
	logger   log.Logger
	server   *grpc.Server
	listener net.Listener
}

func ProvideService(cfg *setting.Cfg, authenticator interceptors.Authenticator, tracer tracing.Tracer,
	moduleManager modules.Manager) (Provider, error) {
	s := &GPRCServerService{
		cfg:    cfg,
		logger: log.New("grpc-server"),
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
			),
		),
		grpc.StreamInterceptor(
			grpc_middleware.ChainStreamServer(
				interceptors.TracingStreamInterceptor(tracer),
				grpcAuth.StreamServerInterceptor(authenticator.Authenticate),
			),
		),
	}...)

	if s.cfg.GRPCServerTLSConfig != nil {
		opts = append(opts, grpc.Creds(credentials.NewTLS(cfg.GRPCServerTLSConfig)))
	}

	s.server = grpc.NewServer(opts...)

	moduleManager.RegisterModule(modules.GRPCServer, func() (services.Service, error) {
		return services.NewBasicService(s.start, s.run, s.stop), nil
	})

	return s, nil
}

func (s *GPRCServerService) start(_ context.Context) error {
	s.logger.Info("Starting GRPC server")

	listener, err := net.Listen(s.cfg.GRPCServerNetwork, s.cfg.GRPCServerAddress)
	if err != nil {
		return fmt.Errorf("GRPC server: failed to listen: %w", err)
	}

	s.listener = listener
	return nil
}

func (s *GPRCServerService) run(ctx context.Context) error {
	s.logger.Info("Running GRPC server", "address", s.cfg.GRPCServerAddress, "network", s.cfg.GRPCServerNetwork, "tls", s.cfg.GRPCServerTLSConfig != nil)

	serveErr := make(chan error, 1)
	go func() {
		s.logger.Info("GRPC server: starting")
		err := s.server.Serve(s.listener)
		if err != nil {
			s.logger.Error("GRPC server: failed to serve", "err", err)
			serveErr <- err
		}
	}()

	select {
	case err := <-serveErr:
		s.logger.Error("GRPC server: failed to serve", "err", err)
		return err
	case <-ctx.Done():
	}
	s.logger.Warn("GRPC server: shutting down")
	return ctx.Err()
}

func (s *GPRCServerService) stop(failure error) error {
	if failure != nil {
		s.logger.Error("GRPC server: stopping", "err", failure)
	}

	s.logger.Warn("GRPC server: shutting down")
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
	if s.listener == nil {
		return ""
	}
	return s.listener.Addr().String()
}
