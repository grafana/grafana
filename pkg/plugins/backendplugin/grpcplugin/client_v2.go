package grpcplugin

import (
	"context"
	"errors"
	"fmt"
	"io"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/grpcplugin"
	errstatus "github.com/grafana/grafana-plugin-sdk-go/experimental/status"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/hashicorp/go-plugin"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/pluginextensionv2"
	"github.com/grafana/grafana/pkg/plugins/log"
)

var (
	logger = log.New("plugins.clientv2")
)

type ClientV2 struct {
	grpcplugin.DiagnosticsClient
	grpcplugin.ResourceClient
	grpcplugin.DataClient
	grpcplugin.StreamClient
	grpcplugin.AdmissionClient
	grpcplugin.ConversionClient
	pluginextensionv2.RendererPlugin
}

func newClientV2(descriptor PluginDescriptor, logger log.Logger, rpcClient plugin.ClientProtocol) (*ClientV2, error) {
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

	rawAdmission, err := rpcClient.Dispense("admission")
	if err != nil {
		return nil, err
	}

	rawConversion, err := rpcClient.Dispense("conversion")
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

	c := &ClientV2{}
	if rawDiagnostics != nil {
		if diagnosticsClient, ok := rawDiagnostics.(grpcplugin.DiagnosticsClient); ok {
			c.DiagnosticsClient = diagnosticsClient
		}
	}

	if rawResource != nil {
		if resourceClient, ok := rawResource.(grpcplugin.ResourceClient); ok {
			c.ResourceClient = resourceClient
		}
	}

	if rawData != nil {
		if dataClient, ok := rawData.(grpcplugin.DataClient); ok {
			c.DataClient = dataClient
		}
	}

	if rawAdmission != nil {
		if admissionClient, ok := rawAdmission.(grpcplugin.AdmissionClient); ok {
			c.AdmissionClient = admissionClient
		}
	}

	if rawConversion != nil {
		if conversionClient, ok := rawConversion.(grpcplugin.ConversionClient); ok {
			c.ConversionClient = conversionClient
		}
	}

	if rawStream != nil {
		if streamClient, ok := rawStream.(grpcplugin.StreamClient); ok {
			c.StreamClient = streamClient
		}
	}

	if rawRenderer != nil {
		if rendererPlugin, ok := rawRenderer.(pluginextensionv2.RendererPlugin); ok {
			c.RendererPlugin = rendererPlugin
		}
	}

	if descriptor.startRendererFn != nil {
		if err := descriptor.startRendererFn(descriptor.pluginID, c.RendererPlugin, logger); err != nil {
			return nil, err
		}
	}

	return c, nil
}

func (c *ClientV2) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	if c.DiagnosticsClient == nil {
		return &backend.CollectMetricsResult{}, nil
	}

	protoResp, err := c.DiagnosticsClient.CollectMetrics(ctx, backend.ToProto().CollectMetricsRequest(req))
	if err != nil {
		if status.Code(err) == codes.Unimplemented {
			return &backend.CollectMetricsResult{}, nil
		}

		return nil, err
	}

	return backend.FromProto().CollectMetricsResponse(protoResp), nil
}

func (c *ClientV2) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if c.DiagnosticsClient == nil {
		return nil, plugins.ErrMethodNotImplemented
	}

	protoContext := backend.ToProto().PluginContext(req.PluginContext)
	protoResp, err := c.DiagnosticsClient.CheckHealth(ctx, &pluginv2.CheckHealthRequest{PluginContext: protoContext, Headers: req.Headers})

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

func (c *ClientV2) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if c.DataClient == nil {
		return nil, plugins.ErrMethodNotImplemented
	}

	protoReq := backend.ToProto().QueryDataRequest(req)
	protoResp, err := c.DataClient.QueryData(ctx, protoReq)

	if err != nil {
		if status.Code(err) == codes.Unimplemented {
			return nil, plugins.ErrMethodNotImplemented
		}

		if status.Code(err) == codes.Unavailable {
			return nil, plugins.ErrPluginGrpcConnectionUnavailableBaseFn(ctx).Errorf("%v", err)
		}

		if status.Code(err) == codes.ResourceExhausted {
			return nil, plugins.ErrPluginGrpcResourceExhaustedBase.Errorf("%v", err)
		}

		if errorSource, ok := backend.ErrorSourceFromGrpcStatusError(ctx, err); ok {
			return nil, handleGrpcStatusError(ctx, errorSource, err)
		}
		return nil, fmt.Errorf("%v: %w", "Failed to query data", err)
	}

	return backend.FromProto().QueryDataResponse(protoResp)
}

func (c *ClientV2) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if c.ResourceClient == nil {
		return plugins.ErrMethodNotImplemented
	}

	protoReq := backend.ToProto().CallResourceRequest(req)
	protoStream, err := c.ResourceClient.CallResource(ctx, protoReq)
	if err != nil {
		if status.Code(err) == codes.Unimplemented {
			return plugins.ErrMethodNotImplemented
		}

		return fmt.Errorf("%v: %w", "Failed to call resource", err)
	}

	for {
		protoResp, err := protoStream.Recv()
		if err != nil {
			if status.Code(err) == codes.Unimplemented {
				return plugins.ErrMethodNotImplemented
			}

			if errors.Is(err, io.EOF) {
				return nil
			}

			return fmt.Errorf("%v: %w", "failed to receive call resource response", err)
		}

		if err := sender.Send(backend.FromProto().CallResourceResponse(protoResp)); err != nil {
			return err
		}
	}
}

func (c *ClientV2) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	if c.StreamClient == nil {
		return nil, plugins.ErrMethodNotImplemented
	}
	protoResp, err := c.StreamClient.SubscribeStream(ctx, backend.ToProto().SubscribeStreamRequest(req))
	if err != nil {
		return nil, err
	}
	return backend.FromProto().SubscribeStreamResponse(protoResp), nil
}

func (c *ClientV2) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	if c.StreamClient == nil {
		return nil, plugins.ErrMethodNotImplemented
	}
	protoResp, err := c.StreamClient.PublishStream(ctx, backend.ToProto().PublishStreamRequest(req))
	if err != nil {
		return nil, err
	}
	return backend.FromProto().PublishStreamResponse(protoResp), nil
}

func (c *ClientV2) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	if c.StreamClient == nil {
		return plugins.ErrMethodNotImplemented
	}

	protoReq := backend.ToProto().RunStreamRequest(req)
	protoStream, err := c.StreamClient.RunStream(ctx, protoReq)
	if err != nil {
		if status.Code(err) == codes.Unimplemented {
			return plugins.ErrMethodNotImplemented
		}
		return fmt.Errorf("%v: %w", "Failed to call resource", err)
	}

	for {
		p, err := protoStream.Recv()
		if err != nil {
			if status.Code(err) == codes.Unimplemented {
				return plugins.ErrMethodNotImplemented
			}
			if errors.Is(err, io.EOF) {
				return nil
			}
			return fmt.Errorf("error running stream: %w", err)
		}
		// From GRPC connection we receive already prepared JSON.
		err = sender.SendJSON(p.Data)
		if err != nil {
			return err
		}
	}
}

func (c *ClientV2) ValidateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.ValidationResponse, error) {
	if c.AdmissionClient == nil {
		return nil, plugins.ErrMethodNotImplemented
	}

	protoReq := backend.ToProto().AdmissionRequest(req)
	protoResp, err := c.AdmissionClient.ValidateAdmission(ctx, protoReq)

	if err != nil {
		if status.Code(err) == codes.Unimplemented {
			return nil, plugins.ErrMethodNotImplemented
		}

		return nil, fmt.Errorf("%v: %w", "Failed to ValidateAdmission", err)
	}

	return backend.FromProto().ValidationResponse(protoResp), nil
}

func (c *ClientV2) MutateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.MutationResponse, error) {
	if c.AdmissionClient == nil {
		return nil, plugins.ErrMethodNotImplemented
	}

	protoReq := backend.ToProto().AdmissionRequest(req)
	protoResp, err := c.AdmissionClient.MutateAdmission(ctx, protoReq)

	if err != nil {
		if status.Code(err) == codes.Unimplemented {
			return nil, plugins.ErrMethodNotImplemented
		}

		return nil, fmt.Errorf("%v: %w", "Failed to MutateAdmission", err)
	}

	return backend.FromProto().MutationResponse(protoResp), nil
}

func (c *ClientV2) ConvertObjects(ctx context.Context, req *backend.ConversionRequest) (*backend.ConversionResponse, error) {
	if c.ConversionClient == nil {
		return nil, plugins.ErrMethodNotImplemented
	}

	protoReq := backend.ToProto().ConversionRequest(req)
	protoResp, err := c.ConversionClient.ConvertObjects(ctx, protoReq)

	if err != nil {
		if status.Code(err) == codes.Unimplemented {
			return nil, plugins.ErrMethodNotImplemented
		}

		return nil, fmt.Errorf("%v: %w", "Failed to ConvertObject", err)
	}

	return backend.FromProto().ConversionResponse(protoResp), nil
}

// handleGrpcStatusError sets the error source via context based on the error source provided. Regardless of its value,
// a plugin downstream error is returned as both plugin and downstream errors are treated the same in Grafana.
func handleGrpcStatusError(ctx context.Context, errorSource errstatus.Source, err error) error {
	switch errorSource {
	case backend.ErrorSourceDownstream:
		innerErr := backend.WithErrorSource(ctx, backend.ErrorSourceDownstream)
		if innerErr != nil {
			logger.Error("Could not set downstream error source", "error", innerErr)
		}
		return plugins.ErrPluginRequestFailureErrorBase.Errorf("%v", err)
	case backend.ErrorSourcePlugin:
		errorSourceErr := backend.WithErrorSource(ctx, backend.ErrorSourcePlugin)
		if errorSourceErr != nil {
			logger.Error("Could not set plugin error source", "error", errorSourceErr)
		}
		// plugin request has failed after being sent from the Grafana server
		return plugins.ErrPluginRequestFailureErrorBase.Errorf("%v", err)
	}
	return fmt.Errorf("%v: %w", "Failed to query data", err)
}
