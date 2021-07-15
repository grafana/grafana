package tsdb

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/pluginextensionv2"
)

type providerProxy struct {
	logger    log.Logger
	providers map[string]coreplugin.ServeOpts
}

func newProviderProxy(logger log.Logger) *providerProxy {
	return &providerProxy{
		logger:    logger,
		providers: map[string]coreplugin.ServeOpts{},
	}
}

func (p *providerProxy) register(providerID string, opts coreplugin.ServeOpts) {
	p.providers[providerID] = opts
}

func (p *providerProxy) ConfigureProvider(ctx context.Context, req *pluginextensionv2.ConfigureProviderRequest) (*pluginextensionv2.ConfigureProviderResponse, error) {
	providers := []string{}
	for provider := range p.providers {
		providers = append(providers, provider)
	}

	return &pluginextensionv2.ConfigureProviderResponse{
		Provider: providers,
	}, nil
}

func (p *providerProxy) getProvider(providerID string) (coreplugin.ServeOpts, bool) {
	opts, exists := p.providers[providerID]
	return opts, exists
}

func (p *providerProxy) CollectMetrics(ctx context.Context) (*backend.CollectMetricsResult, error) {
	return nil, backendplugin.ErrMethodNotImplemented
}

func (p *providerProxy) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	providerID, err := backendplugin.ProviderIDFromContext(ctx)
	if err != nil {
		return nil, err
	}

	if provider, exists := p.getProvider(providerID); exists && provider.CheckHealthHandler != nil {
		p.logger.Debug("Proxying CheckHealth plugin request to provider", "plugin", req.PluginContext.PluginID, "provider", providerID)
		return provider.CheckHealthHandler.CheckHealth(ctx, req)
	}

	return nil, backendplugin.ErrMethodNotImplemented
}

func (p *providerProxy) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	providerID, err := backendplugin.ProviderIDFromContext(ctx)
	if err != nil {
		return nil, err
	}

	if provider, exists := p.getProvider(providerID); exists && provider.QueryDataHandler != nil {
		p.logger.Debug("Proxying QueryData plugin request to provider", "plugin", req.PluginContext.PluginID, "provider", providerID)
		return provider.QueryDataHandler.QueryData(ctx, req)
	}

	return nil, backendplugin.ErrMethodNotImplemented
}

func (p *providerProxy) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	providerID, err := backendplugin.ProviderIDFromContext(ctx)
	if err != nil {
		return err
	}

	p.logger.Debug("Proxying CallResource plugin request to provider", "plugin", req.PluginContext.PluginID, "provider", providerID)

	if provider, exists := p.getProvider(providerID); exists && provider.CallResourceHandler != nil {
		return provider.CallResourceHandler.CallResource(ctx, req, sender)
	}

	return backendplugin.ErrMethodNotImplemented
}

func (p *providerProxy) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	providerID, err := backendplugin.ProviderIDFromContext(ctx)
	if err != nil {
		return nil, err
	}

	if provider, exists := p.getProvider(providerID); exists && provider.StreamHandler != nil {
		p.logger.Debug("Proxying SubscribeStream plugin request to provider", "plugin", req.PluginContext.PluginID, "provider", providerID)
		return provider.StreamHandler.SubscribeStream(ctx, req)
	}

	return nil, backendplugin.ErrMethodNotImplemented
}

func (p *providerProxy) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	providerID, err := backendplugin.ProviderIDFromContext(ctx)
	if err != nil {
		return nil, err
	}

	if provider, exists := p.getProvider(providerID); exists && provider.StreamHandler != nil {
		p.logger.Debug("Proxying PublishStream plugin request to provider", "plugin", req.PluginContext.PluginID, "provider", providerID)
		return provider.StreamHandler.PublishStream(ctx, req)
	}

	return nil, backendplugin.ErrMethodNotImplemented
}

func (p *providerProxy) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	providerID, err := backendplugin.ProviderIDFromContext(ctx)
	if err != nil {
		return err
	}

	if provider, exists := p.getProvider(providerID); exists && provider.StreamHandler != nil {
		p.logger.Debug("Proxying RunStream plugin request to provider", "plugin", req.PluginContext.PluginID, "provider", providerID)
		return provider.StreamHandler.RunStream(ctx, req, sender)
	}

	return backendplugin.ErrMethodNotImplemented
}
