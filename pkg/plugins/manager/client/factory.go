package client

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
)

var (
	errPluginNotFound = errors.New("plugin not found")
)

// PluginsClientProvider is responsible for determining the most appropriate plugins.Client given a plugin identifier.
type PluginsClientProvider interface {
	PluginClient(ctx context.Context, pluginID string) (plugins.Client, error)
}

type Provider struct {
	cfg                   *config.Cfg
	backendClientRegistry Registry
}

func NewProvider(cfg *config.Cfg, backendClientRegistry Registry) *Provider {
	return &Provider{
		cfg:                   cfg,
		backendClientRegistry: backendClientRegistry,
	}
}

// PluginClient will check the central plugin registry for the requested plugin. Unless the plugin  is configured
// to execute one process per tenant, it will return the default backend associated with that plugin.
// Otherwise, it will check the backend client registry for an existing process for a given tenant, or else
// start a new one, which will be returned to the caller as a plugins.Client interface
func (p *Provider) PluginClient(ctx context.Context, pluginID string) (plugins.Client, error) {
	if pc, exists := p.backendClientRegistry.Get(ctx, pluginID); exists {
		return pc, nil
	}
	return nil, errPluginNotFound
}

func (p *Provider) Shutdown(ctx context.Context) {
	p.backendClientRegistry.Shutdown(ctx)
}
