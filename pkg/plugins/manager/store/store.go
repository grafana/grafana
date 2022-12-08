package store

import (
	"context"
	"path/filepath"
	"sort"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager/loader"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/setting"
)

var _ plugins.Store = (*Service)(nil)

type Service struct {
	gCfg           *setting.Cfg
	cfg            *config.Cfg
	pluginRegistry registry.Service
	pluginLoader   loader.Service
}

func ProvideService(gCfg *setting.Cfg, cfg *config.Cfg, pluginRegistry registry.Service, pluginLoader loader.Service) (*Service, error) {
	return New(gCfg, cfg, pluginRegistry, pluginLoader), nil
}

func New(gCfg *setting.Cfg, cfg *config.Cfg, pluginRegistry registry.Service, pluginLoader loader.Service) *Service {
	return &Service{
		gCfg:           gCfg,
		cfg:            cfg,
		pluginRegistry: pluginRegistry,
		pluginLoader:   pluginLoader,
	}
}

func (s *Service) Plugin(ctx context.Context, pluginID string) (plugins.PluginDTO, bool) {
	p, exists := s.plugin(ctx, pluginID)
	if !exists {
		return plugins.PluginDTO{}, false
	}

	return p.ToDTO(), true
}

func (s *Service) Run(ctx context.Context) error {
	for _, ps := range pluginSources(s.gCfg, s.cfg) {
		if _, err := s.pluginLoader.Load(context.Background(), ps.Class, ps.Paths); err != nil {
			return err
		}
	}
	<-ctx.Done()
	return nil
}

func (s *Service) Plugins(ctx context.Context, pluginTypes ...plugins.Type) []plugins.PluginDTO {
	// if no types passed, assume all
	if len(pluginTypes) == 0 {
		pluginTypes = plugins.PluginTypes
	}

	var requestedTypes = make(map[plugins.Type]struct{})
	for _, pt := range pluginTypes {
		requestedTypes[pt] = struct{}{}
	}

	pluginsList := make([]plugins.PluginDTO, 0)
	for _, p := range s.availablePlugins(ctx) {
		if _, exists := requestedTypes[p.Type]; exists {
			pluginsList = append(pluginsList, p.ToDTO())
		}
	}
	return pluginsList
}

func (s *Service) Renderer(ctx context.Context) *plugins.Plugin {
	for _, p := range s.availablePlugins(ctx) {
		if p.IsRenderer() {
			return p
		}
	}
	return nil
}

func (s *Service) SecretsManager(ctx context.Context) *plugins.Plugin {
	for _, p := range s.availablePlugins(ctx) {
		if p.IsSecretsManager() {
			return p
		}
	}
	return nil
}

// plugin finds a plugin with `pluginID` from the registry that is not decommissioned
func (s *Service) plugin(ctx context.Context, pluginID string) (*plugins.Plugin, bool) {
	p, exists := s.pluginRegistry.Plugin(ctx, pluginID)
	if !exists {
		return nil, false
	}

	if p.IsDecommissioned() {
		return nil, false
	}

	return p, true
}

// availablePlugins returns all non-decommissioned plugins from the registry sorted by alphabetic order on `plugin.ID`
func (s *Service) availablePlugins(ctx context.Context) []*plugins.Plugin {
	var res []*plugins.Plugin
	for _, p := range s.pluginRegistry.Plugins(ctx) {
		if !p.IsDecommissioned() {
			res = append(res, p)
		}
	}
	sort.SliceStable(res, func(i, j int) bool {
		return res[i].ID < res[j].ID
	})
	return res
}

func (s *Service) Routes() []*plugins.StaticRoute {
	staticRoutes := make([]*plugins.StaticRoute, 0)

	for _, p := range s.availablePlugins(context.TODO()) {
		if p.StaticRoute() != nil {
			staticRoutes = append(staticRoutes, p.StaticRoute())
		}
	}
	return staticRoutes
}

func pluginSources(gCfg *setting.Cfg, cfg *config.Cfg) []plugins.PluginSource {
	return []plugins.PluginSource{
		{Class: plugins.Core, Paths: corePluginPaths(gCfg.StaticRootPath)},
		{Class: plugins.Bundled, Paths: []string{gCfg.BundledPluginsPath}},
		{Class: plugins.External, Paths: append([]string{cfg.PluginsPath}, pluginSettingPaths(cfg.PluginSettings)...)},
	}
}

// corePluginPaths provides a list of the Core plugin paths which need to be scanned on init()
func corePluginPaths(staticRootPath string) []string {
	datasourcePaths := filepath.Join(staticRootPath, "app/plugins/datasource")
	panelsPath := filepath.Join(staticRootPath, "app/plugins/panel")
	return []string{datasourcePaths, panelsPath}
}

// pluginSettingPaths provides a plugin paths defined in cfg.PluginSettings which need to be scanned on init()
func pluginSettingPaths(ps map[string]map[string]string) []string {
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
