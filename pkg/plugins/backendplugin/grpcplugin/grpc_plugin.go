package grpcplugin

import (
	"context"
	"errors"
	"sync"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/hashicorp/go-plugin"

	"github.com/grafana/grafana/pkg/infra/process"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/log"
)

type pluginClient interface {
	backend.CollectMetricsHandler
	backend.CheckHealthHandler
	backend.QueryDataHandler
	backend.CallResourceHandler
	backend.StreamHandler
}

type grpcPlugin struct {
	descriptor     PluginDescriptor
	clientFactory  func() *plugin.Client
	client         *plugin.Client
	pluginClient   pluginClient
	logger         log.Logger
	mutex          sync.RWMutex
	decommissioned bool
}

// newPlugin allocates and returns a new gRPC (external) backendplugin.Plugin.
func newPlugin(descriptor PluginDescriptor) backendplugin.PluginFactoryFunc {
	return func(pluginID string, logger log.Logger, env []string) (backendplugin.Plugin, error) {
		return &grpcPlugin{
			descriptor: descriptor,
			logger:     logger,
			clientFactory: func() *plugin.Client {
				return plugin.NewClient(newClientConfig(descriptor.executablePath, env, logger, descriptor.versionedPlugins))
			},
		}, nil
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

	p.client = p.clientFactory()
	rpcClient, err := p.client.Client()
	if err != nil {
		return err
	}

	if p.client.NegotiatedVersion() < 2 {
		return errors.New("plugin protocol version not supported")
	}
	p.pluginClient, err = newClientV2(p.descriptor, p.logger, rpcClient)
	if err != nil {
		return err
	}

	if p.pluginClient == nil {
		return errors.New("no compatible plugin implementation found")
	}

	elevated, err := process.IsRunningWithElevatedPrivileges()
	if err != nil {
		p.logger.Debug("Error checking plugin process execution privilege", "err", err)
	}
	if elevated {
		p.logger.Warn("Plugin process is running with elevated privileges. This is not recommended")
	}

	return nil
}

func (p *grpcPlugin) Stop(_ context.Context) error {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	if p.client != nil {
		p.client.Kill()
	}
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

func (p *grpcPlugin) getPluginClient() (pluginClient, bool) {
	p.mutex.RLock()
	if p.client == nil || p.client.Exited() || p.pluginClient == nil {
		p.mutex.RUnlock()
		return nil, false
	}
	pluginClient := p.pluginClient
	p.mutex.RUnlock()
	return pluginClient, true
}

func (p *grpcPlugin) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	pluginClient, ok := p.getPluginClient()
	if !ok {
		return nil, backendplugin.ErrPluginUnavailable
	}
	return pluginClient.CollectMetrics(ctx, req)
}

func (p *grpcPlugin) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	pluginClient, ok := p.getPluginClient()
	if !ok {
		return nil, backendplugin.ErrPluginUnavailable
	}
	return pluginClient.CheckHealth(ctx, req)
}

func (p *grpcPlugin) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	pluginClient, ok := p.getPluginClient()
	if !ok {
		return nil, backendplugin.ErrPluginUnavailable
	}

	return pluginClient.QueryData(ctx, req)
}

func (p *grpcPlugin) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	pluginClient, ok := p.getPluginClient()
	if !ok {
		return backendplugin.ErrPluginUnavailable
	}
	return pluginClient.CallResource(ctx, req, sender)
}

func (p *grpcPlugin) SubscribeStream(ctx context.Context, request *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	pluginClient, ok := p.getPluginClient()
	if !ok {
		return nil, backendplugin.ErrPluginUnavailable
	}
	return pluginClient.SubscribeStream(ctx, request)
}

func (p *grpcPlugin) PublishStream(ctx context.Context, request *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	pluginClient, ok := p.getPluginClient()
	if !ok {
		return nil, backendplugin.ErrPluginUnavailable
	}
	return pluginClient.PublishStream(ctx, request)
}

func (p *grpcPlugin) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	pluginClient, ok := p.getPluginClient()
	if !ok {
		return backendplugin.ErrPluginUnavailable
	}
	return pluginClient.RunStream(ctx, req, sender)
}
