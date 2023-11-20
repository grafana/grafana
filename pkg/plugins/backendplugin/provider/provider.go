package provider

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/grpcplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/pluginextensionv2"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/secretsmanagerplugin"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// PluginBackendProvider is a function type for initializing a Plugin backend.
type PluginBackendProvider func(_ context.Context, _ *plugins.Plugin) backendplugin.PluginFactoryFunc

type Service struct {
	providerChain []PluginBackendProvider
	features      featuremgmt.FeatureToggles
}

func New(features featuremgmt.FeatureToggles, providers ...PluginBackendProvider) *Service {
	if len(providers) == 0 {
		return New(features, RendererProvider, SecretsManagerProvider, DefaultProvider(features))
	}
	return &Service{
		providerChain: providers,
		features:      features,
	}
}

func ProvideService(features featuremgmt.FeatureToggles, coreRegistry *coreplugin.Registry) *Service {
	return New(features, coreRegistry.BackendFactoryProvider(), RendererProvider, SecretsManagerProvider, DefaultProvider(features))
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

var SecretsManagerProvider PluginBackendProvider = func(_ context.Context, p *plugins.Plugin) backendplugin.PluginFactoryFunc {
	if !p.IsSecretsManager() {
		return nil
	}
	return grpcplugin.NewSecretsManagerPlugin(p.ID, p.ExecutablePath(),
		func(pluginID string, secretsmanager secretsmanagerplugin.SecretsManagerPlugin, logger log.Logger) error {
			p.SecretsManager = secretsmanager
			return nil
		},
	)
}

func DefaultProvider(features featuremgmt.FeatureToggles) PluginBackendProvider {
	return func(_ context.Context, p *plugins.Plugin) backendplugin.PluginFactoryFunc {
		skipEnvVars := features.IsEnabledGlobally(featuremgmt.FlagPluginsSkipHostEnvVars)
		return grpcplugin.NewBackendPlugin(p.ID, p.ExecutablePath(), skipEnvVars)
	}
}
