package sources

import (
	"context"
	"os"
	"path/filepath"
	"slices"

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
	r := []plugins.PluginSource{
		NewLocalSource(plugins.ClassCore, corePluginPaths(s.cfg.StaticRootPath)),
		NewLocalSource(plugins.ClassBundled, []string{s.cfg.BundledPluginsPath}),
	}
	r = append(r, s.externalPluginSources()...)
	r = append(r, s.pluginSettingSources()...)
	return r
}

func (s *Service) externalPluginSources() []plugins.PluginSource {
	var sources []plugins.PluginSource
	if s.cfg.PluginsPath == "" {
		return sources
	}

	pluginsPath := s.cfg.PluginsPath
	// It's safe to ignore gosec warning G304 since the variable part of the file path comes from a configuration
	// variable.
	// nolint:gosec
	d, err := os.ReadDir(pluginsPath)
	if err != nil {
		s.log.Error("Failed to open plugins path", "path", pluginsPath, "error", err)
		return sources
	}

	var pluginDirs []string
	for _, dir := range d {
		if dir.IsDir() || dir.Type()&os.ModeSymlink == os.ModeSymlink {
			pluginDirs = append(pluginDirs, filepath.Join(pluginsPath, dir.Name()))
		}
	}
	slices.Sort(pluginDirs)

	for _, dir := range pluginDirs {
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
