package grpcplugin

import (
	"context"
	"errors"

	goplugin "github.com/hashicorp/go-plugin"
	"google.golang.org/grpc"

	"github.com/grafana/grafana-plugin-sdk-go/backend/grpcplugin"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"

	"github.com/grafana/grafana/pkg/plugins/log"
)

var (
	errClientNotStarted = errors.New("plugin client has not been started")
)

var _ ProtoClient = (*protoClient)(nil)

type ProtoClient interface {
	pluginv2.DataClient
	pluginv2.ResourceClient
	pluginv2.DiagnosticsClient
	pluginv2.StreamClient

	PluginID() string
	Logger() log.Logger
	Start(context.Context) error
	Stop(context.Context) error
}

type protoClient struct {
	plugin *grpcPlugin
}

type ProtoClientOpts struct {
	PluginID       string
	ExecutablePath string
	ExecutableArgs []string
	Env            []string
}

func NewProtoClient(opts ProtoClientOpts) (ProtoClient, error) {
	d := PluginDescriptor{
		pluginID:       opts.PluginID,
		executablePath: opts.ExecutablePath,
		executableArgs: opts.ExecutableArgs,
		managed:        true,
		versionedPlugins: map[int]goplugin.PluginSet{
			grpcplugin.ProtocolVersion: getV2PluginSet(),
		},
	}
	logger := log.New(opts.PluginID)
	p := &grpcPlugin{
		descriptor: d,
		logger:     logger,
		clientFactory: func() *goplugin.Client {
			return goplugin.NewClient(newClientConfig(opts.ExecutablePath, opts.ExecutableArgs, opts.Env, logger, d.versionedPlugins))
		},
	}

	return &protoClient{plugin: p}, nil
}

func (r *protoClient) PluginID() string {
	return r.plugin.descriptor.pluginID
}

func (r *protoClient) Logger() log.Logger {
	return r.plugin.logger
}

func (r *protoClient) Start(ctx context.Context) error {
	return r.plugin.Start(ctx)
}

func (r *protoClient) Stop(ctx context.Context) error {
	return r.plugin.Stop(ctx)
}

func (r *protoClient) QueryData(ctx context.Context, in *pluginv2.QueryDataRequest, opts ...grpc.CallOption) (*pluginv2.QueryDataResponse, error) {
	if r.plugin.pluginClient == nil {
		return nil, errClientNotStarted
	}
	return r.plugin.pluginClient.DataClient.QueryData(ctx, in, opts...)
}

func (r *protoClient) CallResource(ctx context.Context, in *pluginv2.CallResourceRequest, opts ...grpc.CallOption) (pluginv2.Resource_CallResourceClient, error) {
	if r.plugin.pluginClient == nil {
		return nil, errClientNotStarted
	}
	return r.plugin.pluginClient.ResourceClient.CallResource(ctx, in, opts...)
}

func (r *protoClient) CheckHealth(ctx context.Context, in *pluginv2.CheckHealthRequest, opts ...grpc.CallOption) (*pluginv2.CheckHealthResponse, error) {
	if r.plugin.pluginClient == nil {
		return nil, errClientNotStarted
	}
	return r.plugin.pluginClient.DiagnosticsClient.CheckHealth(ctx, in, opts...)
}

func (r *protoClient) CollectMetrics(ctx context.Context, in *pluginv2.CollectMetricsRequest, opts ...grpc.CallOption) (*pluginv2.CollectMetricsResponse, error) {
	if r.plugin.pluginClient == nil {
		return nil, errClientNotStarted
	}
	return r.plugin.pluginClient.DiagnosticsClient.CollectMetrics(ctx, in, opts...)
}

func (r *protoClient) SubscribeStream(ctx context.Context, in *pluginv2.SubscribeStreamRequest, opts ...grpc.CallOption) (*pluginv2.SubscribeStreamResponse, error) {
	if r.plugin.pluginClient == nil {
		return nil, errClientNotStarted
	}
	return r.plugin.pluginClient.StreamClient.SubscribeStream(ctx, in, opts...)
}

func (r *protoClient) RunStream(ctx context.Context, in *pluginv2.RunStreamRequest, opts ...grpc.CallOption) (pluginv2.Stream_RunStreamClient, error) {
	if r.plugin.pluginClient == nil {
		return nil, errClientNotStarted
	}
	return r.plugin.pluginClient.StreamClient.RunStream(ctx, in, opts...)
}

func (r *protoClient) PublishStream(ctx context.Context, in *pluginv2.PublishStreamRequest, opts ...grpc.CallOption) (*pluginv2.PublishStreamResponse, error) {
	if r.plugin.pluginClient == nil {
		return nil, errClientNotStarted
	}
	return r.plugin.pluginClient.StreamClient.PublishStream(ctx, in, opts...)
}
