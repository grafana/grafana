package sources

import (
	"context"
	"path/filepath"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	cfg *setting.Cfg
	log log.Logger
}

func ProvideService(cfg *setting.Cfg) *Service {
	return &Service{
		cfg: cfg,
		log: log.New("plugin.sources"),
	}
}

func (s *Service) List(_ context.Context) []plugins.PluginSource {
	return append([]plugins.PluginSource{
		NewLocalSource(plugins.ClassCore, corePluginPaths(s.cfg.StaticRootPath)),
		NewLocalSource(plugins.ClassBundled, []string{s.cfg.BundledPluginsPath}),
	}, append(s.externalPluginSources(), s.pluginSettingSources()...)...)
}

func (s *Service) externalPluginSources() []plugins.PluginSource {
	var sources []plugins.PluginSource
	if s.cfg.PluginsPath == "" {
		return sources
	}

	pluginPath := filepath.Join(s.cfg.PluginsPath)
	extPluginDirs, err := filepath.Glob(filepath.Join(pluginPath, "*"))
	if err != nil {
		s.log.Error("Failed to get datasource paths", "error", err)
	}

	for _, dir := range extPluginDirs {
		sources = append(sources, NewLocalSource(plugins.ClassExternal, []string{dir}))
	}
	return sources
}

func (s *Service) pluginSettingSources() []plugins.PluginSource {
	var sources []plugins.PluginSource
	for _, ps := range s.cfg.PluginSettings {
		path, exists := ps["path"]
		if !exists || path == "" {
			continue
		}
		sources = append(sources, NewLocalSource(plugins.ClassExternal, []string{path}))
	}
	return sources
}

// corePluginPaths provides a list of the Core plugin file system paths
func corePluginPaths(staticRootPath string) []string {
	datasourcePaths := filepath.Join(staticRootPath, "app/plugins/datasource")
	panelsPath := filepath.Join(staticRootPath, "app/plugins/panel")
	return []string{datasourcePaths, panelsPath}
}
