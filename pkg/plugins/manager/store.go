package manager

import (
	"context"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/plugins"
)

func (m *PluginManager) Add(ctx context.Context, pluginID, version string) error {
	plugin, err := m.plugin(ctx, pluginID)
	if err != nil {
		return err
	}

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

	// remove existing installation of plugin
	err = m.Remove(ctx, plugin.ID)
	if err != nil {
		return err
	}

	err = m.pluginInstaller.Install(ctx, pluginID, version, m.cfg.PluginsPath, updateInfo.PluginZipURL, grafanaComURL)
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
	plugin, err := m.plugin(ctx, pluginID)
	if err != nil {
		return err
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
