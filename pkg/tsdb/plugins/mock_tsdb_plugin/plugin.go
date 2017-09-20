package main

import (
	"golang.org/x/net/context"

	"log"

	"github.com/grafana/grafana/pkg/tsdb/plugins/proto"
	shared "github.com/grafana/grafana/pkg/tsdb/plugins/shared"
	plugin "github.com/hashicorp/go-plugin"
)

type Tsdb struct {
	plugin.NetRPCUnsupportedPlugin
}

func (Tsdb) Get(ctx context.Context, req *proto.TsdbRequest) (*proto.TsdbResponse, error) {
	log.Print("Tsdb.Get() from plugin")

	return &proto.TsdbResponse{
		MetaJson: "from plugins! meta meta",
	}, nil
}

func main() {
	plugin.Serve(&plugin.ServeConfig{
		HandshakeConfig: plugin.HandshakeConfig{
			ProtocolVersion:  1,
			MagicCookieKey:   "BASIC_PLUGIN",
			MagicCookieValue: "hello",
		},
		Plugins: map[string]plugin.Plugin{
			"tsdb_mock": &shared.TsdbPluginImpl{Plugin: &Tsdb{}},
		},

		// A non-nil value here enables gRPC serving for this plugin...
		GRPCServer: plugin.DefaultGRPCServer,
	})
}
