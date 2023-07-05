package sources

import (
	"context"
	"path/filepath"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
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
		NewLocalSource(plugins.ClassCore, s.corePluginPaths()),
		NewLocalSource(plugins.ClassBundled, []string{s.gCfg.BundledPluginsPath}),
		NewLocalSource(plugins.ClassExternal, s.externalPluginPaths()),
	}
}

// corePluginPaths provides a list of the Core plugin file system paths
func (s *Service) corePluginPaths() []string {
	datasourcePaths := filepath.Join(s.gCfg.StaticRootPath, "app/plugins/datasource")
	panelsPath := filepath.Join(s.gCfg.StaticRootPath, "app/plugins/panel")
	if s.cfg.Features.IsEnabled(featuremgmt.FlagRunCorePluginsAsExternals) {
		return []string{datasourcePaths, panelsPath}
	}
	pluginsPath, err := filepath.Abs(filepath.Join(s.gCfg.StaticRootPath, "plugins"))
	if err != nil {
		s.log.Error("failed to get absolute path", "error", err)
		return []string{datasourcePaths, panelsPath}
	}
	return []string{datasourcePaths, panelsPath, pluginsPath}
}

func (s *Service) externalPluginPaths() []string {
	res := append([]string{s.cfg.PluginsPath}, pluginFSPaths(s.cfg.PluginSettings)...)
	if s.cfg.Features.IsEnabled(featuremgmt.FlagRunCorePluginsAsExternals) {
		pluginsPath, err := filepath.Abs(filepath.Join(s.gCfg.StaticRootPath, "plugins"))
		if err != nil {
			s.log.Error("failed to get absolute path", "error", err)
			return res
		}
		res = append(res, pluginsPath)
		return res
	}
	return res
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
