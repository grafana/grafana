package manager

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"

	"github.com/Masterminds/semver"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/repository"
	"github.com/grafana/grafana/pkg/util/errutil"
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

func (m *PluginManager) Add(ctx context.Context, pluginID, version string, repo repository.Service,
	opts plugins.CompatabilityOpts) error {
	if version != "" && !isSemVerExpr(version) {
		return plugins.ErrInvalidPluginVersionFormat
	}

	var pluginArchive *repository.PluginArchive
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
		dlOpts, err := repo.GetPluginDownloadOptions(ctx, pluginID, version, repository.CompatabilityOpts{
			GrafanaVersion: opts.GrafanaVersion,
		})
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
			pluginArchive, err = repo.GetPluginArchiveByURL(ctx, dlOpts.PluginZipURL, repository.CompatabilityOpts{
				GrafanaVersion: opts.GrafanaVersion,
			})
			if err != nil {
				return err
			}
		} else {
			pluginArchive, err = repo.GetPluginArchive(ctx, pluginID, dlOpts.Version, repository.CompatabilityOpts{
				GrafanaVersion: opts.GrafanaVersion,
			})
			if err != nil {
				return err
			}
		}
	} else {
		var err error
		pluginArchive, err = repo.GetPluginArchive(ctx, pluginID, version, repository.CompatabilityOpts{
			GrafanaVersion: opts.GrafanaVersion,
		})
		if err != nil {
			return err
		}
	}

	extractedArchive, err := m.pluginFs.Add(ctx, pluginArchive.File, pluginID, m.cfg.PluginsPath)
	if err != nil {
		return err
	}

	// download dependency plugins
	pathsToScan := []string{extractedArchive.Path}
	for _, dep := range extractedArchive.Dependencies {
		m.log.Info("Fetching %s dependencies...", dep.ID)
		d, err := repo.GetPluginArchive(ctx, dep.ID, dep.Version,
			repository.CompatabilityOpts{GrafanaVersion: opts.GrafanaVersion})
		if err != nil {
			return errutil.Wrapf(err, "failed to download plugin %s from repository", dep.ID)
		}

		depArchive, err := m.pluginFs.Add(ctx, d.File, dep.ID, m.cfg.PluginsPath)
		if err != nil {
			return err
		}

		pathsToScan = append(pathsToScan, depArchive.Path)
	}

	err = m.loadPlugins(context.Background(), plugins.External, pathsToScan...)
	if err != nil {
		m.log.Error("Could not load plugins", "paths", pathsToScan, "err", err)
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

	return m.pluginFs.Remove(ctx, plugin.PluginDir)
}

func isSemVerExpr(version string) bool {
	if version == "" {
		return false
	}

	_, err := semver.NewConstraint(version)

	return err == nil
}
