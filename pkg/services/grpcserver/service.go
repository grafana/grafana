package grpcserver

import (
	"context"
	"fmt"
	"net"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"

	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/auth"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
)

type Provider interface {
	registry.BackgroundService
	GetServer() *grpc.Server
}

type GPRCServerService struct {
	cfg    *setting.Cfg
	logger log.Logger
	server *grpc.Server
}

func ProvideService(cfg *setting.Cfg) (Provider, error) {
	s := &GPRCServerService{
		cfg:    cfg,
		logger: log.New("grpc-server"),
	}

	var opts []grpc.ServerOption

	// Default auth is admin token check, but this can be overridden by
	// services which implement ServiceAuthFuncOverride interface.
	// See https://github.com/grpc-ecosystem/go-grpc-middleware/blob/master/auth/auth.go#L30.
	authenticator := NewAuthenticator()
	opts = append(opts, []grpc.ServerOption{
		grpc.StreamInterceptor(grpcAuth.StreamServerInterceptor(authenticator.Authenticate)),
		grpc.UnaryInterceptor(grpcAuth.UnaryServerInterceptor(authenticator.Authenticate)),
	}...)

	if s.cfg.GRPCServerTLSConfig != nil {
		opts = append(opts, grpc.Creds(credentials.NewTLS(cfg.GRPCServerTLSConfig)))
	}

	grpcServer := grpc.NewServer(opts...)
	s.server = grpcServer
	return s, nil
}

func (s *GPRCServerService) Run(ctx context.Context) error {
	s.logger.Info("Running GRPC server", "address", s.cfg.GRPCServerAddress, "network", s.cfg.GRPCServerNetwork, "tls", s.cfg.GRPCServerTLSConfig != nil)

	listener, err := net.Listen(s.cfg.GRPCServerNetwork, s.cfg.GRPCServerAddress)
	if err != nil {
		return fmt.Errorf("GRPC server: failed to listen: %w", err)
	}

	serveErr := make(chan error, 1)
	go func() {
		err := s.server.Serve(listener)
		if err != nil {
			serveErr <- err
		}
	}()

	select {
	case err := <-serveErr:
		return err
	case <-ctx.Done():
	}
	s.server.Stop()
	return ctx.Err()
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
