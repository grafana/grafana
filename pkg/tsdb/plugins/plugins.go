package plugins

import (
	"os/exec"

	"golang.org/x/net/context"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/tsdb/plugins/proto"
	"github.com/grafana/grafana/pkg/tsdb/plugins/shared"
	plugin "github.com/hashicorp/go-plugin"
)

func Init() (*plugin.Client, error) {
	/*
		Setup

		go get -u google.golang.org/grpc \
		go get -u github.com/golang/protobuf/{proto,protoc-gen-go} \
		go get -u github.com/grpc-ecosystem/grpc-gateway/protoc-gen-grpc-gateway \
	*/

	/*
		protoc --go_out=plugins=grpc:. *.proto
	*/
	logger := log.New("grafana.plugins")
	client := plugin.NewClient(&plugin.ClientConfig{
		HandshakeConfig: plugin.HandshakeConfig{
			ProtocolVersion:  1,
			MagicCookieKey:   "BASIC_PLUGIN",
			MagicCookieValue: "hello",
		},
		Plugins:          shared.PluginMap,
		Cmd:              exec.Command("sh", "-c", "/home/carl/go/src/github.com/grafana/grafana/pkg/tsdb/plugins/mock_tsdb_plugin/simple-plugin"),
		AllowedProtocols: []plugin.Protocol{plugin.ProtocolGRPC},
		Logger:           logWrapper{logger: logger},
	})

	// Connect via RPC
	rpcClient, err := client.Client()
	if err != nil {
		return nil, err
	}

	// Request the plugin
	raw, err := rpcClient.Dispense("tsdb_mock")
	if err != nil {
		return nil, err
	}

	plugin := raw.(shared.TsdbPlugin)
	response, err := plugin.Get(context.Background(), &proto.TsdbRequest{})

	if err != nil {
		logger.Error("Response from plugin. ", "response", response)
	} else {
		logger.Info("Response from plugin. ", "response", response)
	}

	return client, nil
}
