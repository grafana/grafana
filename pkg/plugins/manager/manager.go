package manager

import (
	"context"
	"path/filepath"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/setting"
)

type PluginManager struct {
	pluginInstaller plugins.Installer
	pluginSources   []plugins.PluginSource
	log             log.Logger
}

func ProvideService(cfg *config.Cfg, gCfg *setting.Cfg, pluginInstaller plugins.Installer) (*PluginManager, error) {
	pm := NewManager(pluginInstaller, pluginSources(pathData{
		pluginsPath:        gCfg.PluginsPath,
		bundledPluginsPath: gCfg.BundledPluginsPath,
		staticRootPath:     gCfg.StaticRootPath,
	}, cfg.PluginSettings))
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

type pathData struct {
	pluginsPath, bundledPluginsPath, staticRootPath string
}

func pluginSources(p pathData, ps map[string]map[string]string) []plugins.PluginSource {
	return []plugins.PluginSource{
		{Class: plugins.Core, Paths: corePluginPaths(p.staticRootPath)},
		{Class: plugins.Bundled, Paths: []string{p.bundledPluginsPath}},
		{Class: plugins.External, Paths: append([]string{p.pluginsPath}, pluginSettingPaths(ps)...)},
	}
}

// corePluginPaths provides a list of the Core plugin paths which need to be scanned on init()
func corePluginPaths(staticRootPath string) []string {
	datasourcePaths := filepath.Join(staticRootPath, "app/plugins/datasource")
	panelsPath := filepath.Join(staticRootPath, "app/plugins/panel")
	return []string{datasourcePaths, panelsPath}
}

// pluginSettingPaths provides a plugin paths defined in cfg.PluginSettings which need to be scanned on init()
func pluginSettingPaths(ps map[string]map[string]string) []string {
	var pluginSettingDirs []string
	for _, s := range ps {
		path, exists := s["path"]
		if !exists || path == "" {
			continue
		}
		pluginSettingDirs = append(pluginSettingDirs, path)
	}
	return pluginSettingDirs
}
