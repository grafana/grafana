package provider

import (
	"context"
	"path/filepath"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/grpcplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/pluginextensionv2"
)

type Service struct {
	coreRegistry *coreplugin.Registry
}

func ProvideService(coreRegistry *coreplugin.Registry) *Service {
	return &Service{
		coreRegistry: coreRegistry,
	}
}

func (s *Service) BackendFactory(ctx context.Context, p *plugins.Plugin) backendplugin.PluginFactoryFunc {
	for _, provider := range []PluginBackendProvider{CorePluginProvider(ctx, s.coreRegistry), RendererProvider, DefaultProvider} {
		if factory := provider(ctx, p); factory != nil {
			return factory
		}
	}
	return nil
}

// PluginBackendProvider is a function type for initializing a Plugin backend.
type PluginBackendProvider func(_ context.Context, _ *plugins.Plugin) backendplugin.PluginFactoryFunc

var RendererProvider PluginBackendProvider = func(_ context.Context, p *plugins.Plugin) backendplugin.PluginFactoryFunc {
	if !p.IsRenderer() {
		return nil
	}
	cmd := plugins.ComposeRendererStartCommand()
	return grpcplugin.NewRendererPlugin(p.ID, filepath.Join(p.PluginDir, cmd),
		func(pluginID string, renderer pluginextensionv2.RendererPlugin, logger log.Logger) error {
			p.Renderer = renderer
			return nil
		},
	)
}

var DefaultProvider PluginBackendProvider = func(_ context.Context, p *plugins.Plugin) backendplugin.PluginFactoryFunc {
	// TODO check for executable
	cmd := plugins.ComposePluginStartCommand(p.Executable)
	return grpcplugin.NewBackendPlugin(p.ID, filepath.Join(p.PluginDir, cmd))
}

var CorePluginProvider = func(ctx context.Context, registry *coreplugin.Registry) PluginBackendProvider {
	return func(_ context.Context, p *plugins.Plugin) backendplugin.PluginFactoryFunc {
		if !p.IsCorePlugin() {
			return nil
		}

		return registry.Get(p.ID)
	}
}
