package sources

import (
	"context"
	"path/filepath"
	"sync"

	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
)

type Service struct {
	cfgProvider     configprovider.ConfigProvider
	downloader      PluginDownloader
	startupComplete bool

	log log.Logger
}

var metricsRegistered sync.Once

func ProvideService(cfgProvider configprovider.ConfigProvider, pCcfg *config.PluginManagementCfg, downloader PluginDownloader, promReg prometheus.Registerer) (*Service, error) {
	metricsRegistered.Do(func() {
		if err := RegisterMetrics(promReg); err != nil {
			log.New("plugin.sources").Warn("Failed to register preinstall metrics", "error", err)
		}
	})
	return &Service{
		cfgProvider:     cfgProvider,
		downloader:      downloader,
		startupComplete: false,
		log:             log.New("plugin.sources"),
	}, nil
}

func (s *Service) List(ctx context.Context) []plugins.PluginSource {
	r := []plugins.PluginSource{
		NewLocalSource(
			plugins.ClassCore,
			s.corePluginPaths(),
		),
	}

	cfg, err := s.cfgProvider.Get(ctx)
	if err != nil {
		s.log.Error("Failed to get config", "error", err)
		return []plugins.PluginSource{}
	}

	if len(cfg.PreinstallPluginsSync) > 0 {
		r = append(r, NewPreinstallSyncSource(
			cfg.PreinstallPluginsSync,
			s.downloader,
			cfg.PluginsPath,
			s.cfgProvider,
			cfg.BuildVersion,
		))
	}

	// preinstall async plugins are only loaded after startup (first run) is complete
	if s.startupComplete && len(cfg.PreinstallPluginsAsync) > 0 {
		r = append(r, NewPreinstallAsyncSource(
			cfg.PreinstallPluginsAsync,
			s.downloader,
			cfg.PluginsPath,
			s.cfgProvider,
			cfg.BuildVersion,
		))
	}

	r = append(r, s.externalPluginSources()...)
	r = append(r, s.pluginSettingSources()...)

	s.startupComplete = true
	return r
}

func (s *Service) externalPluginSources() []plugins.PluginSource {
	cfg, err := s.cfgProvider.Get(context.Background())
	if err != nil {
		s.log.Error("Failed to get config", "error", err)
		return []plugins.PluginSource{}
	}

	pCfg := &config.PluginManagementCfg{
		PluginsPath: cfg.PluginsPath,
	}

	localSrcs, err := DirAsLocalSources(pCfg, cfg.PluginsPath, plugins.ClassExternal)
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
	cfg, err := s.cfgProvider.Get(context.Background())
	if err != nil {
		s.log.Error("Failed to get config", "error", err)
		return []plugins.PluginSource{}
	}
	sources := make([]plugins.PluginSource, 0, len(cfg.PluginSettings))
	for _, ps := range cfg.PluginSettings {
		path, exists := ps["path"]
		if !exists || path == "" {
			continue
		}
		if cfg.Env == setting.Dev {
			sources = append(sources, NewUnsafeLocalSource(plugins.ClassExternal, []string{path}))
		} else {
			sources = append(sources, NewLocalSource(plugins.ClassExternal, []string{path}))
		}
	}

	return sources
}

// corePluginPaths provides a list of the Core plugin file system paths
func (s *Service) corePluginPaths() []string {
	cfg, err := s.cfgProvider.Get(context.Background())
	if err != nil {
		s.log.Error("Failed to get config", "error", err)
		return []string{}
	}
	staticRootPath := cfg.StaticRootPath
	datasourcePaths := filepath.Join(staticRootPath, "app", "plugins", "datasource")
	panelsPath := filepath.Join(staticRootPath, "app", "plugins", "panel")
	return []string{datasourcePaths, panelsPath}
}
