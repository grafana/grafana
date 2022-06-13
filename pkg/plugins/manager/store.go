package manager

import (
	"context"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/plugins"
)

func (m *PluginManager) Plugin(ctx context.Context, pluginID string) (plugins.PluginDTO, bool) {
	p, exists := m.plugin(ctx, pluginID)
	if !exists {
		return plugins.PluginDTO{}, false
	}

	return p.ToDTO(), true
}

func (m *PluginManager) Plugins(ctx context.Context, pluginTypes ...plugins.Type) []plugins.PluginDTO {
	// if no types passed, assume all
	if len(pluginTypes) == 0 {
		pluginTypes = plugins.PluginTypes
	}

	var requestedTypes = make(map[plugins.Type]struct{})
	for _, pt := range pluginTypes {
		requestedTypes[pt] = struct{}{}
	}

	pluginsList := make([]plugins.PluginDTO, 0)
	for _, p := range m.availablePlugins(ctx) {
		if _, exists := requestedTypes[p.Type]; exists {
			pluginsList = append(pluginsList, p.ToDTO())
		}
	}
	return pluginsList
}

// plugin finds a plugin with `pluginID` from the registry that is not decommissioned
func (m *PluginManager) plugin(ctx context.Context, pluginID string) (*plugins.Plugin, bool) {
	p, exists := m.pluginRegistry.Plugin(ctx, pluginID)
	if !exists || p.IsDecommissioned() {
		return nil, false
	}

	return p, true
}

// availablePlugins returns all non-decommissioned plugins from the registry
func (m *PluginManager) availablePlugins(ctx context.Context) []*plugins.Plugin {
	var res []*plugins.Plugin
	for _, p := range m.pluginRegistry.Plugins(ctx) {
		if !p.IsDecommissioned() {
			res = append(res, p)
		}
	}
	return res
}

// registeredPlugins returns all registered plugins from the registry
func (m *PluginManager) registeredPlugins(ctx context.Context) map[string]struct{} {
	pluginsByID := make(map[string]struct{})
	for _, p := range m.pluginRegistry.Plugins(ctx) {
		pluginsByID[p.ID] = struct{}{}
	}

	return pluginsByID
}

func (m *PluginManager) Add(ctx context.Context, pluginID, version string) error {
	var pluginZipURL string

	if plugin, exists := m.plugin(ctx, pluginID); exists {
		if !plugin.IsExternalPlugin() {
			return plugins.ErrInstallCorePlugin
		}

		if plugin.Info.Version == version {
			return plugins.DuplicateError{
				PluginID:          plugin.ID,
				ExistingPluginDir: plugin.PluginDir,
			}
		}

		// get plugin update information to confirm if upgrading is possible
		updateInfo, err := m.pluginInstaller.GetUpdateInfo(ctx, pluginID, version, grafanaComURL)
		if err != nil {
			return err
		}

		pluginZipURL = updateInfo.PluginZipURL

		// remove existing installation of plugin
		err = m.Remove(ctx, plugin.ID)
		if err != nil {
			return err
		}
	}

	err := m.pluginInstaller.Install(ctx, pluginID, version, m.cfg.PluginsPath, pluginZipURL, grafanaComURL)
	if err != nil {
		return err
	}

	err = m.loadPlugins(context.Background(), plugins.External, m.cfg.PluginsPath)
	if err != nil {
		return err
	}

	return nil
}

func (m *PluginManager) Remove(ctx context.Context, pluginID string) error {
	plugin, exists := m.plugin(ctx, pluginID)
	if !exists {
		return plugins.ErrPluginNotInstalled
	}

	if !plugin.IsExternalPlugin() {
		return plugins.ErrUninstallCorePlugin
	}

	// extra security check to ensure we only remove plugins that are located in the configured plugins directory
	path, err := filepath.Rel(m.cfg.PluginsPath, plugin.PluginDir)
	if err != nil || strings.HasPrefix(path, ".."+string(filepath.Separator)) {
		return plugins.ErrUninstallOutsideOfPluginDir
	}

	if err := m.unregisterAndStop(ctx, plugin); err != nil {
		return err
	}

	return m.pluginInstaller.Uninstall(ctx, plugin.PluginDir)
}
