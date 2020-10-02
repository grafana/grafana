package grpcplugin

import (
	"context"
	"io"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/grpcplugin"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/pluginextensionv2"
	"github.com/grafana/grafana/pkg/util/errutil"
	"github.com/hashicorp/go-plugin"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type clientV2 struct {
	grpcplugin.DiagnosticsClient
	grpcplugin.ResourceClient
	grpcplugin.DataClient
	grpcplugin.TransformClient
	pluginextensionv2.RendererPlugin
}

func newClientV2(descriptor PluginDescriptor, logger log.Logger, rpcClient plugin.ClientProtocol) (pluginClient, error) {
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

	rawTransform, err := rpcClient.Dispense("transform")
	if err != nil {
		return nil, err
	}

	rawRenderer, err := rpcClient.Dispense("renderer")
	if err != nil {
		return nil, err
	}

	c := clientV2{}
	if rawDiagnostics != nil {
		if plugin, ok := rawDiagnostics.(grpcplugin.DiagnosticsClient); ok {
			c.DiagnosticsClient = plugin
		}
	}

	if rawResource != nil {
		if plugin, ok := rawResource.(grpcplugin.ResourceClient); ok {
			c.ResourceClient = plugin
		}
	}

	if rawData != nil {
		if plugin, ok := rawData.(grpcplugin.DataClient); ok {
			c.DataClient = instrumentDataClient(plugin)
		}
	}

	if rawTransform != nil {
		if plugin, ok := rawTransform.(grpcplugin.TransformClient); ok {
			c.TransformClient = instrumentTransformPlugin(plugin)
		}
	}

	if rawRenderer != nil {
		if plugin, ok := rawRenderer.(pluginextensionv2.RendererPlugin); ok {
			c.RendererPlugin = plugin
		}
	}

	if descriptor.startFns.OnStart != nil {
		client := &Client{
			DataPlugin:      c.DataClient,
			TransformPlugin: c.TransformClient,
			RendererPlugin:  c.RendererPlugin,
		}
		if err := descriptor.startFns.OnStart(descriptor.pluginID, client, logger); err != nil {
			return nil, err
		}
	}

	return &c, nil
}

func (c *clientV2) CollectMetrics(ctx context.Context) (*backend.CollectMetricsResult, error) {
	if c.DiagnosticsClient == nil {
		return &backend.CollectMetricsResult{}, nil
	}

	protoResp, err := c.DiagnosticsClient.CollectMetrics(ctx, &pluginv2.CollectMetricsRequest{})
	if err != nil {
		if status.Code(err) == codes.Unimplemented {
			return &backend.CollectMetricsResult{}, nil
		}

		return nil, err
	}

	return backend.FromProto().CollectMetricsResponse(protoResp), nil
}

func (c *clientV2) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if c.DiagnosticsClient == nil {
		return nil, backendplugin.ErrMethodNotImplemented
	}

	protoContext := backend.ToProto().PluginContext(req.PluginContext)
	protoResp, err := c.DiagnosticsClient.CheckHealth(ctx, &pluginv2.CheckHealthRequest{PluginContext: protoContext})

	if err != nil {
		if status.Code(err) == codes.Unimplemented {
			return &backend.CheckHealthResult{
				Status:  backend.HealthStatusUnknown,
				Message: "Health check not implemented",
			}, nil
		}
		return nil, err
	}

	return backend.FromProto().CheckHealthResponse(protoResp), nil
}

func (c *clientV2) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if c.ResourceClient == nil {
		return backendplugin.ErrMethodNotImplemented
	}

	protoReq := backend.ToProto().CallResourceRequest(req)
	protoStream, err := c.ResourceClient.CallResource(ctx, protoReq)
	if err != nil {
		if status.Code(err) == codes.Unimplemented {
			return backendplugin.ErrMethodNotImplemented
		}

		return errutil.Wrap("Failed to call resource", err)
	}

	for {
		protoResp, err := protoStream.Recv()
		if err != nil {
			if status.Code(err) == codes.Unimplemented {
				return backendplugin.ErrMethodNotImplemented
			}

			if err == io.EOF {
				return nil
			}

			return errutil.Wrap("Failed to receive call resource response", err)
		}

		if err := sender.Send(backend.FromProto().CallResourceResponse(protoResp)); err != nil {
			return err
		}
	}
}

type dataClientQueryDataFunc func(ctx context.Context, req *pluginv2.QueryDataRequest, opts ...grpc.CallOption) (*pluginv2.QueryDataResponse, error)

func (fn dataClientQueryDataFunc) QueryData(ctx context.Context, req *pluginv2.QueryDataRequest, opts ...grpc.CallOption) (*pluginv2.QueryDataResponse, error) {
	return fn(ctx, req, opts...)
}

func instrumentDataClient(plugin grpcplugin.DataClient) grpcplugin.DataClient {
	if plugin == nil {
		return nil
	}

	return dataClientQueryDataFunc(func(ctx context.Context, req *pluginv2.QueryDataRequest, opts ...grpc.CallOption) (*pluginv2.QueryDataResponse, error) {
		var resp *pluginv2.QueryDataResponse
		err := backendplugin.InstrumentQueryDataRequest(req.PluginContext.PluginId, func() (innerErr error) {
			resp, innerErr = plugin.QueryData(ctx, req)
			return
		})
		return resp, err
	})
}

type transformPluginTransformDataFunc func(ctx context.Context, req *pluginv2.QueryDataRequest, callback grpcplugin.TransformDataCallBack) (*pluginv2.QueryDataResponse, error)

func (fn transformPluginTransformDataFunc) TransformData(ctx context.Context, req *pluginv2.QueryDataRequest, callback grpcplugin.TransformDataCallBack) (*pluginv2.QueryDataResponse, error) {
	return fn(ctx, req, callback)
}

func instrumentTransformPlugin(plugin grpcplugin.TransformClient) grpcplugin.TransformClient {
	if plugin == nil {
		return nil
	}

	return transformPluginTransformDataFunc(func(ctx context.Context, req *pluginv2.QueryDataRequest, callback grpcplugin.TransformDataCallBack) (*pluginv2.QueryDataResponse, error) {
		var resp *pluginv2.QueryDataResponse
		err := backendplugin.InstrumentTransformDataRequest(req.PluginContext.PluginId, func() (innerErr error) {
			resp, innerErr = plugin.TransformData(ctx, req, callback)
			return
		})
		return resp, err
	})
}
