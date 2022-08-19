package manager

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/installer"
	"github.com/grafana/grafana/pkg/plugins/manager/loader"
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

	_, err = m.pluginLoader.Load(ctx, plugins.External, []string{m.cfg.PluginsPath})
	if err != nil {
		m.log.Error("Could not load plugins", "path", m.cfg.PluginsPath, "err", err)
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
	if err := m.pluginLoader.Unload(ctx, pluginID); err != nil {
		return err
	}
	return m.installerSvc.Uninstall(ctx, plugin.PluginDir) // this will be plugin ID
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
