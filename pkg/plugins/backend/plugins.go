package plugins

import (
	"os/exec"

	"golang.org/x/net/context"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/plugins/backend/shared"
	"github.com/grafana/grafana/pkg/tsdb/models"
	plugin "github.com/hashicorp/go-plugin"
)

func Init() (*plugin.Client, error) {
	/*
		setup protoc using https://gist.github.com/bergquist/5df1f201bb605e42538ef40f6ccf82a9
		run "protoc --go_out=plugins=grpc:. *.proto" to update proto files
	*/

	logger := log.New("grafana.plugins")
	client := plugin.NewClient(&plugin.ClientConfig{
		HandshakeConfig: plugin.HandshakeConfig{
			ProtocolVersion:  1,
			MagicCookieKey:   "BASIC_PLUGIN",
			MagicCookieValue: "hello",
		},
		Plugins:          shared.PluginMap,
		Cmd:              exec.Command("sh", "-c", "/home/carl/go/src/github.com/grafana/grafana/pkg/plugins/backend/mock_tsdb_plugin/simple-plugin"),
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
