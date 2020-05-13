package pluginextensionv2

import (
	"context"

	"github.com/hashicorp/go-plugin"
	"google.golang.org/grpc"
)

type RendererPlugin interface {
	RendererClient
}

type RendererGRPCPlugin struct {
	plugin.NetRPCUnsupportedPlugin
}

func (p *RendererGRPCPlugin) GRPCServer(broker *plugin.GRPCBroker, s *grpc.Server) error {
	return nil
}

func (p *RendererGRPCPlugin) GRPCClient(ctx context.Context, broker *plugin.GRPCBroker, c *grpc.ClientConn) (interface{}, error) {
	return &RendererGRPCClient{NewRendererClient(c)}, nil
}

type RendererGRPCClient struct {
	RendererClient
}

func (m *RendererGRPCClient) Render(ctx context.Context, req *RenderRequest, opts ...grpc.CallOption) (*RenderResponse, error) {
	return m.RendererClient.Render(ctx, req)
}

var _ RendererClient = &RendererGRPCClient{}
var _ plugin.GRPCPlugin = &RendererGRPCPlugin{}
