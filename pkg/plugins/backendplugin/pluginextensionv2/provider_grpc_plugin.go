package pluginextensionv2

import (
	"context"

	"github.com/hashicorp/go-plugin"
	"google.golang.org/grpc"
)

type ProviderPlugin interface {
	ProviderClient
}

type ProviderGRPCPlugin struct {
	plugin.NetRPCUnsupportedPlugin
}

func (p *ProviderGRPCPlugin) GRPCServer(broker *plugin.GRPCBroker, s *grpc.Server) error {
	return nil
}

func (p *ProviderGRPCPlugin) GRPCClient(ctx context.Context, broker *plugin.GRPCBroker, c *grpc.ClientConn) (interface{}, error) {
	return &ProviderGRPCClient{NewProviderClient(c)}, nil
}

type ProviderGRPCClient struct {
	ProviderClient
}

func (m *ProviderGRPCClient) ConfigureProvider(ctx context.Context, req *ConfigureProviderRequest, opts ...grpc.CallOption) (*ConfigureProviderResponse, error) {
	return m.ProviderClient.ConfigureProvider(ctx, req)
}

var _ ProviderClient = &ProviderGRPCClient{}
var _ plugin.GRPCPlugin = &ProviderGRPCPlugin{}
