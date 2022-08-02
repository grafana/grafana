package manager

import (
	"context"
	"path/filepath"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/loader"
	"github.com/grafana/grafana/pkg/plugins/manager/process"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/setting"
)

type PluginManager struct {
	cfg            *plugins.Cfg
	processManager process.Service
	pluginRegistry registry.Service
	pluginLoader   loader.Service
	pluginSources  []PluginSource
	log            log.Logger
}

type PluginSource struct {
	Class plugins.Class
	Paths []string
}

func ProvideOrchestrator(grafanaCfg *setting.Cfg, pluginRegistry registry.Service, pluginLoader loader.Service) (*PluginManager, error) {
	return NewManager(plugins.FromGrafanaCfg(grafanaCfg), pluginRegistry, pluginSources(grafanaCfg), pluginLoader), nil
}

func NewManager(cfg *plugins.Cfg, pluginRegistry registry.Service, pluginSources []PluginSource,
	pluginLoader loader.Service) *PluginManager {
	return &PluginManager{
		cfg:            cfg,
		pluginLoader:   pluginLoader,
		pluginSources:  pluginSources,
		pluginRegistry: pluginRegistry,
		processManager: process.NewManager(pluginRegistry),
		log:            log.New("plugin.manager"),
	}
}

func (m *PluginManager) Run(ctx context.Context) error {
	return m.sync(ctx, m.pluginSources...)
}

func (m *PluginManager) sync(ctx context.Context, pluginSources ...PluginSource) error {
	for _, ps := range pluginSources {
		err := m.loadPlugins(ctx, ps.Class, ps.Paths...)
		if err != nil {
			return err
		}
	}

	return nil
}

func (m *PluginManager) loadPlugins(ctx context.Context, class plugins.Class, paths ...string) error {
	if len(paths) == 0 {
		return nil
	}

	var pluginPaths []string
	for _, p := range paths {
		if p != "" {
			pluginPaths = append(pluginPaths, p)
		}
	}

	// get all registered plugins
	registeredPlugins := make(map[string]struct{})
	for _, p := range m.pluginRegistry.Plugins(ctx) {
		registeredPlugins[p.ID] = struct{}{}
	}

	loadedPlugins, err := m.pluginLoader.Load(ctx, class, pluginPaths, registeredPlugins)
	if err != nil {
		m.log.Error("Could not load plugins", "paths", pluginPaths, "err", err)
		return err
	}

	for _, p := range loadedPlugins {
		if err = m.registerAndStart(context.Background(), p); err != nil {
			m.log.Error("Could not start plugin", "pluginId", p.ID, "err", err)
		}
	}

	return nil
}

func (m *PluginManager) registerAndStart(ctx context.Context, p *plugins.Plugin) error {
	if err := m.pluginRegistry.Add(ctx, p); err != nil {
		return err
	}
	return m.processManager.Start(ctx, p.ID)
}

func pluginSources(cfg *setting.Cfg) []PluginSource {
	return []PluginSource{
		{Class: plugins.Core, Paths: corePluginPaths(cfg)},
		{Class: plugins.Bundled, Paths: []string{cfg.BundledPluginsPath}},
		{Class: plugins.External, Paths: append([]string{cfg.PluginsPath}, pluginSettingPaths(cfg)...)},
	}
}

// corePluginPaths provides a list of the Core plugin paths which need to be scanned on init()
func corePluginPaths(cfg *setting.Cfg) []string {
	datasourcePaths := filepath.Join(cfg.StaticRootPath, "app/plugins/datasource")
	panelsPath := filepath.Join(cfg.StaticRootPath, "app/plugins/panel")

	return []string{datasourcePaths, panelsPath}
}

// pluginSettingPaths provides a plugin paths defined in cfg.PluginSettings which need to be scanned on init()
func pluginSettingPaths(cfg *setting.Cfg) []string {
	var pluginSettingDirs []string
	for _, settings := range cfg.PluginSettings {
		path, exists := settings["path"]
		if !exists || path == "" {
			continue
		}
		pluginSettingDirs = append(pluginSettingDirs, path)
	}

	return pluginSettingDirs
}
