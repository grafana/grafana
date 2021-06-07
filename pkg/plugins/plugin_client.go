package plugins

import (
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdk "github.com/grafana/grafana-plugin-sdk-go/backend/grpcplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/grpcplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/pluginextensionv2"
	"github.com/hashicorp/go-plugin"
)

type PluginClient interface {
	backend.QueryDataHandler
	backend.CollectMetricsHandler
	backend.CheckHealthHandler
	backend.CallResourceHandler
	backend.StreamHandler
}

func newRPCClient(rpcClient plugin.ClientProtocol) (PluginClient, error) {
	rawDiagnostics, err := rpcClient.Dispense("diagnostics")
	if err != nil {
		return nil, err
	}

	rawResource, err := rpcClient.Dispense("resource")
	if err != nil {
		return nil, err
	}

	rawData, err := rpcClient.Dispense("data")
	if err != nil {
		return nil, err
	}

	rawStream, err := rpcClient.Dispense("stream")
	if err != nil {
		return nil, err
	}

	rawRenderer, err := rpcClient.Dispense("renderer")
	if err != nil {
		return nil, err
	}

	c := grpcplugin.ClientV2{}
	if rawDiagnostics != nil {
		if diagnosticsClient, ok := rawDiagnostics.(sdk.DiagnosticsClient); ok {
			c.DiagnosticsClient = diagnosticsClient
		}
	}

	if rawResource != nil {
		if resourceClient, ok := rawResource.(sdk.ResourceClient); ok {
			c.ResourceClient = resourceClient
		}
	}

	if rawData != nil {
		if dataClient, ok := rawData.(sdk.DataClient); ok {
			c.DataClient = dataClient
		}
	}

	if rawStream != nil {
		if streamClient, ok := rawStream.(sdk.StreamClient); ok {
			c.StreamClient = streamClient
		}
	}

	if rawRenderer != nil {
		if rendererPlugin, ok := rawRenderer.(pluginextensionv2.RendererPlugin); ok {
			c.RendererPlugin = rendererPlugin
		}
	}

	return &c, nil
}
