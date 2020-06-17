package grpcplugin

import (
	"context"

	datasourceV1 "github.com/grafana/grafana-plugin-model/go/datasource"
	rendererV1 "github.com/grafana/grafana-plugin-model/go/renderer"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/hashicorp/go-plugin"
)

type clientV1 struct {
	logger log.Logger
	datasourceV1.DatasourcePlugin
	rendererV1.RendererPlugin
}

func newClientV1(descriptor PluginDescriptor, logger log.Logger, rpcClient plugin.ClientProtocol) (pluginClient, error) {
	logger.Warn("Plugin uses a deprecated version of Grafana's backend plugin system which will be removed in a future release. " +
		"Consider upgrading to a newer plugin version or reach out to the plugin repository/developer and request an upgrade.")

	raw, err := rpcClient.Dispense(descriptor.pluginID)
	if err != nil {
		return nil, err
	}

	c := clientV1{
		logger: logger,
	}
	if plugin, ok := raw.(datasourceV1.DatasourcePlugin); ok {
		c.DatasourcePlugin = instrumentDatasourcePluginV1(plugin)
	}

	if plugin, ok := raw.(rendererV1.RendererPlugin); ok {
		c.RendererPlugin = plugin
	}

	if descriptor.startFns.OnLegacyStart != nil {
		legacyClient := &LegacyClient{
			DatasourcePlugin: c.DatasourcePlugin,
			RendererPlugin:   c.RendererPlugin,
		}
		if err := descriptor.startFns.OnLegacyStart(descriptor.pluginID, legacyClient, logger); err != nil {
			return nil, err
		}
	}

	return &c, nil
}

func (c *clientV1) CollectMetrics(ctx context.Context) (*backend.CollectMetricsResult, error) {
	return nil, backendplugin.ErrMethodNotImplemented
}

func (c *clientV1) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	return nil, backendplugin.ErrMethodNotImplemented
}

func (c *clientV1) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	return backendplugin.ErrMethodNotImplemented
}

type datasourceV1QueryFunc func(ctx context.Context, req *datasourceV1.DatasourceRequest) (*datasourceV1.DatasourceResponse, error)

func (fn datasourceV1QueryFunc) Query(ctx context.Context, req *datasourceV1.DatasourceRequest) (*datasourceV1.DatasourceResponse, error) {
	return fn(ctx, req)
}

func instrumentDatasourcePluginV1(plugin datasourceV1.DatasourcePlugin) datasourceV1.DatasourcePlugin {
	if plugin == nil {
		return nil
	}

	return datasourceV1QueryFunc(func(ctx context.Context, req *datasourceV1.DatasourceRequest) (*datasourceV1.DatasourceResponse, error) {
		var resp *datasourceV1.DatasourceResponse
		err := backendplugin.InstrumentQueryDataRequest(req.Datasource.Type, func() (innerErr error) {
			resp, innerErr = plugin.Query(ctx, req)
			return
		})
		return resp, err
	})
}
