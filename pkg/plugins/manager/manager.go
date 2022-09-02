package manager

import (
	"context"
	"fmt"
	"path/filepath"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/logger"
	"github.com/grafana/grafana/pkg/plugins/manager/loader"
	"github.com/grafana/grafana/pkg/plugins/manager/process"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/plugins/storage"
	"github.com/grafana/grafana/pkg/setting"
)

var _ plugins.Manager = (*PluginManager)(nil)
var _ plugins.RendererManager = (*PluginManager)(nil)
var _ plugins.SecretsPluginManager = (*PluginManager)(nil)

type PluginManager struct {
	cfg            *plugins.Cfg
	pluginSources  []plugins.PluginSource
	pluginRepo     repo.Service
	pluginStorage  storage.Manager
	processManager process.Service
	pluginRegistry registry.Service
	pluginLoader   loader.Service
	log            log.Logger
}

func ProvideService(grafanaCfg *setting.Cfg, pluginRegistry registry.Service, pluginLoader loader.Service,
	pluginRepo repo.Service) (*PluginManager, error) {
	pm := New(plugins.FromGrafanaCfg(grafanaCfg), pluginRegistry, pluginSources(grafanaCfg), pluginLoader,
		pluginRepo, storage.FileSystem(logger.NewLogger("plugin.fs"), grafanaCfg.PluginsPath),
		process.NewManager(pluginRegistry),
	)
	if err := pm.Init(context.Background()); err != nil {
		return nil, err
	}
	return pm, nil
}

func New(cfg *plugins.Cfg, pluginRegistry registry.Service, pluginSources []plugins.PluginSource,
	pluginLoader loader.Service, pluginRepo repo.Service, pluginStorage storage.Manager,
	processManager process.Service) *PluginManager {
	return &PluginManager{
		cfg:            cfg,
		pluginSources:  pluginSources,
		pluginRepo:     pluginRepo,
		pluginLoader:   pluginLoader,
		pluginRegistry: pluginRegistry,
		processManager: processManager,
		pluginStorage:  pluginStorage,
		log:            log.New("plugin.manager"),
	}
}

func (m *PluginManager) Init(ctx context.Context) error {
	for _, ps := range m.pluginSources {
		if err := m.loadPlugins(ctx, ps.Class, ps.Paths...); err != nil {
			return err
		}
	}
	return nil
}

func (m *PluginManager) Add(ctx context.Context, pluginID, version string, opts plugins.CompatOpts) error {
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

	err = m.loadPlugins(context.Background(), plugins.External, pathsToScan...)
	if err != nil {
		m.log.Error("Could not load plugins", "paths", pathsToScan, "err", err)
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

	if err := m.unregisterAndStop(ctx, plugin); err != nil {
		return err
	}

	return m.pluginStorage.Remove(ctx, plugin.ID)
}

func (m *PluginManager) Renderer(ctx context.Context) *plugins.Plugin {
	for _, p := range m.pluginRegistry.Plugins(ctx) {
		if p.IsRenderer() && !p.IsDecommissioned() {
			return p
		}
	}
	return nil
}

func (m *PluginManager) SecretsManager(ctx context.Context) *plugins.Plugin {
	for _, p := range m.pluginRegistry.Plugins(ctx) {
		if p.IsSecretsManager() && !p.IsDecommissioned() {
			return p
		}
	}
	return nil
}

// plugin finds a plugin with `pluginID` from the registry that is not decommissioned
func (m *PluginManager) plugin(ctx context.Context, pluginID string) (*plugins.Plugin, bool) {
	p, exists := m.pluginRegistry.Plugin(ctx, pluginID)
	if !exists {
		return nil, false
	}

	if p.IsDecommissioned() {
		return nil, false
	}

	return p, true
}

func (m *PluginManager) loadPlugins(ctx context.Context, class plugins.Class, pluginPaths ...string) error {
	registeredPlugins := make(map[string]struct{})
	for _, p := range m.pluginRegistry.Plugins(ctx) {
		registeredPlugins[p.ID] = struct{}{}
	}

	loadedPlugins, err := m.pluginLoader.Load(ctx, class, pluginPaths, registeredPlugins)
	if err != nil {
		m.log.Error("Could not load plugins", "paths", pluginPaths, "err", err)
		return err
	}

	for _, p := range loadedPlugins {
		if err = m.registerAndStart(context.Background(), p); err != nil {
			m.log.Error("Could not start plugin", "pluginID", p.ID, "err", err)
		}
	}

	return nil
}

func (m *PluginManager) registerAndStart(ctx context.Context, p *plugins.Plugin) error {
	if err := m.pluginRegistry.Add(ctx, p); err != nil {
		return err
	}

	if !p.IsCorePlugin() {
		m.log.Info("Plugin registered", "pluginID", p.ID)
	}

	return m.processManager.Start(ctx, p.ID)
}

func (m *PluginManager) unregisterAndStop(ctx context.Context, p *plugins.Plugin) error {
	m.log.Debug("Stopping plugin process", "pluginID", p.ID)

	if err := m.processManager.Stop(ctx, p.ID); err != nil {
		return err
	}

	if err := m.pluginRegistry.Remove(ctx, p.ID); err != nil {
		return err
	}
	m.log.Debug("Plugin unregistered", "pluginID", p.ID)
	return nil
}

func pluginSources(cfg *setting.Cfg) []plugins.PluginSource {
	return []plugins.PluginSource{
		{Class: plugins.Core, Paths: corePluginPaths(cfg)},
		{Class: plugins.Bundled, Paths: []string{cfg.BundledPluginsPath}},
		{Class: plugins.External, Paths: append([]string{cfg.PluginsPath}, pluginSettingPaths(cfg)...)},
	}
}

// corePluginPaths provides a list of the Core plugin paths which need to be scanned on init()
func corePluginPaths(cfg *setting.Cfg) []string {
	datasourcePaths := filepath.Join(cfg.StaticRootPath, "app/plugins/datasource")
	panelsPath := filepath.Join(cfg.StaticRootPath, "app/plugins/panel")
	return []string{datasourcePaths, panelsPath}
}

// pluginSettingPaths provides a plugin paths defined in cfg.PluginSettings which need to be scanned on init()
func pluginSettingPaths(cfg *setting.Cfg) []string {
	var pluginSettingDirs []string
	for _, settings := range cfg.PluginSettings {
		path, exists := settings["path"]
		if !exists || path == "" {
			continue
		}
		pluginSettingDirs = append(pluginSettingDirs, path)
	}
	return pluginSettingDirs
}
