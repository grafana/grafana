package apigrpc

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/server"
	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/auth"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/live"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	logger = log.New("api_grpc")
)

func init() {
	registry.RegisterServiceWithPriority(&GRPCAPIServer{}, registry.Low)
}

// GRPCAPIServer ...
type GRPCAPIServer struct {
	Cfg         *setting.Cfg      `inject:""`
	GrafanaLive *live.GrafanaLive `inject:""`

	server *grpc.Server
}

func (s *GRPCAPIServer) loadTLSCredentials() (credentials.TransportCredentials, error) {
	serverCert, err := tls.LoadX509KeyPair(s.Cfg.GRPCCertFile, s.Cfg.GRPCKeyFile)
	if err != nil {
		return nil, err
	}
	config := &tls.Config{
		Certificates: []tls.Certificate{serverCert},
		ClientAuth:   tls.NoClientCert,
	}
	return credentials.NewTLS(config), nil
}

// Init Receiver.
func (s *GRPCAPIServer) Init() error {
	logger.Info("GRPCAPIServer initialization", "address", s.Cfg.GRPCAddress, "network", s.Cfg.GRPCNetwork, "tls", s.Cfg.GRPCUseTLS)

	if !s.IsEnabled() {
		logger.Debug("GRPCAPIServer not enabled, skipping initialization")
		return nil
	}

	listener, err := net.Listen(s.Cfg.GRPCNetwork, s.Cfg.GRPCAddress)
	if err != nil {
		return fmt.Errorf("failed to listen: %v", err)
	}

	authenticator := &Authenticator{}

	opts := []grpc.ServerOption{
		grpc.StreamInterceptor(grpcAuth.StreamServerInterceptor(authenticator.Authenticate)),
		grpc.UnaryInterceptor(grpcAuth.UnaryServerInterceptor(authenticator.Authenticate)),
	}
	if s.Cfg.GRPCUseTLS {
		cred, err := s.loadTLSCredentials()
		if err != nil {
			return fmt.Errorf("error loading GRPC TLS Credentials: %w", err)
		}
		opts = append(opts, grpc.Creds(cred))
	}

	grpcServer := grpc.NewServer(opts...)
	s.server = grpcServer
	server.RegisterGrafanaServer(grpcServer, s)
	go func() {
		err := grpcServer.Serve(listener)
		if err != nil {
			logger.Error("can't serve GRPC", "error", err)
		}
	}()
	return nil
}

// Run Server.
func (s *GRPCAPIServer) Run(ctx context.Context) error {
	if !s.IsEnabled() {
		logger.Debug("Live feature not enabled, skipping initialization of GRPC server")
		return nil
	}
	<-ctx.Done()
	s.server.Stop()
	return ctx.Err()
}

// IsEnabled returns true if the Grafana Live feature is enabled.
func (s *GRPCAPIServer) IsEnabled() bool {
	return s.Cfg.IsLiveEnabled() // turn on when Live on for now.
}

func (s GRPCAPIServer) PublishStream(ctx context.Context, request *server.PublishStreamRequest) (*server.PublishStreamResponse, error) {
	// TODO: permission checks still need to be improved.
	// For now we don't apply any scope or namespace rules here.
	identity, ok := GetIdentity(ctx)
	if !ok {
		return nil, status.Error(codes.Unauthenticated, "no authentication found")
	}
	if identity.Type != IdentityTypePlugin {
		return nil, status.Error(codes.Unauthenticated, "unsupported identity type")
	}
	channel := live.ParseChannelAddress(request.Channel)
	if !channel.IsValid() {
		return nil, status.Error(codes.InvalidArgument, `invalid channel`)
	}
	if channel.Scope == live.ScopeStream {
		// Special handling for stream scope.
		// We can avoid unmarshal here, but in that case frame will be sent to WS with schema.
		var frame data.Frame
		err := json.Unmarshal(request.Data, &frame)
		if err != nil {
			// stream scope only deals with data frames.
			return nil, status.Error(codes.InvalidArgument, `invalid frame data`)
		}
		stream, err := s.GrafanaLive.ManagedStreamRunner.GetOrCreateStream(channel.Namespace)
		if err != nil {
			return nil, status.Error(codes.Internal, `internal error`)
		}
		err = stream.Push(channel.Path, &frame)
		if err != nil {
			return nil, status.Error(codes.Internal, `internal error`)
		}
	} else {
		// No special handling for other scopes.
		err := s.GrafanaLive.Publish(request.Channel, request.Data)
		if err != nil {
			return nil, status.Error(codes.Internal, `internal error`)
		}
	}
	return &server.PublishStreamResponse{}, nil
}
