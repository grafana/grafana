package grpcplugin

import (
	"context"
	"errors"
	"sync"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/hashicorp/go-plugin"
)

type pluginClient interface {
	backend.CollectMetricsHandler
	backend.CheckHealthHandler
	backend.CallResourceHandler
}

type grpcPlugin struct {
	descriptor    PluginDescriptor
	clientFactory func() *plugin.Client
	client        *plugin.Client
	pluginClient  pluginClient
	logger        log.Logger
	mutex         sync.RWMutex
}

// New allocates and returns a new gRPC (external) backendplugin.Plugin.
func New(descriptor PluginDescriptor) backendplugin.PluginFactoryFunc {
	return backendplugin.PluginFactoryFunc(func(pluginID string, logger log.Logger, env []string) (backendplugin.Plugin, error) {
		return &grpcPlugin{
			descriptor: descriptor,
			logger:     logger,
			clientFactory: func() *plugin.Client {
				return plugin.NewClient(newClientConfig(descriptor.executablePath, env, logger, descriptor.versionedPlugins))
			},
		}, nil
	})
}

func (p *grpcPlugin) PluginID() string {
	return p.descriptor.pluginID
}

func (p *grpcPlugin) Logger() log.Logger {
	return p.logger
}

func (p *grpcPlugin) Start(ctx context.Context) error {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	p.client = p.clientFactory()
	rpcClient, err := p.client.Client()
	if err != nil {
		return err
	}

	if p.client.NegotiatedVersion() > 1 {
		p.pluginClient, err = newClientV2(p.descriptor, p.logger, rpcClient)
		if err != nil {
			return err
		}
	} else {
		p.pluginClient, err = newClientV1(p.descriptor, p.logger, rpcClient)
		if err != nil {
			return err
		}
	}

	if p.pluginClient == nil {
		return errors.New("no compatible plugin implementation found")
	}

	return nil
}

func (p *grpcPlugin) Stop(ctx context.Context) error {
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

func (p *grpcPlugin) CollectMetrics(ctx context.Context) (*backend.CollectMetricsResult, error) {
	p.mutex.RLock()
	if p.client == nil || p.client.Exited() || p.pluginClient == nil {
		p.mutex.RUnlock()
		return nil, backendplugin.ErrPluginUnavailable
	}
	pluginClient := p.pluginClient
	p.mutex.RUnlock()

	return pluginClient.CollectMetrics(ctx)
}

func (p *grpcPlugin) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	p.mutex.RLock()
	if p.client == nil || p.client.Exited() || p.pluginClient == nil {
		p.mutex.RUnlock()
		return nil, backendplugin.ErrPluginUnavailable
	}
	pluginClient := p.pluginClient
	p.mutex.RUnlock()

	return pluginClient.CheckHealth(ctx, req)
}

func (p *grpcPlugin) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	p.mutex.RLock()
	if p.client == nil || p.client.Exited() || p.pluginClient == nil {
		p.mutex.RUnlock()
		return backendplugin.ErrPluginUnavailable
	}
	pluginClient := p.pluginClient
	p.mutex.RUnlock()

	return pluginClient.CallResource(ctx, req, sender)
}
