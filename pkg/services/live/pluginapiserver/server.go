package pluginapiserver

import (
	"context"
	"fmt"
	"net"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginapi"

	"google.golang.org/grpc"

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
	logger = log.New("pluginapiserver")
)

func init() {
	registry.RegisterServiceWithPriority(&PluginAPIServer{}, registry.Low)
}

// PluginAPIServer ...
type PluginAPIServer struct {
	Cfg             *setting.Cfg             `inject:""`
	PluginManager   *manager.PluginManager   `inject:""`
	Bus             bus.Bus                  `inject:""`
	CacheService    *localcache.CacheService `inject:""`
	DatasourceCache datasources.CacheService `inject:""`
	GrafanaLive     *live.GrafanaLive        `inject:""`
}

// Init Receiver.
func (s *PluginAPIServer) Init() error {
	logger.Info("PluginAPIServer initialization")

	if !s.IsEnabled() {
		logger.Debug("PluginAPIServer not enabled, skipping initialization")
		return nil
	}

	// TODO: listen on unix socket or on configured port.
	lis, err := net.Listen("tcp", fmt.Sprintf("localhost:%d", 10000))
	if err != nil {
		return fmt.Errorf("failed to listen: %v", err)
	}

	var opts []grpc.ServerOption
	grpcServer := grpc.NewServer(opts...)
	pluginapi.RegisterPublisherServer(grpcServer, newPluginGRPCServer())
	go func() {
		err := grpcServer.Serve(lis)
		if err != nil {
			logger.Error("can't serve GRPC", "error", err)
		}
	}()
	return nil
}

type pluginGRPCServer struct{}

func newPluginGRPCServer() *pluginGRPCServer {
	return &pluginGRPCServer{}
}

func (p pluginGRPCServer) Publish(ctx context.Context, request *pluginapi.PublishRequest) (*pluginapi.PublishResponse, error) {
	// TODO: check request permissions, publish to a channel.
	return &pluginapi.PublishResponse{}, nil
}

// Run Receiver.
func (s *PluginAPIServer) Run(ctx context.Context) error {
	if !s.IsEnabled() {
		logger.Debug("PluginAPIServer feature not enabled, skipping initialization of Telemetry Receiver")
		return nil
	}
	<-ctx.Done()
	return ctx.Err()
}

// IsEnabled returns true if the Grafana Live feature is enabled.
func (s *PluginAPIServer) IsEnabled() bool {
	return s.Cfg.IsLiveEnabled() // turn on when Live on for now.
}
