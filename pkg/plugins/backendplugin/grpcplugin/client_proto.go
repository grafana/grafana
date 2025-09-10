package grpcplugin

import (
	"context"
	"errors"

	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/log"
)

var (
	errClientNotAvailable = errors.New("plugin client not available")
)

var _ ProtoClient = (*protoClient)(nil)

type PluginV2 interface {
	pluginv2.DataClient
	pluginv2.ResourceClient
	pluginv2.DiagnosticsClient
	pluginv2.StreamClient
	pluginv2.AdmissionControlClient
	pluginv2.ResourceConversionClient
}

type ProtoClient interface {
	PluginV2

	PID(context.Context) (string, error)
	PluginID() string
	PluginVersion() string
	Backend() backendplugin.Plugin
}

type protoClient struct {
	plugin     *grpcPlugin
	pluginJSON plugins.JSONData
}

type ProtoClientOpts struct {
	PluginJSON      plugins.JSONData
	ExecutablePath  string
	ExecutableArgs  []string
	Env             []string
	ContainerMode   ContainerModeOpts
	SkipHostEnvVars bool
	Logger          log.Logger
	Tracer          trace.Tracer
}

type ContainerModeOpts struct {
	Enabled bool
	Image   string
}

func NewProtoClient(opts ProtoClientOpts) (ProtoClient, error) {
	p := newGrpcPlugin(
		PluginDescriptor{
			pluginID:         opts.PluginJSON.ID,
			managed:          true,
			executablePath:   opts.ExecutablePath,
			executableArgs:   opts.ExecutableArgs,
			versionedPlugins: pluginSet,
			containerMode: containerModeOpts{
				enabled: opts.ContainerMode.Enabled,
				image:   opts.ContainerMode.Image,
			},
			skipHostEnvVars: opts.SkipHostEnvVars,
		},
		opts.Logger,
		opts.Tracer,
		func() []string { return opts.Env },
	)

	return &protoClient{plugin: p, pluginJSON: opts.PluginJSON}, nil
}

func (r *protoClient) PID(ctx context.Context) (string, error) {
	if _, exists := r.client(ctx); !exists {
		return "", errClientNotAvailable
	}
	return r.plugin.client.ID(), nil
}

func (r *protoClient) PluginID() string {
	return r.plugin.descriptor.pluginID
}

func (r *protoClient) PluginVersion() string {
	return r.pluginJSON.Info.Version
}

func (r *protoClient) Backend() backendplugin.Plugin {
	return r.plugin
}

func (r *protoClient) Logger() log.Logger {
	return r.plugin.logger
}

func (r *protoClient) client(ctx context.Context) (*ClientV2, bool) {
	return r.plugin.getPluginClient(ctx)
}

func (r *protoClient) QueryData(ctx context.Context, in *pluginv2.QueryDataRequest, opts ...grpc.CallOption) (*pluginv2.QueryDataResponse, error) {
	c, exists := r.client(ctx)
	if !exists {
		return nil, errClientNotAvailable
	}
	return c.DataClient.QueryData(ctx, in, opts...)
}

func (r *protoClient) CallResource(ctx context.Context, in *pluginv2.CallResourceRequest, opts ...grpc.CallOption) (pluginv2.Resource_CallResourceClient, error) {
	c, exists := r.client(ctx)
	if !exists {
		return nil, errClientNotAvailable
	}
	return c.ResourceClient.CallResource(ctx, in, opts...)
}

func (r *protoClient) CheckHealth(ctx context.Context, in *pluginv2.CheckHealthRequest, opts ...grpc.CallOption) (*pluginv2.CheckHealthResponse, error) {
	c, exists := r.client(ctx)
	if !exists {
		return nil, errClientNotAvailable
	}
	return c.DiagnosticsClient.CheckHealth(ctx, in, opts...)
}

func (r *protoClient) CollectMetrics(ctx context.Context, in *pluginv2.CollectMetricsRequest, opts ...grpc.CallOption) (*pluginv2.CollectMetricsResponse, error) {
	c, exists := r.client(ctx)
	if !exists {
		return nil, errClientNotAvailable
	}
	return c.DiagnosticsClient.CollectMetrics(ctx, in, opts...)
}

func (r *protoClient) SubscribeStream(ctx context.Context, in *pluginv2.SubscribeStreamRequest, opts ...grpc.CallOption) (*pluginv2.SubscribeStreamResponse, error) {
	c, exists := r.client(ctx)
	if !exists {
		return nil, errClientNotAvailable
	}
	return c.StreamClient.SubscribeStream(ctx, in, opts...)
}

func (r *protoClient) RunStream(ctx context.Context, in *pluginv2.RunStreamRequest, opts ...grpc.CallOption) (pluginv2.Stream_RunStreamClient, error) {
	c, exists := r.client(ctx)
	if !exists {
		return nil, errClientNotAvailable
	}
	return c.StreamClient.RunStream(ctx, in, opts...)
}

func (r *protoClient) PublishStream(ctx context.Context, in *pluginv2.PublishStreamRequest, opts ...grpc.CallOption) (*pluginv2.PublishStreamResponse, error) {
	c, exists := r.client(ctx)
	if !exists {
		return nil, errClientNotAvailable
	}
	return c.StreamClient.PublishStream(ctx, in, opts...)
}

func (r *protoClient) ValidateAdmission(ctx context.Context, in *pluginv2.AdmissionRequest, opts ...grpc.CallOption) (*pluginv2.ValidationResponse, error) {
	c, exists := r.client(ctx)
	if !exists {
		return nil, errClientNotAvailable
	}
	return c.AdmissionClient.ValidateAdmission(ctx, in, opts...)
}

func (r *protoClient) MutateAdmission(ctx context.Context, in *pluginv2.AdmissionRequest, opts ...grpc.CallOption) (*pluginv2.MutationResponse, error) {
	c, exists := r.client(ctx)
	if !exists {
		return nil, errClientNotAvailable
	}
	return c.AdmissionClient.MutateAdmission(ctx, in, opts...)
}

func (r *protoClient) ConvertObjects(ctx context.Context, in *pluginv2.ConversionRequest, opts ...grpc.CallOption) (*pluginv2.ConversionResponse, error) {
	c, exists := r.client(ctx)
	if !exists {
		return nil, errClientNotAvailable
	}
	return c.ConversionClient.ConvertObjects(ctx, in, opts...)
}
