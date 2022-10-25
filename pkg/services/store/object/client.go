package object

import (
	"github.com/grafana/grafana/pkg/services/auth/jwt"
	"github.com/grafana/grafana/pkg/setting"
	grpc "google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type Client struct {
	ObjectStoreClient
	cfg               *setting.Cfg
	pluginAuthService jwt.PluginAuthService
}

func ProvideObjectStoreClient(cfg *setting.Cfg, pluginAuthService jwt.PluginAuthService) *Client {
	s := &Client{cfg: cfg, pluginAuthService: pluginAuthService}
	conn, err := grpc.Dial(
		s.cfg.ObjectStore.Address,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithChainUnaryInterceptor(s.pluginAuthService.UnaryClientInterceptor("object-store")),
		grpc.WithChainStreamInterceptor(s.pluginAuthService.StreamClientInterceptor("object-store")),
	)
	if err != nil {
		// TODO: log error
		return nil
	}
	s.ObjectStoreClient = NewObjectStoreClient(conn)
	return s
}
