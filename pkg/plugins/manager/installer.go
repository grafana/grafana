package manager

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/logger"
	"github.com/grafana/grafana/pkg/plugins/manager/loader"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/plugins/storage"
	"github.com/grafana/grafana/pkg/setting"
)

var _ plugins.Installer = (*PluginInstaller)(nil)

type PluginInstaller struct {
	cfg           *plugins.Cfg
	pluginRepo    repo.Service
	pluginStorage storage.Manager
	pluginStore   plugins.Store
	pluginLoader  loader.Service
	log           log.Logger
}

func ProvideInstaller(grafanaCfg *setting.Cfg, pluginStore plugins.Store, pluginLoader loader.Service,
	pluginRepo repo.Service) *PluginInstaller {
	return New(plugins.FromGrafanaCfg(grafanaCfg), pluginStore, pluginLoader,
		storage.FileSystem(logger.NewLogger("plugin.fs"), grafanaCfg.PluginsPath), pluginRepo)
}

func New(cfg *plugins.Cfg, pluginStore plugins.Store, pluginLoader loader.Service,
	pluginStorage storage.Manager, pluginRepo repo.Service) *PluginInstaller {
	return &PluginInstaller{
		cfg:           cfg,
		pluginLoader:  pluginLoader,
		pluginStore:   pluginStore,
		pluginRepo:    pluginRepo,
		pluginStorage: pluginStorage,
		log:           log.New("plugin.installer"),
	}
}

func (m *PluginInstaller) Add(ctx context.Context, pluginID, version string, opts plugins.CompatOpts) error {
	compatOpts := repo.NewCompatOpts(opts.GrafanaVersion, opts.OS, opts.Arch)

	var pluginArchive *repo.PluginArchive
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

		// get plugin update information to confirm if target update is possible
		dlOpts, err := m.pluginRepo.GetPluginDownloadOptions(ctx, pluginID, version, compatOpts)
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

	extractedArchive, err := m.pluginStorage.Add(ctx, pluginID, pluginArchive.File)
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

		depArchive, err := m.pluginStorage.Add(ctx, dep.ID, d.File)
		if err != nil {
			return err
		}

		pathsToScan = append(pathsToScan, depArchive.Path)
	}

	err = m.AddFromSource(ctx, plugins.PluginSource{Class: plugins.External, Paths: pathsToScan})
	if err != nil {
		m.log.Error("Could not load plugins", "paths", pathsToScan, "err", err)
		return err
	}

	return nil
}

func (m *PluginInstaller) AddFromSource(ctx context.Context, source plugins.PluginSource) error {
	_, err := m.pluginLoader.Load(ctx, source.Class, source.Paths)
	if err != nil {
		m.log.Error("Could not load plugins", "path", m.cfg.PluginsPath, "err", err)
		return err
	}
	return nil
}

func (m *PluginInstaller) Remove(ctx context.Context, pluginID string) error {
	plugin, exists := m.plugin(ctx, pluginID)
	if !exists {
		return plugins.ErrPluginNotInstalled
	}

	if !plugin.IsExternalPlugin() {
		return plugins.ErrUninstallCorePlugin
	}

	if err := m.pluginLoader.Unload(ctx, plugin.ID); err != nil {
		return err
	}
	return nil
}

// plugin finds a plugin with `pluginID` from the store
func (m *PluginInstaller) plugin(ctx context.Context, pluginID string) (plugins.PluginDTO, bool) {
	p, exists := m.pluginStore.Plugin(ctx, pluginID)
	if !exists {
		return plugins.PluginDTO{}, false
	}

	return p, true
}
