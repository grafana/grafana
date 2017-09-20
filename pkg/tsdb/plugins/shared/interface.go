package shared

import (
	"golang.org/x/net/context"

	proto "github.com/grafana/grafana/pkg/tsdb/plugins/proto"
	plugin "github.com/hashicorp/go-plugin"
	"google.golang.org/grpc"
)

var PluginMap = map[string]plugin.Plugin{
	"tsdb_mock": &TsdbPluginImpl{},
}

type TsdbPlugin interface {
	Get(ctx context.Context, req *proto.TsdbRequest) (*proto.TsdbResponse, error)
}

type TsdbPluginImpl struct { //LOL IMPL LOL
	plugin.NetRPCUnsupportedPlugin
	Plugin TsdbPlugin
}

func (p *TsdbPluginImpl) GRPCServer(s *grpc.Server) error {
	proto.RegisterTsdbPluginServer(s, &GRPCServer{p.Plugin})
	return nil
}

func (p *TsdbPluginImpl) GRPCClient(c *grpc.ClientConn) (interface{}, error) {
	return &GRPCClient{proto.NewTsdbPluginClient(c)}, nil
}
