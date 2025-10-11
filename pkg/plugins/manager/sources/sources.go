package sources

import (
	"context"
	"path/filepath"
	"sync"

	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana/apps/plugins/pkg/app/install"
	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/sources/api"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
)

type Service struct {
	cfgProvider    configprovider.ConfigProvider
	downloader     PluginDownloader
	configSyncOnce sync.Once
	configSyncer   api.ConfigSyncer
	sourceFactory  *api.SourceFactory
	log            log.Logger
}

var metricsRegistered sync.Once

func ProvideService(cfgProvider configprovider.ConfigProvider, pCcfg *config.PluginManagementCfg, downloader PluginDownloader, promReg prometheus.Registerer, clientGenerator resource.ClientGenerator) (*Service, error) {
	metricsRegistered.Do(func() {
		if err := RegisterMetrics(promReg); err != nil {
			log.New("plugin.sources").Warn("Failed to register install metrics", "error", err)
		}
	})

	configSyncer := api.NewConfigSyncer(clientGenerator)
	sourceFactory := api.NewSourceFactory(
		func(class plugins.Class, paths []string) (plugins.PluginSource, error) {
			return NewLocalSource(class, paths), nil
		},
		clientGenerator,
		cfgProvider,
		downloader,
	)

	return &Service{
		cfgProvider:   cfgProvider,
		downloader:    downloader,
		configSyncer:  configSyncer,
		sourceFactory: sourceFactory,
		log:           log.New("plugin.sources"),
	}, nil
}

func (s *Service) List(ctx context.Context) []plugins.PluginSource {
	r := []plugins.PluginSource{}

	// 0. Sync preinstall plugins from config to API
	s.syncPreinstallToAPI(ctx)

	// 1. Use source factory to build sources from API
	apiSources, err := s.sourceFactory.List(ctx)
	if err != nil {
		s.log.Error("Failed to get API plugin sources", "error", err)
	}
	s.log.Debug("API plugin sources", "apiSources", apiSources)
	r = append(r, apiSources...)

	// 2. Add core plugins
	r = append(r, NewLocalSource(
		plugins.ClassCore,
		s.corePluginPaths(),
	))

	// 3. Add external sources (scan disk)
	r = append(r, s.externalPluginSources()...)

	// 4. Add plugin settings sources
	r = append(r, s.pluginSettingSources()...)

	return r
}

func (s *Service) syncPreinstallToAPI(ctx context.Context) {
	s.configSyncOnce.Do(func() {
		cfg, err := s.cfgProvider.Get(ctx)
		if err != nil {
			s.log.Error("Failed to get config for preinstall plugins sync", "error", err)
		}
		s.log.Debug("Syncing preinstall plugins to API", "preinstallPluginsSync", cfg.PreinstallPluginsSync, "preinstallPluginsAsync", cfg.PreinstallPluginsAsync)

		if len(cfg.PreinstallPluginsSync) > 0 {
			preinstallPluginsSync := make([]setting.InstallPlugin, len(cfg.PreinstallPluginsSync))
			for i, p := range cfg.PreinstallPluginsSync {
				if p.Class == "" {
					p.Class = install.ClassExternal
				}
				preinstallPluginsSync[i] = setting.InstallPlugin{
					ID:      p.ID,
					Version: p.Version,
					URL:     p.URL,
					Class:   install.Class(p.Class),
				}
			}
			err := s.configSyncer.Sync(ctx, install.SourcePreinstallSync, preinstallPluginsSync)
			if err != nil {
				s.log.Warn("Failed to sync preinstall plugins", "error", err)
			}
		}

		if len(cfg.PreinstallPluginsAsync) > 0 {
			preinstallPluginsAsync := make([]setting.InstallPlugin, len(cfg.PreinstallPluginsAsync))
			for i, p := range cfg.PreinstallPluginsAsync {
				if p.Class == "" {
					p.Class = install.ClassExternal
				}
				preinstallPluginsAsync[i] = setting.InstallPlugin{
					ID:      p.ID,
					Version: p.Version,
					URL:     p.URL,
					Class:   install.Class(p.Class),
				}
			}
			err := s.configSyncer.Sync(ctx, install.SourcePreinstallAsync, preinstallPluginsAsync)
			if err != nil {
				s.log.Warn("Failed to sync async preinstall plugins", "error", err)
			}
		}
	})
}

func (s *Service) externalPluginSources() []plugins.PluginSource {
	cfg, err := s.cfgProvider.Get(context.Background())
	if err != nil {
		s.log.Error("Failed to get config", "error", err)
		return []plugins.PluginSource{}
	}

	pCfg := &config.PluginManagementCfg{
		PluginsPath: cfg.PluginsPath,
		DevMode:     cfg.Env == setting.Dev,
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
