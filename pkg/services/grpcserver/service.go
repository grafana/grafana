package grpcserver

import (
	"context"
	"fmt"
	"net"
	"time"

	"github.com/grafana/dskit/instrument"
	"github.com/grafana/dskit/middleware"
	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/auth"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/keepalive"

	"github.com/grafana/grafana/pkg/infra/log"
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
	cfg         setting.GRPCServerSettings
	logger      log.Logger
	server      *grpc.Server
	address     string
	enabled     bool
	startedChan chan struct{}
}

func ProvideService(cfg *setting.Cfg, features featuremgmt.FeatureToggles, authenticator interceptors.Authenticator, tracer trace.Tracer, registerer prometheus.Registerer) (Provider, error) {
	s := &gPRCServerService{
		cfg:         cfg.GRPCServer,
		logger:      log.New("grpc-server"),
		enabled:     features.IsEnabledGlobally(featuremgmt.FlagGrpcServer), // TODO: replace with cfg.GRPCServer.Enabled when we remove feature toggle.
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

	unaryInterceptors := []grpc.UnaryServerInterceptor{
		interceptors.LoggingUnaryInterceptor(s.logger, s.cfg.EnableLogging), // needs to be registered after tracing interceptor to get trace id
		middleware.UnaryServerInstrumentInterceptor(grpcRequestDuration),
	}
	streamInterceptors := []grpc.StreamServerInterceptor{
		interceptors.TracingStreamInterceptor(tracer),
		interceptors.LoggingStreamInterceptor(s.logger, s.cfg.EnableLogging),
		middleware.StreamServerInstrumentInterceptor(grpcRequestDuration),
	}

	if authenticator != nil {
		unaryInterceptors = append([]grpc.UnaryServerInterceptor{grpcAuth.UnaryServerInterceptor(authenticator.Authenticate)}, unaryInterceptors...)
		streamInterceptors = append([]grpc.StreamServerInterceptor{grpcAuth.StreamServerInterceptor(authenticator.Authenticate)}, streamInterceptors...)
	}

	// Default auth is admin token check, but this can be overridden by
	// services which implement ServiceAuthFuncOverride interface.
	// See https://github.com/grpc-ecosystem/go-grpc-middleware/blob/main/interceptors/auth/auth.go#L30.
	opts := []grpc.ServerOption{
		grpc.StatsHandler(otelgrpc.NewServerHandler()),
		grpc.ChainUnaryInterceptor(unaryInterceptors...),
		grpc.ChainStreamInterceptor(streamInterceptors...),
	}

	if s.cfg.TLSConfig != nil {
		opts = append(opts, grpc.Creds(credentials.NewTLS(s.cfg.TLSConfig)))
	}

	if s.cfg.MaxRecvMsgSize > 0 {
		opts = append(opts, grpc.MaxRecvMsgSize(s.cfg.MaxRecvMsgSize))
	}

	if s.cfg.MaxSendMsgSize > 0 {
		opts = append(opts, grpc.MaxSendMsgSize(s.cfg.MaxSendMsgSize))
	}

	// Apply connection management settings
	keepaliveParams := keepalive.ServerParameters{}
	keepalivePolicy := keepalive.EnforcementPolicy{}

	if s.cfg.MaxConnectionAge > 0 {
		keepaliveParams.MaxConnectionAge = time.Duration(s.cfg.MaxConnectionAge) * time.Second
	}
	if s.cfg.MaxConnectionAgeGrace > 0 {
		keepaliveParams.MaxConnectionAgeGrace = time.Duration(s.cfg.MaxConnectionAgeGrace) * time.Second
	}
	if s.cfg.MaxConnectionIdle > 0 {
		keepaliveParams.MaxConnectionIdle = time.Duration(s.cfg.MaxConnectionIdle) * time.Second
	}
	if s.cfg.KeepaliveTime > 0 {
		keepaliveParams.Time = time.Duration(s.cfg.KeepaliveTime) * time.Second
	}
	if s.cfg.KeepaliveTimeout > 0 {
		keepaliveParams.Timeout = time.Duration(s.cfg.KeepaliveTimeout) * time.Second
	}
	if s.cfg.KeepaliveMinTime > 0 {
		keepalivePolicy.MinTime = time.Duration(s.cfg.KeepaliveMinTime) * time.Second
	}

	// Only add keepalive options if any values are configured
	if s.cfg.MaxConnectionAge > 0 || s.cfg.MaxConnectionAgeGrace > 0 || s.cfg.MaxConnectionIdle > 0 ||
		s.cfg.KeepaliveTime > 0 || s.cfg.KeepaliveTimeout > 0 {
		opts = append(opts, grpc.KeepaliveParams(keepaliveParams))
	}
	if s.cfg.KeepaliveMinTime > 0 {
		opts = append(opts, grpc.KeepaliveEnforcementPolicy(keepalivePolicy))
	}

	s.server = grpc.NewServer(opts...)
	return s, nil
}

func (s *gPRCServerService) Run(ctx context.Context) error {
	s.logger.Info("Running GRPC server",
		"address", s.cfg.Address,
		"network", s.cfg.Network,
		"tls", s.cfg.TLSConfig != nil,
		"max_recv_msg_size", s.cfg.MaxRecvMsgSize,
		"max_send_msg_size", s.cfg.MaxSendMsgSize,
		"max_connection_age", s.cfg.MaxConnectionAge,
		"max_connection_idle", s.cfg.MaxConnectionIdle,
		"keepalive_time", s.cfg.KeepaliveTime,
		"keepalive_timeout", s.cfg.KeepaliveTimeout,
		"keepalive_min_time", s.cfg.KeepaliveMinTime)

	listener, err := net.Listen(s.cfg.Network, s.cfg.Address)
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
