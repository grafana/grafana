package plugins

import (
	"fmt"
	"os"
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
		Generate

		sudo protoc --go_out=. *.proto
		protoc --go_out=plugins=grpc:. *.proto
	*/
	// initial goal: pass a string object back and forth over grpc.
	// simplify tsdb req/res message/service

	//lets be silly
	//plugin path
	client := plugin.NewClient(&plugin.ClientConfig{
		HandshakeConfig:  shared.Handshake,
		Plugins:          shared.PluginMap,
		Cmd:              exec.Command("sh", "-c", "/home/carl/go/src/github.com/grafana/simple-plugin/simple-plugin"),
		AllowedProtocols: []plugin.Protocol{plugin.ProtocolGRPC},
	})

	// Connect via RPC
	rpcClient, err := client.Client()
	if err != nil {
		fmt.Println("Error:", err.Error())
		os.Exit(1)
	}

	// Request the plugin
	raw, err := rpcClient.Dispense("kv")
	if err != nil {
		fmt.Println("Error:", err.Error())
		//os.Exit(1)
		//client.Kill()
		return nil, err
	}

	plugin := raw.(shared.TsdbPlugin)
	response, err := plugin.Get(context.Background(), &proto.TsdbRequest{})

	log.Error2("got response from plugin. ", "response", response)

	return client, nil
}
