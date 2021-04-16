// Package plugins contains plugin related logic.
package plugins

import (
	"context"
	"errors"

	"github.com/hashicorp/go-plugin"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdk "github.com/grafana/grafana-plugin-sdk-go/backend/grpcplugin"
	glog "github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/grpcplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/pluginextensionv2"
)

var _ backendplugin.Plugin = (*PluginV2)(nil)

func (p *PluginV2) Logger() glog.Logger {
	return p.logger
}

func (p *PluginV2) PluginID() string {
	return p.ID
}

func (p *PluginV2) Setup(descriptor grpcplugin.PluginDescriptor, logger glog.Logger) error {
	p.descriptor = descriptor
	p.logger = logger

	return nil
}

func (p *PluginV2) Start(ctx context.Context) error {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	var env []string

	clientFactory := func() *plugin.Client {
		return plugin.NewClient(grpcplugin.NewClientConfig(p.descriptor.ExecutablePath, env, p.logger, p.descriptor.VersionedPlugins))
	}
	p.hashiClient = clientFactory()
	rpcClient, err := p.hashiClient.Client()
	if err != nil {
		return err
	}

	if p.hashiClient.NegotiatedVersion() < 2 {
		return errors.New("incompatible version")
	}

	p.Client, err = NewClientV2(p.descriptor, p.logger, rpcClient)
	if err != nil {
		return err
	}

	if p.Client == nil {
		return errors.New("no compatible plugin implementation found")
	}

	return nil
}

func (p *PluginV2) Stop(ctx context.Context) error {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	if p.hashiClient != nil {
		p.hashiClient.Kill()
	}
	return nil
}

func (p *PluginV2) IsManaged() bool {
	return true // false
}

func (p *PluginV2) Exited() bool {
	p.mutex.RLock()
	defer p.mutex.RUnlock()
	if p.hashiClient != nil {
		return p.hashiClient.Exited()
	}
	return true
}

func (p *PluginV2) CollectMetrics(ctx context.Context) (*backend.CollectMetricsResult, error) {
	pluginClient, ok := p.getClient()
	if !ok {
		return nil, backendplugin.ErrPluginUnavailable
	}
	return pluginClient.CollectMetrics(ctx)
}

func (p *PluginV2) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	pluginClient, ok := p.getClient()
	if !ok {
		return nil, backendplugin.ErrPluginUnavailable
	}
	return pluginClient.CheckHealth(ctx, req)
}

func (p *PluginV2) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	pluginClient, ok := p.getClient()
	if !ok {
		return backendplugin.ErrPluginUnavailable
	}
	return pluginClient.CallResource(ctx, req, sender)
}

func (p *PluginV2) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	pluginClient, ok := p.getClient()
	if !ok {
		return nil, backendplugin.ErrPluginUnavailable
	}
	return pluginClient.SubscribeStream(ctx, req)
}

func (p *PluginV2) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	pluginClient, ok := p.getClient()
	if !ok {
		return nil, backendplugin.ErrPluginUnavailable
	}
	return pluginClient.PublishStream(ctx, req)
}

func (p *PluginV2) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender backend.StreamPacketSender) error {
	pluginClient, ok := p.getClient()
	if !ok {
		return backendplugin.ErrPluginUnavailable
	}
	return pluginClient.RunStream(ctx, req, sender)
}

func (p *PluginV2) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if p.IsCorePlugin {
		pluginClient, ok := p.getCorePluginClient()
		if !ok {
			return nil, backendplugin.ErrPluginUnavailable
		}
		return pluginClient.QueryData(ctx, req)
	}

	pluginClient, ok := p.getClient()
	if !ok {
		return nil, backendplugin.ErrPluginUnavailable
	}
	return pluginClient.QueryData(ctx, req)
}

func (p *PluginV2) getClient() (client, bool) {
	p.mutex.RLock()
	if p.hashiClient == nil || p.hashiClient.Exited() || p.Client == nil {
		p.mutex.RUnlock()
		return nil, false
	}
	c := p.Client
	p.mutex.RUnlock()
	return c, true
}

func (p *PluginV2) getCorePluginClient() (client, bool) {
	p.mutex.RLock()
	if p.Client == nil {
		p.mutex.RUnlock()
		return nil, false
	}
	c := p.Client
	p.mutex.RUnlock()
	return c, true
}

type client interface {
	backend.QueryDataHandler
	backend.CollectMetricsHandler
	backend.CheckHealthHandler
	backend.CallResourceHandler
	backend.StreamHandler
}

func NewClientV2(descriptor grpcplugin.PluginDescriptor, logger glog.Logger, rpcClient plugin.ClientProtocol) (client, error) {
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

	rawStream, err := rpcClient.Dispense("stream")
	if err != nil {
		return nil, err
	}

	rawRenderer, err := rpcClient.Dispense("renderer")
	if err != nil {
		return nil, err
	}

	c := grpcplugin.ClientV2{}
	if rawDiagnostics != nil {
		if diagnosticsClient, ok := rawDiagnostics.(sdk.DiagnosticsClient); ok {
			c.DiagnosticsClient = diagnosticsClient
		}
	}

	if rawResource != nil {
		if resourceClient, ok := rawResource.(sdk.ResourceClient); ok {
			c.ResourceClient = resourceClient
		}
	}

	if rawData != nil {
		if dataClient, ok := rawData.(sdk.DataClient); ok {
			c.DataClient = dataClient // not instrument
		}
	}

	if rawStream != nil {
		if streamClient, ok := rawStream.(sdk.StreamClient); ok {
			c.StreamClient = streamClient
		}
	}

	if rawRenderer != nil {
		if rendererPlugin, ok := rawRenderer.(pluginextensionv2.RendererPlugin); ok {
			c.RendererPlugin = rendererPlugin
		}
	}

	if descriptor.StartFns.OnStart != nil {
		client := &grpcplugin.Client{
			DataPlugin:     c.DataClient,
			RendererPlugin: c.RendererPlugin,
			StreamClient:   c.StreamClient,
		}
		if err := descriptor.StartFns.OnStart(descriptor.PluginID, client, logger); err != nil {
			return nil, err
		}
	}

	return &c, nil
}
