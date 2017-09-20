package shared

import (
	proto "github.com/grafana/grafana/pkg/tsdb/plugins/proto"
	"golang.org/x/net/context"
)

type GRPCClient struct {
	proto.TsdbPluginClient
}

func (m *GRPCClient) Get(ctx context.Context, req *proto.TsdbRequest) (*proto.TsdbResponse, error) {
	return m.TsdbPluginClient.Get(ctx, req)
}

type GRPCServer struct {
	TsdbPlugin
}

func (m *GRPCServer) Get(ctx context.Context, req *proto.TsdbRequest) (*proto.TsdbResponse, error) {
	return m.TsdbPlugin.Get(ctx, req)
}
