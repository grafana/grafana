package pluginassets

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

// Service provides methods for plugin asset loading strategy and module hash calculation.
// This is a thin adapter that converts pluginstore.Plugin to ID/version for the underlying service.
type Service struct {
	pluginAssets plugins.PluginModuleInfo
}

// NewService creates a new Service adapter.
func NewService(pluginAssets plugins.PluginModuleInfo) *Service {
	return &Service{
		pluginAssets: pluginAssets,
	}
}

// LoadingStrategy calculates the loading strategy for a plugin.
func (s *Service) LoadingStrategy(ctx context.Context, p pluginstore.Plugin) plugins.LoadingStrategy {
	return s.pluginAssets.LoadingStrategy(ctx, p.ID, p.Info.Version)
}

// ModuleHash returns the module.js SHA256 hash for a plugin.
func (s *Service) ModuleHash(ctx context.Context, p pluginstore.Plugin) string {
	return s.pluginAssets.ModuleHash(ctx, p.ID, p.Info.Version)
}
