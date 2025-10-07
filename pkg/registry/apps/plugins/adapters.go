package plugins

import (
	"context"

	"github.com/grafana/grafana/apps/plugins/pkg/reconcilers"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
)

// PluginInstallerAdapter adapts the pkg/plugins/manager.PluginInstaller to the reconcilers.PluginInstaller interface
type PluginInstallerAdapter struct {
	installer *manager.PluginInstaller
}

// NewPluginInstallerAdapter creates a new PluginInstallerAdapter
func NewPluginInstallerAdapter(installer *manager.PluginInstaller) reconcilers.PluginInstaller {
	return &PluginInstallerAdapter{
		installer: installer,
	}
}

// Add adds a new plugin with the specified ID and version
func (a *PluginInstallerAdapter) Add(ctx context.Context, pluginID, version string, opts reconcilers.AddOpts) error {
	pkgOpts := plugins.NewAddOpts(opts.GrafanaVersion, opts.OS, opts.Arch, opts.URL)
	return a.installer.Add(ctx, pluginID, version, pkgOpts)
}

// Remove removes an existing plugin
func (a *PluginInstallerAdapter) Remove(ctx context.Context, pluginID, version string) error {
	return a.installer.Remove(ctx, pluginID, version)
}

// PluginRegistryAdapter adapts the pkg/plugins/manager/registry.Service to the reconcilers.PluginRegistry interface
type PluginRegistryAdapter struct {
	registry registry.Service
}

// NewPluginRegistryAdapter creates a new PluginRegistryAdapter
func NewPluginRegistryAdapter(registry registry.Service) reconcilers.PluginRegistry {
	return &PluginRegistryAdapter{
		registry: registry,
	}
}

// Plugin finds a plugin by its ID and version
func (a *PluginRegistryAdapter) Plugin(ctx context.Context, id, version string) (reconcilers.PluginInfo, bool) {
	plugin, exists := a.registry.Plugin(ctx, id, version)
	if !exists {
		return reconcilers.PluginInfo{}, false
	}
	return reconcilers.PluginInfo{
		Version: plugin.Info.Version,
		Class:   string(plugin.Class),
	}, true
}
