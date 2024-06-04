package server

import (
	"context"
	"net"

	"github.com/grafana/dskit/instrument"
	"github.com/grafana/dskit/middleware"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	authzv1 "github.com/grafana/grafana/pkg/services/accesscontrol/embedservice/proto/v1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/reflection"
)

var _ authzv1.AuthzServiceServer = (*Server)(nil)
var _ registry.BackgroundService = (*Server)(nil)

var grpcRequestDuration *prometheus.HistogramVec

type Server struct {
	authzv1.UnimplementedAuthzServiceServer

	acSvc      accesscontrol.Service
	cfg        *setting.Cfg
	enabled    bool
	grpcServer *grpc.Server
	listener   *net.Listener
	logger     log.Logger
}

func ProvideAuthZServer(cfg *setting.Cfg, acSvc accesscontrol.Service, features *featuremgmt.FeatureManager,
	registerer prometheus.Registerer, tracer tracing.Tracer) (*Server, error) {
	enabled := features.IsEnabledGlobally(featuremgmt.FlagAuthZGRPCServer)
	s := &Server{
		acSvc:   acSvc,
		cfg:     cfg,
		enabled: enabled,
		logger:  log.New("authz-grpc-server"),
	}

	// Register the metric here instead of an init() function so that we do
	// nothing unless the feature is actually enabled.
	if grpcRequestDuration == nil {
		grpcRequestDuration = prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: "grafana",
			Name:      "grpc_authz_request_duration_seconds",
			Help:      "Time (in seconds) spent serving AUTHZ GRPC requests.",
			Buckets:   instrument.DefBuckets,
		}, []string{"method", "route", "status_code", "ws"})

		if err := registerer.Register(grpcRequestDuration); err != nil {
			return nil, err
		}
	}

	var opts []grpc.ServerOption

	// TODO add authn interceptor
	// TODO add authz interceptor

	// Default auth is admin token check, but this can be overridden by
	// services which implement ServiceAuthFuncOverride interface.
	// See https://github.com/grpc-ecosystem/go-grpc-middleware/blob/main/interceptors/auth/auth.go#L30.
	opts = append(opts, []grpc.ServerOption{
		grpc.ChainUnaryInterceptor(
			interceptors.TracingUnaryInterceptor(tracer),
			// grpcAuth.UnaryServerInterceptor(authenticator.Authenticate),
			// mtauthz.AuthZUnaryInterceptor(authorizer),
			interceptors.LoggingUnaryInterceptor(s.cfg, s.logger), // needs to be registered after tracing interceptor to get trace id
			middleware.UnaryServerInstrumentInterceptor(grpcRequestDuration),
		),
		grpc.ChainStreamInterceptor(
			interceptors.TracingStreamInterceptor(tracer),
			// grpcAuth.StreamServerInterceptor(authenticator.Authenticate),
			// mtauthz.AuthZStreamInterceptor(authorizer),
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

	s.grpcServer = grpc.NewServer(opts...)
	s.grpcServer.RegisterService(&authzv1.AuthzService_ServiceDesc, s)
	reflection.Register(s.grpcServer)

	listener, err := net.Listen("tcp", s.cfg.GRPCServerAddress)
	if err != nil {
		return nil, err
	}
	s.listener = &listener

	return s, nil
}

func (s *Server) Read(ctx context.Context, req *authzv1.ReadRequest) (*authzv1.ReadResponse, error) {
	action := req.GetAction()
	subject := req.GetSubject()

	// TODO can we consider the stackID as the orgID?
	stackID := req.GetStackId()

	permissions, err := s.acSvc.SearchUserPermissions(ctx, stackID, accesscontrol.SearchOptions{NamespacedID: subject, Action: action})
	if err != nil {
		return nil, err
	}

	data := make([]*authzv1.ReadResponse_Data, 0, len(permissions))
	for _, perm := range permissions {
		data = append(data, &authzv1.ReadResponse_Data{Object: perm.Scope})
	}
	return &authzv1.ReadResponse{Data: data}, nil
}

// Run implements the Run method of the registry.BackgroundService interface.
func (s *Server) Run(ctx context.Context) error {
	if !s.enabled {
		s.logger.Debug("AuthZ gRPC server is disabled")
		return nil
	}

	errc := make(chan error, 1)

	// Implement the logic for the Run method here.
	go func() {
		s.logger.Info("Starting AuthZ gRPC server",
			"address", s.cfg.GRPCServerAddress,
			"tls", s.cfg.GRPCServerTLSConfig != nil,
			"max_recv_msg_size", s.cfg.GRPCServerMaxRecvMsgSize,
			"max_send_msg_size", s.cfg.GRPCServerMaxSendMsgSize,
		)

		errc <- s.grpcServer.Serve(*s.listener)
	}()

	select {
	case <-ctx.Done():
		s.logger.Info("Shutting down AuthZ gRPC server")
		s.grpcServer.GracefulStop()
		return nil
	case err := <-errc:
		return err
	}
}

func (s *Server) IsDisabled() bool {
	return !s.enabled
}

func (s *Server) GetServer() *grpc.Server {
	return s.grpcServer
}

func (s *Server) GetAddress() string {
	return s.cfg.GRPCServerAddress
}
