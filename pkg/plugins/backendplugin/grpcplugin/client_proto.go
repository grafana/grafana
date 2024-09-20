package grpcplugin

import (
	"context"
	"errors"
	"sync"

	"google.golang.org/grpc"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/log"
)

var (
	errClientNotAvailable = errors.New("plugin client is not available")
)

var _ ProtoClient = (*protoClient)(nil)

type ProtoClient interface {
	pluginv2.DataClient
	pluginv2.ResourceClient
	pluginv2.DiagnosticsClient
	pluginv2.StreamClient
	pluginv2.AdmissionControlClient
	pluginv2.ResourceConversionClient

	PID(context.Context) (string, error)
	PluginID() string
	PluginVersion() string
	PluginJSON() plugins.JSONData
	Backend() backendplugin.Plugin
	Logger() log.Logger
	Start(context.Context) error
	Stop(context.Context) error
}

type protoClient struct {
	plugin        *grpcPlugin
	pluginVersion string
	pluginJSON    plugins.JSONData

	state pluginState

	mu sync.RWMutex
}

type pluginState int

const (
	pluginStateNotStarted pluginState = iota
	pluginStateStartSuccess
	pluginStateStartFail
	pluginStateStopped
)

type ProtoClientOpts struct {
	PluginJSON     plugins.JSONData
	ExecutablePath string
	ExecutableArgs []string
	Env            []string
	Logger         log.Logger
}

func NewProtoClient(opts ProtoClientOpts) (ProtoClient, error) {
	p := newGrpcPlugin(
		PluginDescriptor{
			pluginID:         opts.PluginJSON.ID,
			managed:          true,
			executablePath:   opts.ExecutablePath,
			executableArgs:   opts.ExecutableArgs,
			versionedPlugins: pluginSet,
		},
		opts.Logger,
		func() []string { return opts.Env },
	)

	return &protoClient{plugin: p, pluginVersion: opts.PluginJSON.Info.Version, pluginJSON: opts.PluginJSON, state: pluginStateNotStarted}, nil
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
	return r.pluginVersion
}

func (r *protoClient) PluginJSON() plugins.JSONData {
	return r.pluginJSON
}

func (r *protoClient) Backend() backendplugin.Plugin {
	return r.plugin
}

func (r *protoClient) Logger() log.Logger {
	return r.plugin.logger
}

func (r *protoClient) Start(ctx context.Context) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	err := r.plugin.Start(ctx)
	if err != nil {
		r.state = pluginStateStartFail
		return err
	}

	r.state = pluginStateStartSuccess
	return nil
}

func (r *protoClient) Stop(ctx context.Context) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.state = pluginStateStopped
	return r.plugin.Stop(ctx)
}

func (r *protoClient) client(ctx context.Context) (*ClientV2, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	logger := r.Logger().FromContext(ctx)
	if r.state == pluginStateNotStarted {
		logger.Debug("Plugin client has not been started yet")
		return nil, false
	}

	if r.state == pluginStateStartFail {
		logger.Debug("Plugin client failed to start")
		return nil, false
	}

	if r.state == pluginStateStopped {
		logger.Debug("Plugin client has stopped")
		return nil, false
	}

	if r.plugin.Exited() {
		logger.Debug("Plugin client has exited")
		return nil, false
	}

	if r.plugin.pluginClient == nil {
		return nil, false
	}
	pc := r.plugin.pluginClient
	return pc, true
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
