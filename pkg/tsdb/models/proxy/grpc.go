package proxy

import (
	proto "github.com/grafana/grafana/pkg/tsdb/models"
	"golang.org/x/net/context"
)

type GRPCClient struct {
	proto.TsdbPluginClient
}

func (m *GRPCClient) Query(ctx context.Context, req *proto.TsdbQuery) (*proto.Response, error) {
	return m.TsdbPluginClient.Query(ctx, req)
}

type GRPCServer struct {
	TsdbPlugin
}

func (m *GRPCServer) Query(ctx context.Context, req *proto.TsdbQuery) (*proto.Response, error) {
	return m.TsdbPlugin.Query(ctx, req)
}
