package apigrpc

import (
	"context"
	"fmt"
	"net"

	"google.golang.org/grpc"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/server"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/manager"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/datasources"
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
	Cfg             *setting.Cfg             `inject:""`
	PluginManager   *manager.PluginManager   `inject:""`
	Bus             bus.Bus                  `inject:""`
	CacheService    *localcache.CacheService `inject:""`
	DatasourceCache datasources.CacheService `inject:""`
	GrafanaLive     *live.GrafanaLive        `inject:""`
}

// Init Receiver.
func (s *GRPCAPIServer) Init() error {
	logger.Info("GRPCAPIServer initialization")

	if !s.IsEnabled() {
		logger.Debug("GRPCAPIServer not enabled, skipping initialization")
		return nil
	}

	// TODO: listen on unix socket or on configured port.
	lis, err := net.Listen("tcp", fmt.Sprintf("localhost:%d", 10000))
	if err != nil {
		return fmt.Errorf("failed to listen: %v", err)
	}

	var opts []grpc.ServerOption
	grpcServer := grpc.NewServer(opts...)
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

func (s GRPCAPIServer) PublishStream(_ context.Context, request *server.PublishStreamRequest) (*server.PublishStreamResponse, error) {
	// TODO: check request permissions, publish to a channel.
	logger.Debug("Publish data to a channel", "channel", request.Channel, "data", string(request.Data))
	err := s.GrafanaLive.Publish(request.Channel, request.Data)
	if err != nil {
		return nil, err
	}
	return &server.PublishStreamResponse{}, nil
}
