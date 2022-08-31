package manager

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/loader"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/setting"
)

var _ plugins.Installer = (*PluginInstallerEnt)(nil)

type PluginInstallerEnt struct {
	cfg            *plugins.Cfg
	pluginRegistry registry.Service
	pluginLoader   loader.Service
	log            log.Logger
}

func ProvideInstallerEnt(grafanaCfg *setting.Cfg, pluginRegistry registry.Service, pluginLoader loader.Service) (*PluginInstaller, error) {
	return New(plugins.FromGrafanaCfg(grafanaCfg), pluginRegistry, pluginLoader), nil
}

func NewEnt(cfg *plugins.Cfg, pluginRegistry registry.Service, pluginLoader loader.Service) *PluginInstaller {
	logger := log.New("plugin.installer")
	return &PluginInstaller{
		cfg:            cfg,
		pluginLoader:   pluginLoader,
		pluginRegistry: pluginRegistry,
		log:            logger,
	}
}

func (m *PluginInstallerEnt) AddFromSource(ctx context.Context, source plugins.PluginSource) error {
	_, err := m.pluginLoader.Load(ctx, source.Class, source.Paths)
	if err != nil {
		m.log.Error("Could not load plugins", "paths", source.Paths, "err", err)
		return err
	}
	return nil
}

func (m *PluginInstallerEnt) Add(ctx context.Context, pluginID, version string, opts plugins.CompatOpts) error {
	// TODO Call grafana.com API
	return nil
}

func (m *PluginInstallerEnt) Remove(ctx context.Context, pluginID string) error {
	// TODO Call grafana.com API
	return nil
}
