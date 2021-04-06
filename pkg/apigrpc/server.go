package apigrpc

import (
	"context"
	"fmt"
	"net"

	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/auth"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/server"
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
}

// Init Receiver.
func (s *GRPCAPIServer) Init() error {
	logger.Info("GRPCAPIServer initialization")

	if !s.IsEnabled() {
		logger.Debug("GRPCAPIServer not enabled, skipping initialization")
		return nil
	}

	// TODO: listen on unix socket or on configured port.
	lis, err := net.Listen("tcp", "127.0.0.1:10000")
	if err != nil {
		return fmt.Errorf("failed to listen: %v", err)
	}

	authenticator := &Authenticator{}

	grpcServer := grpc.NewServer(
		grpc.StreamInterceptor(grpcAuth.StreamServerInterceptor(authenticator.Authenticate)),
		grpc.UnaryInterceptor(grpcAuth.UnaryServerInterceptor(authenticator.Authenticate)),
	)
	server.RegisterGrafanaServer(grpcServer, s)
	go func() {
		err := grpcServer.Serve(lis)
		if err != nil {
			logger.Error("can't serve GRPC", "error", err)
		}
	}()
	return nil
}

// Run Receiver.
func (s *GRPCAPIServer) Run(ctx context.Context) error {
	if !s.IsEnabled() {
		logger.Debug("Live feature not enabled, skipping initialization of GRPC server")
		return nil
	}
	<-ctx.Done()
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
	logger.Debug("Publish data to a channel", "channel", request.Channel, "data", string(request.Data))
	err := s.GrafanaLive.Publish(request.Channel, request.Data)
	if err != nil {
		return nil, err
	}
	return &server.PublishStreamResponse{}, nil
}
