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

var _ plugins.Installer = (*PluginInstaller)(nil)

type PluginInstaller struct {
	cfg            *plugins.Cfg
	installerSvc   installer.Service
	processManager process.Service
	pluginRegistry registry.Service
	pluginLoader   loader.Service
	log            log.Logger
}

func ProvideInstaller(grafanaCfg *setting.Cfg, pluginRegistry registry.Service, pluginLoader loader.Service) (*PluginInstaller, error) {
	return New(plugins.FromGrafanaCfg(grafanaCfg), pluginRegistry, pluginLoader), nil
}

func New(cfg *plugins.Cfg, pluginRegistry registry.Service, pluginLoader loader.Service) *PluginInstaller {
	logger := log.New("plugin.installer")
	return &PluginInstaller{
		cfg:            cfg,
		pluginLoader:   pluginLoader,
		pluginRegistry: pluginRegistry,
		processManager: process.NewManager(pluginRegistry),
		installerSvc:   installer.New(false, cfg.BuildVersion, installer.WithLogger(logger)),
		log:            logger,
	}
}

func (m *PluginInstaller) Add(ctx context.Context, pluginID, version string) error {
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
		updateInfo, err := m.installerSvc.GetUpdateInfo(ctx, pluginID, version, grafanaComURL)
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

	err := m.installerSvc.Install(ctx, pluginID, version, m.cfg.PluginsPath, pluginZipURL, grafanaComURL)
	if err != nil {
		return err
	}

	err = m.loadPlugins(context.Background(), plugins.External, []string{m.cfg.PluginsPath})
	if err != nil {
		return err
	}

	return nil
}

func (m *PluginInstaller) AddFromSource(ctx context.Context, source plugins.PluginSource) error {
	return m.loadPlugins(ctx, source.Class, source.Paths)
}

func (m *PluginInstaller) Remove(ctx context.Context, pluginID string) error {
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

	if err = m.unregisterAndStop(ctx, plugin); err != nil {
		return err
	}

	return m.installerSvc.Uninstall(ctx, plugin.PluginDir)
}

// plugin finds a plugin with `pluginID` from the registry that is not decommissioned
func (m *PluginInstaller) plugin(ctx context.Context, pluginID string) (*plugins.Plugin, bool) {
	p, exists := m.pluginRegistry.Plugin(ctx, pluginID)
	if !exists {
		return nil, false
	}

	if p.IsDecommissioned() {
		return nil, false
	}

	return p, true
}

func (m *PluginInstaller) loadPlugins(ctx context.Context, class plugins.Class, pluginPaths []string) error {
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
		if err = m.registerAndStart(context.Background(), p); err != nil {
			m.log.Error("Could not start plugin", "pluginId", p.ID, "err", err)
		}
	}

	return nil
}

func (m *PluginInstaller) registerAndStart(ctx context.Context, p *plugins.Plugin) error {
	if err := m.pluginRegistry.Add(ctx, p); err != nil {
		return err
	}
	return m.processManager.Start(ctx, p.ID)
}

func (m *PluginInstaller) unregisterAndStop(ctx context.Context, p *plugins.Plugin) error {
	m.log.Debug("Stopping plugin process", "pluginId", p.ID)

	if err := m.processManager.Stop(ctx, p.ID); err != nil {
		return err
	}

	if err := m.pluginRegistry.Remove(ctx, p.ID); err != nil {
		return err
	}
	m.log.Debug("Plugin unregistered", "pluginId", p.ID)
	return nil
}
