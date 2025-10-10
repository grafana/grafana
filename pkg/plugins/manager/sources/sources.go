package sources

import (
	"context"
	"fmt"
	"path/filepath"
	"sync"

	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
)

type Service struct {
	cfgProvider         configprovider.ConfigProvider
	downloader          PluginDownloader
	startupComplete     bool
	pluginInstallClient *PluginInstallClientWrapper // lazy-init
	log                 log.Logger
}

var metricsRegistered sync.Once

func ProvideService(cfgProvider configprovider.ConfigProvider, pCcfg *config.PluginManagementCfg, downloader PluginDownloader, promReg prometheus.Registerer, clientGenerator resource.ClientGenerator) (*Service, error) {
	metricsRegistered.Do(func() {
		if err := RegisterMetrics(promReg); err != nil {
			log.New("plugin.sources").Warn("Failed to register install metrics", "error", err)
		}
	})
	return &Service{
		cfgProvider:         cfgProvider,
		downloader:          downloader,
		startupComplete:     false,
		pluginInstallClient: NewPluginInstallClientWrapper(clientGenerator),
		log:                 log.New("plugin.sources"),
	}, nil
}

func (s *Service) List(ctx context.Context) []plugins.PluginSource {
	r := []plugins.PluginSource{}

	cfg, err := s.cfgProvider.Get(ctx)
	if err != nil {
		s.log.Error("Failed to get config", "error", err)
		return []plugins.PluginSource{}
	}

	// 1. Add API-driven sources (positioned early, before other sources)
	apiSources, err := s.apiPluginSources(ctx, cfg)
	if err != nil {
		s.log.Warn("Failed to get API plugin sources", "error", err)
		// Continue without API sources - not fatal
	} else {
		r = append(r, apiSources...)
	}

	// 2. Add core plugins
	r = append(r, NewLocalSource(
		plugins.ClassCore,
		s.corePluginPaths(),
	))

	// 3. Add config-based preinstall sources (existing behavior)
	if len(cfg.PreinstallPluginsSync) > 0 {
		r = append(r, NewInstallSource(
			cfg.PreinstallPluginsSync,
			s.downloader,
			cfg.PluginsPath,
			s.cfgProvider,
			cfg.BuildVersion,
		))
	}

	// 4. Add async preinstall (config-based, after first startup)
	if s.startupComplete && len(cfg.PreinstallPluginsAsync) > 0 {
		r = append(r, NewInstallSource(
			cfg.PreinstallPluginsAsync,
			s.downloader,
			cfg.PluginsPath,
			s.cfgProvider,
			cfg.BuildVersion,
		))
	}

	// 4. Add external sources (scan disk)
	r = append(r, s.externalPluginSources()...)
	r = append(r, s.pluginSettingSources()...)

	s.startupComplete = true
	return r
}

// apiPluginSources generates plugin sources based on PluginInstall API resources
func (s *Service) apiPluginSources(ctx context.Context, cfg *setting.Cfg) ([]plugins.PluginSource, error) {
	if s.pluginInstallClient == nil {
		return []plugins.PluginSource{}, nil
	}

	// Query API for plugin installs
	namespace := "default" // TODO: make configurable
	pluginInstalls, err := s.pluginInstallClient.ListPluginInstalls(ctx, namespace)
	if err != nil {
		return nil, fmt.Errorf("failed to list plugin installs: %w", err)
	}

	if len(pluginInstalls) == 0 {
		return []plugins.PluginSource{}, nil
	}

	// Group by class
	byClass := make(map[string][]setting.InstallPlugin)
	for _, pi := range pluginInstalls {
		installPlugin := setting.InstallPlugin{
			ID:      pi.ID,
			Version: pi.Version,
			URL:     pi.URL,
			Class:   pi.Class,
		}
		byClass[pi.Class] = append(byClass[pi.Class], installPlugin)
	}

	sources := make([]plugins.PluginSource, 0)

	// External class: use InstallSource
	if externalPlugins, ok := byClass["external"]; ok && len(externalPlugins) > 0 {
		sources = append(sources, NewInstallSource(
			externalPlugins,
			s.downloader,
			cfg.PluginsPath,
			s.cfgProvider,
			cfg.BuildVersion,
		))
	}

	// CDN class: TODO - placeholder
	if cdnPlugins, ok := byClass["cdn"]; ok && len(cdnPlugins) > 0 {
		s.log.Info("CDN plugins found but not yet supported", "count", len(cdnPlugins))
		// TODO: Implement CDN source
	}

	return sources, nil
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
