package entity

import (
	"github.com/grafana/grafana/pkg/services/auth/jwt"
	"github.com/grafana/grafana/pkg/setting"
	grpc "google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type Client struct {
	EntityStoreClient
	cfg               *setting.Cfg
	pluginAuthService jwt.PluginAuthService
}

func ProvideEntityStoreClient(cfg *setting.Cfg, pluginAuthService jwt.PluginAuthService) (*Client, error) {
	s := &Client{cfg: cfg, pluginAuthService: pluginAuthService}

	conn, err := grpc.Dial(
		s.cfg.EntityStore.Address,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithChainUnaryInterceptor(s.pluginAuthService.UnaryClientInterceptor("object-store")),
		grpc.WithChainStreamInterceptor(s.pluginAuthService.StreamClientInterceptor("object-store")),
	)
	if err != nil {
		return nil, err
	}
	s.EntityStoreClient = NewEntityStoreClient(conn)
	return s, nil
}
