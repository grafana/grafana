package manager

import (
	"context"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/installer"
	"github.com/grafana/grafana/pkg/plugins/manager/loader"
	"github.com/grafana/grafana/pkg/plugins/manager/process"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	grafanaComURL = "https://grafana.com/api/plugins"
)

type PluginManager struct {
	cfg             *plugins.Cfg
	processManager  process.Service
	pluginRegistry  registry.Service
	pluginInstaller installer.Service
	pluginLoader    loader.Service
	pluginSources   []plugins.PluginSource
	log             log.Logger
}

func ProvideService(grafanaCfg *setting.Cfg, pluginRegistry registry.Service, pluginLoader loader.Service,
	pluginInstaller installer.Service, processManager process.Service) (*PluginManager, error) {
	pm := New(plugins.FromGrafanaCfg(grafanaCfg), pluginRegistry, pluginSources(grafanaCfg), pluginLoader, pluginInstaller, processManager)
	if err := pm.Init(); err != nil {
		return nil, err
	}
	return pm, nil
}

func New(cfg *plugins.Cfg, pluginRegistry registry.Service, pluginSources []plugins.PluginSource,
	pluginLoader loader.Service, pluginInstaller installer.Service, processManager process.Service) *PluginManager {
	return &PluginManager{
		cfg:             cfg,
		processManager:  processManager,
		pluginLoader:    pluginLoader,
		pluginSources:   pluginSources,
		pluginRegistry:  pluginRegistry,
		pluginInstaller: pluginInstaller,
		log:             log.New("plugin.manager"),
	}
}

func (m *PluginManager) Init() error {
	return m.sync(context.Background(), m.pluginSources...)
}

func (m *PluginManager) Run(ctx context.Context) error {
	<-ctx.Done()
	m.processManager.Shutdown(ctx)
	return ctx.Err()
}

func (m *PluginManager) sync(ctx context.Context, pluginSources ...plugins.PluginSource) error {
	// TODO merge sources with existing

	for _, ps := range pluginSources {
		err := m.loadPlugins(ctx, ps.Class, ps.Paths...)
		if err != nil {
			return err
		}
	}

	return nil
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

func (m *PluginManager) unregisterAndStop(ctx context.Context, p *plugins.Plugin) error {
	m.log.Debug("Stopping plugin process", "pluginId", p.ID)
	err := m.processManager.Stop(ctx, p)
	if err != nil {
		return err
	}

	if err = m.pluginRegistry.Remove(ctx, p.ID); err != nil {
		return err
	}

	m.log.Debug("Plugin unregistered", "pluginId", p.ID)
	return nil
}

func (m *PluginManager) loadPlugins(ctx context.Context, class plugins.Class, paths ...string) error {
	if len(paths) == 0 {
		return nil
	}

	var pluginPaths []string
	for _, p := range paths {
		if p != "" {
			pluginPaths = append(pluginPaths, p)
		}
	}

	// get all registered plugins
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
		if err := m.registerAndStart(context.Background(), p); err != nil {
			m.log.Error("Could not start plugin", "pluginId", p.ID, "err", err)
		}
	}

	return nil
}

func (m *PluginManager) registerAndStart(ctx context.Context, p *plugins.Plugin) error {
	if err := m.pluginRegistry.Add(ctx, p); err != nil {
		return err
	}

	if !p.IsCorePlugin() {
		m.log.Info("Plugin registered", "pluginId", p.ID)
	}

	return m.processManager.Start(ctx, p)
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
