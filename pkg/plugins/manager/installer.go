package manager

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/loader"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/plugins/storage"
)

var _ plugins.Installer = (*PluginInstaller)(nil)

type PluginInstaller struct {
	pluginRepo     repo.Service
	pluginStorage  storage.ZipExtractor
	pluginRegistry registry.Service
	pluginLoader   loader.Service
	log            log.Logger
}

func ProvideInstaller(cfg *config.Cfg, pluginRegistry registry.Service, pluginLoader loader.Service,
	pluginRepo repo.Service) *PluginInstaller {
	return New(pluginRegistry, pluginLoader, pluginRepo, storage.FileSystem(log.NewPrettyLogger("installer.fs"), cfg.PluginsPath))
}

func New(pluginRegistry registry.Service, pluginLoader loader.Service, pluginRepo repo.Service,
	pluginStorage storage.ZipExtractor) *PluginInstaller {
	return &PluginInstaller{
		pluginLoader:   pluginLoader,
		pluginRegistry: pluginRegistry,
		pluginRepo:     pluginRepo,
		pluginStorage:  pluginStorage,
		log:            log.New("plugin.installer"),
	}
}

func (m *PluginInstaller) Add(ctx context.Context, pluginID, version string, opts plugins.CompatOpts) error {
	compatOpts := repo.NewCompatOpts(opts.GrafanaVersion, opts.OS, opts.Arch)

	var pluginArchive *repo.PluginArchive
	if plugin, exists := m.plugin(ctx, pluginID); exists {
		if plugin.IsCorePlugin() || plugin.IsBundledPlugin() {
			return plugins.ErrInstallCorePlugin
		}

		if plugin.Info.Version == version {
			return plugins.DuplicateError{
				PluginID: plugin.ID,
			}
		}

		// get plugin update information to confirm if target update is possible
		dlOpts, err := m.pluginRepo.GetPluginDownloadOptions(ctx, pluginID, version, compatOpts)
		if err != nil {
			return err
		}

		// if existing plugin version is the same as the target update version
		if dlOpts.Version == plugin.Info.Version {
			return plugins.DuplicateError{
				PluginID: plugin.ID,
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
			pluginArchive, err = m.pluginRepo.GetPluginArchiveByURL(ctx, dlOpts.PluginZipURL, compatOpts)
			if err != nil {
				return err
			}
		} else {
			pluginArchive, err = m.pluginRepo.GetPluginArchive(ctx, pluginID, dlOpts.Version, compatOpts)
			if err != nil {
				return err
			}
		}
	} else {
		var err error
		pluginArchive, err = m.pluginRepo.GetPluginArchive(ctx, pluginID, version, compatOpts)
		if err != nil {
			return err
		}
	}

	extractedArchive, err := m.pluginStorage.Extract(ctx, pluginID, pluginArchive.File)
	if err != nil {
		return err
	}

	// download dependency plugins
	pathsToScan := []string{extractedArchive.Path}
	for _, dep := range extractedArchive.Dependencies {
		m.log.Info("Fetching %s dependencies...", dep.ID)
		d, err := m.pluginRepo.GetPluginArchive(ctx, dep.ID, dep.Version, compatOpts)
		if err != nil {
			return fmt.Errorf("%v: %w", fmt.Sprintf("failed to download plugin %s from repository", dep.ID), err)
		}

		depArchive, err := m.pluginStorage.Extract(ctx, dep.ID, d.File)
		if err != nil {
			return err
		}

		pathsToScan = append(pathsToScan, depArchive.Path)
	}

	_, err = m.pluginLoader.Load(ctx, sources.NewLocalSource(plugins.External, pathsToScan))
	if err != nil {
		m.log.Error("Could not load plugins", "paths", pathsToScan, "err", err)
		return err
	}

	return nil
}

func (m *PluginInstaller) Remove(ctx context.Context, pluginID string) error {
	plugin, exists := m.plugin(ctx, pluginID)
	if !exists {
		return plugins.ErrPluginNotInstalled
	}

	if plugin.IsCorePlugin() || plugin.IsBundledPlugin() {
		return plugins.ErrUninstallCorePlugin
	}

	if err := m.pluginLoader.Unload(ctx, plugin.ID); err != nil {
		return err
	}
	return nil
}

// plugin finds a plugin with `pluginID` from the store
func (m *PluginInstaller) plugin(ctx context.Context, pluginID string) (*plugins.Plugin, bool) {
	p, exists := m.pluginRegistry.Plugin(ctx, pluginID)
	if !exists {
		return nil, false
	}

	return p, true
}
