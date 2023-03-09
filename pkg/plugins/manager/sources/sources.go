package sources

import (
	"context"
	"path/filepath"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	gCfg *setting.Cfg
	cfg  *config.Cfg
	log  log.Logger
}

func ProvideService(gCfg *setting.Cfg, cfg *config.Cfg) *Service {
	return &Service{
		gCfg: gCfg,
		cfg:  cfg,
		log:  log.New("plugin.sources"),
	}
}

func (s *Service) List(_ context.Context) []plugins.PluginSource {
	return []plugins.PluginSource{
		{Class: plugins.Core, Paths: corePluginPaths(s.gCfg.StaticRootPath)},
		{Class: plugins.Bundled, Paths: []string{s.gCfg.BundledPluginsPath}},
		{Class: plugins.External, Paths: append([]string{s.cfg.PluginsPath}, pluginFSPaths(s.cfg.PluginSettings)...)},
	}
}

// corePluginPaths provides a list of the Core plugin file system paths
func corePluginPaths(staticRootPath string) []string {
	datasourcePaths := filepath.Join(staticRootPath, "app/plugins/datasource")
	panelsPath := filepath.Join(staticRootPath, "app/plugins/panel")
	return []string{datasourcePaths, panelsPath}
}

// pluginSettingPaths provides plugin file system paths defined in cfg.PluginSettings
func pluginFSPaths(ps map[string]map[string]string) []string {
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
