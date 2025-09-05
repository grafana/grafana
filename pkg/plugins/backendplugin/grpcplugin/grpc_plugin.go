package grpcplugin

import (
	"context"
	"errors"
	"sync"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/hashicorp/go-plugin"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/process"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/log"
)

type grpcPlugin struct {
	descriptor     PluginDescriptor
	clientFactory  func() *plugin.Client
	client         *plugin.Client
	pluginClient   *ClientV2
	logger         log.Logger
	mutex          sync.RWMutex
	decommissioned bool
	state          pluginState
}

type pluginState int

const (
	pluginStateNotStarted pluginState = iota
	pluginStateStartInit
	pluginStateStartSuccess
	pluginStateStartFail
	pluginStateStopped
)

// newPlugin allocates and returns a new gRPC (external) backendplugin.Plugin.
func newPlugin(descriptor PluginDescriptor) backendplugin.PluginFactoryFunc {
	return func(pluginID string, logger log.Logger, tracer trace.Tracer, env func() []string) (backendplugin.Plugin, error) {
		return newGrpcPlugin(descriptor, logger, tracer, env), nil
	}
}

func newGrpcPlugin(descriptor PluginDescriptor, logger log.Logger, tracer trace.Tracer, env func() []string) *grpcPlugin {
	return &grpcPlugin{
		descriptor: descriptor,
		logger:     logger,
		clientFactory: func() *plugin.Client {
			return plugin.NewClient(newClientConfig(descriptor.executablePath, descriptor.executableArgs, env(), descriptor.skipHostEnvVars, descriptor.containerMode, logger, tracer, descriptor.versionedPlugins))
		},
		state: pluginStateNotStarted,
	}
}

func (p *grpcPlugin) PluginID() string {
	return p.descriptor.pluginID
}

func (p *grpcPlugin) Logger() log.Logger {
	return p.logger
}

func (p *grpcPlugin) Start(_ context.Context) error {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	p.state = pluginStateStartInit

	p.client = p.clientFactory()
	rpcClient, err := p.client.Client()
	if err != nil {
		p.state = pluginStateStartFail
		return err
	}

	if p.client.NegotiatedVersion() < 2 {
		p.state = pluginStateStartFail
		return errors.New("plugin protocol version not supported")
	}
	p.pluginClient, err = newClientV2(p.descriptor, p.logger, rpcClient)
	if err != nil {
		p.state = pluginStateStartFail
		return err
	}

	if p.pluginClient == nil {
		p.state = pluginStateStartFail
		return errors.New("no compatible plugin implementation found")
	}

	elevated, err := process.IsRunningWithElevatedPrivileges()
	if err != nil {
		p.logger.Debug("Error checking plugin process execution privilege", "error", err)
	}
	if elevated {
		p.logger.Warn("Plugin process is running with elevated privileges. This is not recommended")
	}

	p.state = pluginStateStartSuccess
	return nil
}

func (p *grpcPlugin) Stop(_ context.Context) error {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	if p.client != nil {
		p.client.Kill()
	}
	p.state = pluginStateStopped
	return nil
}

func (p *grpcPlugin) IsManaged() bool {
	return p.descriptor.managed
}

func (p *grpcPlugin) Exited() bool {
	p.mutex.RLock()
	defer p.mutex.RUnlock()
	if p.client != nil {
		return p.client.Exited()
	}
	return true
}

func (p *grpcPlugin) Decommission() error {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	p.decommissioned = true

	return nil
}

func (p *grpcPlugin) IsDecommissioned() bool {
	p.mutex.RLock()
	defer p.mutex.RUnlock()
	return p.decommissioned
}

func (p *grpcPlugin) Target() backendplugin.Target {
	return backendplugin.TargetLocal
}

func (p *grpcPlugin) getPluginClient(ctx context.Context) (*ClientV2, bool) {
	p.mutex.RLock()
	defer p.mutex.RUnlock()
	if p.client != nil && !p.client.Exited() && p.pluginClient != nil {
		return p.pluginClient, true
	}

	logger := p.Logger().FromContext(ctx)
	if p.state == pluginStateNotStarted {
		logger.Debug("Plugin client has not been started yet")
	}

	if p.state == pluginStateStartInit {
		logger.Debug("Plugin client is starting")
	}

	if p.state == pluginStateStartFail {
		logger.Debug("Plugin client failed to start")
	}

	if p.state == pluginStateStopped {
		logger.Debug("Plugin client has stopped")
	}

	return nil, false
}

func (p *grpcPlugin) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	pc, ok := p.getPluginClient(ctx)
	if !ok {
		return nil, plugins.ErrPluginUnavailable
	}
	return pc.CollectMetrics(ctx, req)
}

func (p *grpcPlugin) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	pc, ok := p.getPluginClient(ctx)
	if !ok {
		return nil, plugins.ErrPluginUnavailable
	}
	return pc.CheckHealth(ctx, req)
}

func (p *grpcPlugin) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	pc, ok := p.getPluginClient(ctx)
	if !ok {
		return nil, plugins.ErrPluginUnavailable
	}

	return pc.QueryData(ctx, req)
}

func (p *grpcPlugin) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	pc, ok := p.getPluginClient(ctx)
	if !ok {
		return plugins.ErrPluginUnavailable
	}
	return pc.CallResource(ctx, req, sender)
}

func (p *grpcPlugin) SubscribeStream(ctx context.Context, request *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	pc, ok := p.getPluginClient(ctx)
	if !ok {
		return nil, plugins.ErrPluginUnavailable
	}
	return pc.SubscribeStream(ctx, request)
}

func (p *grpcPlugin) PublishStream(ctx context.Context, request *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	pc, ok := p.getPluginClient(ctx)
	if !ok {
		return nil, plugins.ErrPluginUnavailable
	}
	return pc.PublishStream(ctx, request)
}

func (p *grpcPlugin) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	pc, ok := p.getPluginClient(ctx)
	if !ok {
		return plugins.ErrPluginUnavailable
	}
	return pc.RunStream(ctx, req, sender)
}

func (p *grpcPlugin) ValidateAdmission(ctx context.Context, request *backend.AdmissionRequest) (*backend.ValidationResponse, error) {
	pc, ok := p.getPluginClient(ctx)
	if !ok {
		return nil, plugins.ErrPluginUnavailable
	}
	return pc.ValidateAdmission(ctx, request)
}

func (p *grpcPlugin) MutateAdmission(ctx context.Context, request *backend.AdmissionRequest) (*backend.MutationResponse, error) {
	pc, ok := p.getPluginClient(ctx)
	if !ok {
		return nil, plugins.ErrPluginUnavailable
	}
	return pc.MutateAdmission(ctx, request)
}

func (p *grpcPlugin) ConvertObjects(ctx context.Context, request *backend.ConversionRequest) (*backend.ConversionResponse, error) {
	pc, ok := p.getPluginClient(ctx)
	if !ok {
		return nil, plugins.ErrPluginUnavailable
	}
	return pc.ConvertObjects(ctx, request)
}
