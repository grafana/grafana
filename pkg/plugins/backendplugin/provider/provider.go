package provider

import (
	"context"
	"fmt"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/grpcplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/pluginextensionv2"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/secretsmanagerplugin"
)

// PluginBackendProvider is a function type for initializing a Plugin backend.
type PluginBackendProvider func(_ context.Context, _ *plugins.Plugin) backendplugin.PluginFactoryFunc

type Service struct {
	providerChain []PluginBackendProvider
}

func New(providers ...PluginBackendProvider) *Service {
	if len(providers) == 0 {
		return New(RendererProvider, SecretsManagerProvider, DefaultProvider)
	}
	return &Service{
		providerChain: providers,
	}
}

func ProvideService(coreRegistry *coreplugin.Registry) *Service {
	return New(coreRegistry.BackendFactoryProvider(), RendererProvider, SecretsManagerProvider, DefaultProvider)
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
	return grpcplugin.NewRendererPlugin(p.ID, filepath.Join(p.PluginDir, rendererStartCmd()),
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
	return grpcplugin.NewSecretsManagerPlugin(p.ID, filepath.Join(p.PluginDir, secretsManagerStartCmd()),
		func(pluginID string, secretsmanager secretsmanagerplugin.SecretsManagerPlugin, logger log.Logger) error {
			p.SecretsManager = secretsmanager
			return nil
		},
	)
}

var DefaultProvider PluginBackendProvider = func(_ context.Context, p *plugins.Plugin) backendplugin.PluginFactoryFunc {
	// TODO check for executable
	return grpcplugin.NewBackendPlugin(p.ID, filepath.Join(p.PluginDir, pluginStartCmd(p.Executable)))
}

func pluginStartCmd(executable string) string {
	os := strings.ToLower(runtime.GOOS)
	arch := runtime.GOARCH
	extension := ""

	if os == "windows" {
		extension = ".exe"
	}

	return fmt.Sprintf("%s_%s_%s%s", executable, os, strings.ToLower(arch), extension)
}

func rendererStartCmd() string {
	os := strings.ToLower(runtime.GOOS)
	arch := runtime.GOARCH
	extension := ""

	if os == "windows" {
		extension = ".exe"
	}

	return fmt.Sprintf("%s_%s_%s%s", "plugin_start", os, strings.ToLower(arch), extension)
}

func secretsManagerStartCmd() string {
	os := strings.ToLower(runtime.GOOS)
	arch := runtime.GOARCH
	extension := ""

	if os == "windows" {
		extension = ".exe"
	}

	return fmt.Sprintf("%s_%s_%s%s", "secrets_plugin_start", os, strings.ToLower(arch), extension)
}
