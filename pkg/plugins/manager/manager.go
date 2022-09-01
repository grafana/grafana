package manager

import (
	"context"
	"path/filepath"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
)

type PluginManager struct {
	pluginInstaller plugins.Installer
	pluginSources   []plugins.PluginSource
	log             log.Logger
}

func ProvideService(cfg *setting.Cfg, pluginInstaller plugins.Installer) (*PluginManager, error) {
	pm := NewManager(pluginInstaller, pluginSources(cfg))
	if err := pm.Init(context.Background()); err != nil {
		return nil, err
	}
	return pm, nil
}

func NewManager(pluginInstaller plugins.Installer, pluginSources []plugins.PluginSource) *PluginManager {
	return &PluginManager{
		pluginInstaller: pluginInstaller,
		pluginSources:   pluginSources,
		log:             log.New("plugin.manager"),
	}
}

func (m *PluginManager) Init(ctx context.Context) error {
	for _, ps := range m.pluginSources {
		if err := m.pluginInstaller.AddFromSource(ctx, ps); err != nil {
			return err
		}
	}
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
