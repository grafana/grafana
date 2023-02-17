package sources

import (
	"context"
	"net/url"
	"path/filepath"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	gCfg       *setting.Cfg
	cfg        *config.Cfg
	cdnService *pluginscdn.Service
	log        log.Logger
}

func ProvideService(gCfg *setting.Cfg, cfg *config.Cfg, pluginsCDNService *pluginscdn.Service) *Service {
	return &Service{
		gCfg:       gCfg,
		cfg:        cfg,
		cdnService: pluginsCDNService,
		log:        log.New("plugin.sources"),
	}
}

func (s *Service) List(_ context.Context) []plugins.PluginSource {
	return []plugins.PluginSource{
		{Class: plugins.Core, Paths: corePluginPaths(s.gCfg.StaticRootPath)},
		{Class: plugins.Bundled, Paths: []string{s.gCfg.BundledPluginsPath}},
		{Class: plugins.External, Paths: append([]string{s.cfg.PluginsPath}, pluginFSPaths(s.cfg.PluginSettings)...)},
		{Class: plugins.CDN, Paths: s.pluginCDNURLs(s.cfg.PluginSettings)},
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

// pluginCDNURLs provides a list of URLs for plugins that are marked as CDN enabled via the config
func (s *Service) pluginCDNURLs(ps map[string]map[string]string) []string {
	var pluginCDNURLs []string
	for _, kv := range ps {
		src, exists := kv["url"]
		if !exists || src == "" {
			continue
		}
		u, err := url.Parse(src)
		if err != nil {
			s.log.Warn("....")
			continue
		}

		pluginCDNURLs = append(pluginCDNURLs, u.String())
	}
	return pluginCDNURLs
}

// cdnEnabledPluginPaths provides a list of URLs for plugins that are marked as CDN enabled via the config
func (s *Service) cdnEnabledPluginPaths(ps map[string]map[string]string) []string {
	var cdnEnabledPaths []string
	for pluginID, kv := range ps {
		// TODO determine versioning pattern
		if s.cdnService.PluginSupported(pluginID) && kv["version"] != "" {
			base, err := s.cdnService.AssetURL(pluginID, kv["version"], "")
			if err != nil {
				s.log.Warn("....")
				continue
			}
			cdnEnabledPaths = append(cdnEnabledPaths, base)
		}
	}
	return cdnEnabledPaths
}
