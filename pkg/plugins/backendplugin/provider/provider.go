package provider

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/grpcplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/pluginextensionv2"
	"github.com/grafana/grafana/pkg/plugins/log"
)

// PluginBackendProvider is a function type for initializing a Plugin backend.
type PluginBackendProvider func(_ context.Context, _ *plugins.Plugin) backendplugin.PluginFactoryFunc

type Service struct {
	providerChain []PluginBackendProvider
}

func New(providers ...PluginBackendProvider) *Service {
	if len(providers) == 0 {
		return New(DefaultProvider)
	}
	return &Service{
		providerChain: providers,
	}
}

func ProvideService(coreRegistry *coreplugin.Registry) *Service {
	return New(coreRegistry.BackendFactoryProvider(), DefaultProvider)
}

func (s *Service) BackendFactory(ctx context.Context, p *plugins.Plugin) backendplugin.PluginFactoryFunc {
	for _, provider := range s.providerChain {
		if factory := provider(ctx, p); factory != nil {
			return factory
		}
	}
	return nil
}

var RendererProvider PluginBackendProvider = func(_ context.Context, p *plugins.Plugin) backendplugin.PluginFactoryFunc {
	if !p.IsRenderer() {
		return nil
	}
	return grpcplugin.NewRendererPlugin(p.ID, p.ExecutablePath(),
		func(pluginID string, renderer pluginextensionv2.RendererPlugin, logger log.Logger) error {
			p.Renderer = renderer
			return nil
		},
	)
}

var DefaultProvider = PluginBackendProvider(func(_ context.Context, p *plugins.Plugin) backendplugin.PluginFactoryFunc {
	return grpcplugin.NewBackendPlugin(p.ID, p.ExecutablePath(), p.SkipHostEnvVars)
})
