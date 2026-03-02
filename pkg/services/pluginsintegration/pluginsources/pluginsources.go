package pluginsources

import (
	"context"
	"path/filepath"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	cfg            *config.PluginManagementCfg
	staticRootPath string

	log log.Logger
}

func ProvideService(cfg *setting.Cfg, pCcfg *config.PluginManagementCfg) *Service {
	return &Service{
		cfg:            pCcfg,
		staticRootPath: cfg.StaticRootPath,
		log:            log.New("plugin.sources"),
	}
}

func (s *Service) List(_ context.Context) []plugins.PluginSource {
	r := []plugins.PluginSource{ //nolint:prealloc
		sources.NewLocalSource(
			plugins.ClassCore,
			s.corePluginPaths(),
		),
	}
	r = append(r, s.externalPluginSources()...)
	r = append(r, s.pluginSettingSources()...)
	return r
}

func (s *Service) externalPluginSources() []plugins.PluginSource {
	localSrcs, err := sources.DirAsLocalSources(s.cfg, s.cfg.PluginsPaths, plugins.ClassExternal)
	if err != nil {
		s.log.Error("Failed to load external plugins", "error", err)
		return []plugins.PluginSource{}
	}

	srcs := make([]plugins.PluginSource, len(localSrcs))
	for i, src := range localSrcs {
		srcs[i] = src
	}

	return srcs
}

func (s *Service) pluginSettingSources() []plugins.PluginSource {
	srcs := make([]plugins.PluginSource, 0, len(s.cfg.PluginSettings))
	for _, ps := range s.cfg.PluginSettings {
		path, exists := ps["path"]
		if !exists || path == "" {
			continue
		}
		if s.cfg.DevMode {
			srcs = append(srcs, sources.NewUnsafeLocalSource(plugins.ClassExternal, []string{path}))
		} else {
			srcs = append(srcs, sources.NewLocalSource(plugins.ClassExternal, []string{path}))
		}
	}

	return srcs
}

// corePluginPaths provides a list of the Core plugin file system paths
func (s *Service) corePluginPaths() []string {
	datasourcePaths := filepath.Join(s.staticRootPath, "app", "plugins", "datasource")
	panelsPath := filepath.Join(s.staticRootPath, "app", "plugins", "panel")
	return []string{datasourcePaths, panelsPath}
}
