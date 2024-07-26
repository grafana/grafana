package grpcserver

import (
	"context"
	"fmt"
	"net"
	"time"

	"github.com/grafana/dskit/instrument"
	"github.com/grafana/dskit/middleware"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/auth"
	"github.com/prometheus/client_golang/prometheus"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	grpcRequestDuration *prometheus.HistogramVec
)

type Provider interface {
	registry.BackgroundService
	registry.CanBeDisabled
	GetServer() *grpc.Server
	GetAddress() string
}

type gPRCServerService struct {
	cfg         *setting.Cfg
	logger      log.Logger
	server      *grpc.Server
	address     string
	enabled     bool
	startedChan chan struct{}
}

func ProvideService(cfg *setting.Cfg, features featuremgmt.FeatureToggles, authenticator interceptors.Authenticator, tracer tracing.Tracer, registerer prometheus.Registerer) (Provider, error) {
	s := &gPRCServerService{
		cfg:         cfg,
		logger:      log.New("grpc-server"),
		enabled:     features.IsEnabledGlobally(featuremgmt.FlagGrpcServer),
		startedChan: make(chan struct{}),
	}

	// Register the metric here instead of an init() function so that we do
	// nothing unless the feature is actually enabled.
	if grpcRequestDuration == nil {
		grpcRequestDuration = prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace:                       "grafana",
			Name:                            "grpc_request_duration_seconds",
			Help:                            "Time (in seconds) spent serving gRPC calls.",
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     1.1, // enable native histograms
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"method", "route", "status_code", "ws"})

		if err := registerer.Register(grpcRequestDuration); err != nil {
			return nil, err
		}
	}

	var opts []grpc.ServerOption

	// Default auth is admin token check, but this can be overridden by
	// services which implement ServiceAuthFuncOverride interface.
	// See https://github.com/grpc-ecosystem/go-grpc-middleware/blob/main/interceptors/auth/auth.go#L30.
	opts = append(opts, []grpc.ServerOption{
		grpc.ChainUnaryInterceptor(
			grpcAuth.UnaryServerInterceptor(authenticator.Authenticate),
			interceptors.TracingUnaryInterceptor(tracer),
			interceptors.LoggingUnaryInterceptor(s.cfg, s.logger), // needs to be registered after tracing interceptor to get trace id
			middleware.UnaryServerInstrumentInterceptor(grpcRequestDuration),
		),
		grpc.ChainStreamInterceptor(
			interceptors.TracingStreamInterceptor(tracer),
			grpcAuth.StreamServerInterceptor(authenticator.Authenticate),
			middleware.StreamServerInstrumentInterceptor(grpcRequestDuration),
		),
	}...)

	if s.cfg.GRPCServerTLSConfig != nil {
		opts = append(opts, grpc.Creds(credentials.NewTLS(cfg.GRPCServerTLSConfig)))
	}

	if s.cfg.GRPCServerMaxRecvMsgSize > 0 {
		opts = append(opts, grpc.MaxRecvMsgSize(s.cfg.GRPCServerMaxRecvMsgSize))
	}

	if s.cfg.GRPCServerMaxSendMsgSize > 0 {
		opts = append(opts, grpc.MaxSendMsgSize(s.cfg.GRPCServerMaxSendMsgSize))
	}

	s.server = grpc.NewServer(opts...)
	return s, nil
}

func (s *gPRCServerService) Run(ctx context.Context) error {
	s.logger.Info("Running GRPC server", "address", s.cfg.GRPCServerAddress, "network", s.cfg.GRPCServerNetwork, "tls", s.cfg.GRPCServerTLSConfig != nil, "max_recv_msg_size", s.cfg.GRPCServerMaxRecvMsgSize, "max_send_msg_size", s.cfg.GRPCServerMaxSendMsgSize)

	listener, err := net.Listen(s.cfg.GRPCServerNetwork, s.cfg.GRPCServerAddress)
	if err != nil {
		return fmt.Errorf("GRPC server: failed to listen: %w", err)
	}

	s.address = listener.Addr().String()
	close(s.startedChan)

	serveErr := make(chan error, 1)
	go func() {
		s.logger.Info("GRPC server: starting")
		err := s.server.Serve(listener)
		if err != nil {
			backend.Logger.Error("GRPC server: failed to serve", "err", err)
			serveErr <- err
		}
	}()

	select {
	case err := <-serveErr:
		backend.Logger.Error("GRPC server: failed to serve", "err", err)
		return err
	case <-ctx.Done():
	}
	s.logger.Warn("GRPC server: shutting down")
	s.server.Stop()
	return ctx.Err()
}

func (s *gPRCServerService) IsDisabled() bool {
	return !s.enabled
}

func (s *gPRCServerService) GetServer() *grpc.Server {
	return s.server
}

func (s *gPRCServerService) GetAddress() string {
	<-s.startedChan
	return s.address
}
