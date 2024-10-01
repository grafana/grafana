package manager

import (
	"context"
	"errors"
	"fmt"
	"sync"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/auth"
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
	pluginRepo           repo.Service
	pluginStorage        storage.ZipExtractor
	pluginStorageDirFunc storage.DirNameGeneratorFunc
	pluginRegistry       registry.Service
	pluginLoader         loader.Service
	installing           sync.Map
	log                  log.Logger
	serviceRegistry      auth.ExternalServiceRegistry
}

func ProvideInstaller(cfg *config.PluginManagementCfg, pluginRegistry registry.Service, pluginLoader loader.Service,
	pluginRepo repo.Service, serviceRegistry auth.ExternalServiceRegistry) *PluginInstaller {
	return New(pluginRegistry, pluginLoader, pluginRepo,
		storage.FileSystem(log.NewPrettyLogger("installer.fs"), cfg.PluginsPath), storage.SimpleDirNameGeneratorFunc, serviceRegistry)
}

func New(pluginRegistry registry.Service, pluginLoader loader.Service, pluginRepo repo.Service,
	pluginStorage storage.ZipExtractor, pluginStorageDirFunc storage.DirNameGeneratorFunc,
	serviceRegistry auth.ExternalServiceRegistry) *PluginInstaller {
	return &PluginInstaller{
		pluginLoader:         pluginLoader,
		pluginRegistry:       pluginRegistry,
		pluginRepo:           pluginRepo,
		pluginStorage:        pluginStorage,
		pluginStorageDirFunc: pluginStorageDirFunc,
		installing:           sync.Map{},
		log:                  log.New("plugin.installer"),
		serviceRegistry:      serviceRegistry,
	}
}

func (m *PluginInstaller) Add(ctx context.Context, pluginID, version string, opts plugins.CompatOpts) error {
	compatOpts, err := RepoCompatOpts(opts)
	if err != nil {
		return err
	}

	if ok, _ := m.installing.Load(pluginID); ok != nil {
		return nil
	}
	m.installing.Store(pluginID, true)
	defer func() {
		m.installing.Delete(pluginID)
	}()

	archive, err := m.install(ctx, pluginID, version, compatOpts)
	if err != nil {
		return err
	}

	for _, dep := range archive.Dependencies {
		m.log.Info(fmt.Sprintf("Fetching %s dependency %s...", pluginID, dep.ID))

		err = m.Add(ctx, dep.ID, dep.Version, opts)
		if err != nil {
			return fmt.Errorf("%v: %w", fmt.Sprintf("failed to download plugin %s from repository", dep.ID), err)
		}
	}

	_, err = m.pluginLoader.Load(ctx, sources.NewLocalSource(plugins.ClassExternal, []string{archive.Path}))
	if err != nil {
		m.log.Error("Could not load plugins", "path", archive.Path, "error", err)
		return err
	}

	return nil
}

func (m *PluginInstaller) install(ctx context.Context, pluginID, version string, compatOpts repo.CompatOpts) (*storage.ExtractedPluginArchive, error) {
	var pluginArchive *repo.PluginArchive
	if plugin, exists := m.plugin(ctx, pluginID, version); exists {
		if plugin.IsCorePlugin() || plugin.IsBundledPlugin() {
			return nil, plugins.ErrInstallCorePlugin
		}

		if plugin.Info.Version == version {
			return nil, plugins.DuplicateError{
				PluginID: plugin.ID,
			}
		}

		// get plugin update information to confirm if target update is possible
		pluginArchiveInfo, err := m.pluginRepo.GetPluginArchiveInfo(ctx, pluginID, version, compatOpts)
		if err != nil {
			return nil, err
		}

		m.log.Info("Updating plugin", "pluginId", pluginID, "from", plugin.Info.Version, "to", pluginArchiveInfo.Version)

		// if existing plugin version is the same as the target update version
		if pluginArchiveInfo.Version == plugin.Info.Version {
			return nil, plugins.DuplicateError{
				PluginID: plugin.ID,
			}
		}

		if pluginArchiveInfo.URL == "" && pluginArchiveInfo.Version == "" {
			return nil, fmt.Errorf("could not determine update options for %s", pluginID)
		}

		// remove existing installation of plugin
		err = m.Remove(ctx, plugin.ID, plugin.Info.Version)
		if err != nil {
			return nil, err
		}

		if pluginArchiveInfo.URL != "" {
			pluginArchive, err = m.pluginRepo.GetPluginArchiveByURL(ctx, pluginArchiveInfo.URL, compatOpts)
			if err != nil {
				return nil, err
			}
		} else {
			pluginArchive, err = m.pluginRepo.GetPluginArchive(ctx, pluginID, pluginArchiveInfo.Version, compatOpts)
			if err != nil {
				return nil, err
			}
		}
	} else {
		var err error
		pluginArchive, err = m.pluginRepo.GetPluginArchive(ctx, pluginID, version, compatOpts)
		if err != nil {
			return nil, err
		}
		m.log.Info("Installing plugin", "pluginId", pluginID, "version", version)
	}

	extractedArchive, err := m.pluginStorage.Extract(ctx, pluginID, m.pluginStorageDirFunc, pluginArchive.File)
	if err != nil {
		return nil, err
	}

	return extractedArchive, nil
}

func (m *PluginInstaller) Remove(ctx context.Context, pluginID, version string) error {
	plugin, exists := m.plugin(ctx, pluginID, version)
	if !exists {
		return plugins.ErrPluginNotInstalled
	}

	if plugin.IsCorePlugin() || plugin.IsBundledPlugin() {
		return plugins.ErrUninstallCorePlugin
	}

	p, err := m.pluginLoader.Unload(ctx, plugin)
	if err != nil {
		return err
	}

	if remover, ok := p.FS.(plugins.FSRemover); ok {
		if err = remover.Remove(); err != nil {
			return err
		}
	}

	has, err := m.serviceRegistry.HasExternalService(ctx, pluginID)
	if err == nil && has {
		return m.serviceRegistry.RemoveExternalService(ctx, pluginID)
	}
	return err
}

// plugin finds a plugin with `pluginID` from the store
func (m *PluginInstaller) plugin(ctx context.Context, pluginID, pluginVersion string) (*plugins.Plugin, bool) {
	p, exists := m.pluginRegistry.Plugin(ctx, pluginID, pluginVersion)
	if !exists {
		return nil, false
	}

	return p, true
}

func RepoCompatOpts(opts plugins.CompatOpts) (repo.CompatOpts, error) {
	os := opts.OS()
	arch := opts.Arch()
	if len(os) == 0 || len(arch) == 0 {
		return repo.CompatOpts{}, errors.New("invalid system compatibility options provided")
	}

	grafanaVersion := opts.GrafanaVersion()
	if len(grafanaVersion) == 0 {
		return repo.NewSystemCompatOpts(os, arch), nil
	}

	return repo.NewCompatOpts(grafanaVersion, os, arch), nil
}
