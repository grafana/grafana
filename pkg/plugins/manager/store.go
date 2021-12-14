package manager

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/Masterminds/semver"

	"github.com/grafana/grafana/pkg/plugins"
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

func (m *PluginManager) Add(ctx context.Context, pluginID, version string, repo plugins.Repository) error {
	if version != "" && !isSemVerExpr(version) {
		return plugins.ErrInvalidPluginVersionFormat
	}

	var newPluginArchive *plugins.PluginArchiveInfo
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

		// get plugin update information to confirm if target update is possible
		dlOpts, err := repo.GetDownloadOptions(ctx, pluginID, version)
		if err != nil {
			return err
		}

		// if existing plugin version is the same as the target update version
		if dlOpts.Version == plugin.Info.Version {
			return plugins.DuplicateError{
				PluginID:          plugin.ID,
				ExistingPluginDir: plugin.PluginDir,
			}
		}

		if dlOpts.PluginZipURL == "" && dlOpts.Version == "" {
			return fmt.Errorf("could not determine update options for %s", pluginID)
		}

		// remove existing installation of plugin
		err = m.Remove(ctx, plugin.ID)
		if err != nil {
			return err
		}

		if dlOpts.PluginZipURL != "" {
			newPluginArchive, err = repo.DownloadWithURL(ctx, pluginID, dlOpts.PluginZipURL)
			if err != nil {
				return err
			}
		} else {
			newPluginArchive, err = repo.Download(ctx, pluginID, dlOpts.Version)
			if err != nil {
				return err
			}
		}
	} else {
		var err error
		newPluginArchive, err = repo.Download(ctx, pluginID, version)
		if err != nil {
			return err
		}
	}

	err := m.loadPlugins(newPluginArchive.Path)
	if err != nil {
		m.log.Error("Could not load plugin", "path", newPluginArchive.Path, "err", err)
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

	// verify it's a plugin directory
	if _, err := os.Stat(filepath.Join(plugin.PluginDir, "plugin.json")); err != nil {
		if os.IsNotExist(err) {
			if _, err := os.Stat(filepath.Join(plugin.PluginDir, "dist", "plugin.json")); err != nil {
				if os.IsNotExist(err) {
					return fmt.Errorf("tried to remove %s, but it doesn't seem to be a plugin", plugin.PluginDir)
				}
			}
		}
	}

	m.log.Info("Uninstalling plugin %v", plugin.PluginDir)

	return os.RemoveAll(plugin.PluginDir)
}

func isSemVerExpr(version string) bool {
	if version == "" {
		return false
	}

	_, err := semver.NewConstraint(version)

	return err == nil
}
