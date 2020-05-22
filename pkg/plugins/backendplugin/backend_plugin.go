package backendplugin

import (
	"context"
	"errors"
	"net/http"

	datasourceV1 "github.com/grafana/grafana-plugin-model/go/datasource"
	rendererV1 "github.com/grafana/grafana-plugin-model/go/renderer"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/pluginextensionv2"
	"github.com/grafana/grafana/pkg/util/errutil"
	plugin "github.com/hashicorp/go-plugin"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// BackendPlugin a registered backend plugin.
type BackendPlugin struct {
	id             string
	executablePath string
	managed        bool
	clientFactory  func() *plugin.Client
	client         *plugin.Client
	logger         log.Logger
	startFns       PluginStartFuncs
	diagnostics    DiagnosticsPlugin
	resource       ResourcePlugin
}

func (p *BackendPlugin) start(ctx context.Context) error {
	p.client = p.clientFactory()
	rpcClient, err := p.client.Client()
	if err != nil {
		return err
	}

	var legacyClient *LegacyClient
	var client *Client

	if p.client.NegotiatedVersion() > 1 {
		rawDiagnostics, err := rpcClient.Dispense("diagnostics")
		if err != nil {
			return err
		}

		rawResource, err := rpcClient.Dispense("resource")
		if err != nil {
			return err
		}

		rawData, err := rpcClient.Dispense("data")
		if err != nil {
			return err
		}

		rawTransform, err := rpcClient.Dispense("transform")
		if err != nil {
			return err
		}

		rawRenderer, err := rpcClient.Dispense("renderer")
		if err != nil {
			return err
		}

		if rawDiagnostics != nil {
			if plugin, ok := rawDiagnostics.(DiagnosticsPlugin); ok {
				p.diagnostics = plugin
			}
		}

		client = &Client{}
		if rawResource != nil {
			if plugin, ok := rawResource.(ResourcePlugin); ok {
				p.resource = plugin
				client.ResourcePlugin = plugin
			}
		}

		if rawData != nil {
			if plugin, ok := rawData.(DataPlugin); ok {
				client.DataPlugin = plugin
			}
		}

		if rawTransform != nil {
			if plugin, ok := rawTransform.(TransformPlugin); ok {
				client.TransformPlugin = plugin
			}
		}

		if rawRenderer != nil {
			if plugin, ok := rawRenderer.(pluginextensionv2.RendererPlugin); ok {
				client.RendererPlugin = plugin
			}
		}
	} else {
		p.logger.Warn("Plugin uses a deprecated version of Grafana's backend plugin system which will be removed in a future release. " +
			"Consider upgrading to a newer plugin version or reach out to the plugin repository/developer and request an upgrade.")
		raw, err := rpcClient.Dispense(p.id)
		if err != nil {
			return err
		}

		legacyClient = &LegacyClient{}
		if plugin, ok := raw.(datasourceV1.DatasourcePlugin); ok {
			legacyClient.DatasourcePlugin = plugin
		}

		if plugin, ok := raw.(rendererV1.RendererPlugin); ok {
			legacyClient.RendererPlugin = plugin
		}
	}

	if legacyClient == nil && client == nil {
		return errors.New("no compatible plugin implementation found")
	}

	if legacyClient != nil && p.startFns.OnLegacyStart != nil {
		if err := p.startFns.OnLegacyStart(p.id, legacyClient, p.logger); err != nil {
			return err
		}
	}

	if client != nil && p.startFns.OnStart != nil {
		if err := p.startFns.OnStart(p.id, client, p.logger); err != nil {
			return err
		}
	}

	return nil
}

func (p *BackendPlugin) stop() error {
	if p.client != nil {
		p.client.Kill()
	}
	return nil
}

// supportsDiagnostics return whether backend plugin supports diagnostics like metrics and health check.
func (p *BackendPlugin) supportsDiagnostics() bool {
	return p.diagnostics != nil
}

// CollectMetrics implements the collector.Collector interface.
func (p *BackendPlugin) CollectMetrics(ctx context.Context) (*pluginv2.CollectMetricsResponse, error) {
	if p.diagnostics == nil || p.client == nil || p.client.Exited() {
		return &pluginv2.CollectMetricsResponse{
			Metrics: &pluginv2.CollectMetricsResponse_Payload{},
		}, nil
	}

	var res *pluginv2.CollectMetricsResponse
	err := InstrumentPluginRequest(p.id, "metrics", func() error {
		var innerErr error
		res, innerErr = p.diagnostics.CollectMetrics(ctx, &pluginv2.CollectMetricsRequest{})

		return innerErr
	})

	if err != nil {
		if st, ok := status.FromError(err); ok {
			if st.Code() == codes.Unimplemented {
				return &pluginv2.CollectMetricsResponse{
					Metrics: &pluginv2.CollectMetricsResponse_Payload{},
				}, nil
			}
		}

		return nil, err
	}

	return res, nil
}

var toProto = backend.ToProto()

func (p *BackendPlugin) checkHealth(ctx context.Context, pCtx backend.PluginContext) (*pluginv2.CheckHealthResponse, error) {
	if p.diagnostics == nil || p.client == nil || p.client.Exited() {
		return &pluginv2.CheckHealthResponse{
			Status: pluginv2.CheckHealthResponse_UNKNOWN,
		}, nil
	}

	protoContext := toProto.PluginContext(pCtx)

	var res *pluginv2.CheckHealthResponse
	err := InstrumentPluginRequest(p.id, "checkhealth", func() error {
		var innerErr error
		res, innerErr = p.diagnostics.CheckHealth(ctx, &pluginv2.CheckHealthRequest{PluginContext: protoContext})
		return innerErr
	})

	if err != nil {
		if st, ok := status.FromError(err); ok {
			if st.Code() == codes.Unimplemented {
				return &pluginv2.CheckHealthResponse{
					Status:  pluginv2.CheckHealthResponse_UNKNOWN,
					Message: "Health check not implemented",
				}, nil
			}
		}
		return nil, err
	}

	return res, nil
}

func (p *BackendPlugin) callResource(ctx context.Context, req *backend.CallResourceRequest) (callResourceResultStream, error) {
	p.logger.Debug("Calling resource", "path", req.Path, "method", req.Method)

	if p.resource == nil || p.client == nil || p.client.Exited() {
		return nil, errors.New("plugin not running, cannot call resource")
	}

	protoReq := toProto.CallResourceRequest(req)

	protoStream, err := p.resource.CallResource(ctx, protoReq)
	if err != nil {
		if st, ok := status.FromError(err); ok {
			if st.Code() == codes.Unimplemented {
				return &singleCallResourceResult{
					result: &CallResourceResult{
						Status: http.StatusNotImplemented,
					},
				}, nil
			}
		}

		return nil, errutil.Wrap("Failed to call resource", err)
	}

	return &callResourceResultStreamImpl{
		stream: protoStream,
	}, nil
}
