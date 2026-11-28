package pluginsources

import (
	"context"
	"path/filepath"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
	"github.com/grafana/grafana/pkg/plugins/manager/sources/cdn"
	"github.com/grafana/grafana/pkg/plugins/pluginerrs"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	cfg            *config.PluginManagementCfg
	cdn            *pluginscdn.Service
	errorTracker   pluginerrs.ErrorTracker
	staticRootPath string

	log log.Logger
}

func ProvideService(cfg *setting.Cfg, pCcfg *config.PluginManagementCfg, cdnService *pluginscdn.Service, errorTracker pluginerrs.ErrorTracker) *Service {
	return &Service{
		cfg:            pCcfg,
		cdn:            cdnService,
		errorTracker:   errorTracker,
		staticRootPath: cfg.StaticRootPath,
		log:            log.New("plugin.sources"),
	}
}

func (s *Service) List(ctx context.Context) []plugins.PluginSource {
	return append(s.remoteSources(), s.LocalSources(ctx)...)
}

// LocalSources provides the sources that are read from disk.
func (s *Service) LocalSources(_ context.Context) []plugins.PluginSource {
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

// remoteSources provides the source for plugins that are served from a remote URL ([plugin.<id>] cdn_url).
// It is only registered in development mode.
func (s *Service) remoteSources() []plugins.PluginSource {
	if !s.cfg.DevMode {
		return nil
	}
	return []plugins.PluginSource{
		cdn.NewCDNSource(s.cfg, s.cdn, s.errorTracker),
	}
}

func (s *Service) externalPluginSources() []plugins.PluginSource {
	localSrcs := sources.DirAsLocalSources(s.cfg, s.cfg.PluginsPaths, plugins.ClassExternal, s.log)

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
