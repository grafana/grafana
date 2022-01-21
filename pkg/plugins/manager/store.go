package manager

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
)

func (m *PluginManager) Plugin(_ context.Context, pluginID string) (plugins.PluginDTO, bool) {
	p, exists := m.plugin(pluginID)

	if !exists {
		return plugins.PluginDTO{}, false
	}

	return p.ToDTO(), true
}

func (m *PluginManager) Plugins(_ context.Context, pluginTypes ...plugins.Type) []plugins.PluginDTO {
	// if no types passed, assume all
	if len(pluginTypes) == 0 {
		pluginTypes = plugins.PluginTypes
	}

	var requestedTypes = make(map[plugins.Type]struct{})
	for _, pt := range pluginTypes {
		requestedTypes[pt] = struct{}{}
	}

	pluginsList := make([]plugins.PluginDTO, 0)
	for _, p := range m.plugins() {
		if _, exists := requestedTypes[p.Type]; exists {
			pluginsList = append(pluginsList, p.ToDTO())
		}
	}
	return pluginsList
}

func (m *PluginManager) Add(ctx context.Context, pluginID, version string) error {
	var pluginZipURL string

	if plugin, exists := m.plugin(pluginID); exists {
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

func (m *PluginManager) AddWithFactory(ctx context.Context, pluginID string, factory backendplugin.PluginFactoryFunc,
	pathResolver plugins.PluginPathResolver) error {
	if m.isRegistered(pluginID) {
		return fmt.Errorf("plugin %s is already registered", pluginID)
	}

	path, err := pathResolver()
	if err != nil {
		return err
	}

	p, err := m.pluginLoader.LoadWithFactory(ctx, plugins.Core, path, factory)
	if err != nil {
		return err
	}
	err = m.register(p)
	if err != nil {
		return err
	}
	return nil
}

func (m *PluginManager) Remove(ctx context.Context, pluginID string) error {
	plugin, exists := m.plugin(pluginID)
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

	if m.isRegistered(pluginID) {
		err := m.unregisterAndStop(ctx, plugin)
		if err != nil {
			return err
		}
	}

	return m.pluginInstaller.Uninstall(ctx, plugin.PluginDir)
}
