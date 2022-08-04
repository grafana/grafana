package manager

import (
	"context"
	"errors"
	"path/filepath"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/logger"
	"github.com/grafana/grafana/pkg/plugins/manager/loader"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/plugins/storage"
	"github.com/grafana/grafana/pkg/setting"
)

var _ plugins.Manager = (*PluginManager)(nil)
var _ plugins.Client = (*PluginManager)(nil)
var _ plugins.Store = (*PluginManager)(nil)
var _ plugins.StaticRouteResolver = (*PluginManager)(nil)
var _ plugins.RendererManager = (*PluginManager)(nil)
var _ plugins.SecretsPluginManager = (*PluginManager)(nil)

type PluginManager struct {
	cfg            *plugins.Cfg
	pluginRegistry registry.Service
	pluginLoader   loader.Service
	pluginRepo     repo.Service
	pluginSources  []PluginSource
	pluginStorage  storage.Manager
	pluginsMu      sync.RWMutex
	log            log.Logger
}

type PluginSource struct {
	Class plugins.Class
	Paths []string
}

func ProvideService(grafanaCfg *setting.Cfg, pluginRegistry registry.Service, pluginLoader loader.Service,
	pluginRepo repo.Service) (*PluginManager, error) {
	pm := New(plugins.FromGrafanaCfg(grafanaCfg), pluginRegistry, []PluginSource{
		{Class: plugins.Core, Paths: corePluginPaths(grafanaCfg)},
		{Class: plugins.Bundled, Paths: []string{grafanaCfg.BundledPluginsPath}},
		{Class: plugins.External, Paths: append([]string{grafanaCfg.PluginsPath}, pluginSettingPaths(grafanaCfg)...)},
	}, pluginLoader, pluginRepo, storage.FileSystem(logger.NewLogger("plugin.fs"), grafanaCfg.PluginsPath))
	if err := pm.Init(); err != nil {
		return nil, err
	}
	return pm, nil
}

func New(cfg *plugins.Cfg, pluginRegistry registry.Service, pluginSources []PluginSource, pluginLoader loader.Service,
	pluginRepo repo.Service, pluginFs storage.Manager) *PluginManager {
	return &PluginManager{
		cfg:            cfg,
		pluginLoader:   pluginLoader,
		pluginSources:  pluginSources,
		pluginRegistry: pluginRegistry,
		pluginRepo:     pluginRepo,
		pluginStorage:  pluginFs,
		log:            log.New("plugin.manager"),
	}
}

func (m *PluginManager) Init() error {
	for _, ps := range m.pluginSources {
		err := m.loadPlugins(context.Background(), ps.Class, ps.Paths...)
		if err != nil {
			return err
		}
	}

	return nil
}

func (m *PluginManager) Run(ctx context.Context) error {
	<-ctx.Done()
	m.shutdown(ctx)
	return ctx.Err()
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

	loadedPlugins, err := m.pluginLoader.Load(ctx, class, pluginPaths, m.registeredPlugins(ctx))
	if err != nil {
		m.log.Error("Could not load plugins", "paths", pluginPaths, "err", err)
		return err
	}

	for _, p := range loadedPlugins {
		if err := m.registerAndStart(context.Background(), p); err != nil {
			m.log.Error("Could not start plugin", "pluginId", p.ID, "err", err)
		}
	}

	return nil
}

func (m *PluginManager) Renderer() *plugins.Plugin {
	for _, p := range m.availablePlugins(context.TODO()) {
		if p.IsRenderer() {
			return p
		}
	}

	return nil
}

func (m *PluginManager) SecretsManager() *plugins.Plugin {
	for _, p := range m.availablePlugins(context.TODO()) {
		if p.IsSecretsManager() {
			return p
		}
	}

	return nil
}

func (m *PluginManager) Routes() []*plugins.StaticRoute {
	staticRoutes := make([]*plugins.StaticRoute, 0)

	for _, p := range m.availablePlugins(context.TODO()) {
		if p.StaticRoute() != nil {
			staticRoutes = append(staticRoutes, p.StaticRoute())
		}
	}
	return staticRoutes
}

func (m *PluginManager) registerAndStart(ctx context.Context, p *plugins.Plugin) error {
	if err := m.pluginRegistry.Add(ctx, p); err != nil {
		return err
	}

	if !p.IsCorePlugin() {
		m.log.Info("Plugin registered", "pluginId", p.ID)
	}

	return m.start(ctx, p)
}

func (m *PluginManager) unregisterAndStop(ctx context.Context, p *plugins.Plugin) error {
	m.log.Debug("Stopping plugin process", "pluginId", p.ID)
	m.pluginsMu.Lock()
	defer m.pluginsMu.Unlock()

	if err := p.Decommission(); err != nil {
		return err
	}

	if err := p.Stop(ctx); err != nil {
		return err
	}

	if err := m.pluginRegistry.Remove(ctx, p.ID); err != nil {
		return err
	}

	m.log.Debug("Plugin unregistered", "pluginId", p.ID)
	return nil
}

// start starts a backend plugin process
func (m *PluginManager) start(ctx context.Context, p *plugins.Plugin) error {
	if !p.IsManaged() || !p.Backend || p.SignatureError != nil {
		return nil
	}

	if _, exists := m.pluginRegistry.Plugin(ctx, p.ID); !exists {
		return backendplugin.ErrPluginNotRegistered
	}

	if p.IsCorePlugin() {
		return nil
	}

	if err := startPluginAndRestartKilledProcesses(ctx, p); err != nil {
		return err
	}

	p.Logger().Debug("Successfully started backend plugin process")

	return nil
}

func startPluginAndRestartKilledProcesses(ctx context.Context, p *plugins.Plugin) error {
	if err := p.Start(ctx); err != nil {
		return err
	}

	go func(ctx context.Context, p *plugins.Plugin) {
		if err := restartKilledProcess(ctx, p); err != nil {
			p.Logger().Error("Attempt to restart killed plugin process failed", "error", err)
		}
	}(ctx, p)

	return nil
}

func restartKilledProcess(ctx context.Context, p *plugins.Plugin) error {
	ticker := time.NewTicker(time.Second * 1)

	for {
		select {
		case <-ctx.Done():
			if err := ctx.Err(); err != nil && !errors.Is(err, context.Canceled) {
				return err
			}
			return nil
		case <-ticker.C:
			if p.IsDecommissioned() {
				p.Logger().Debug("Plugin decommissioned")
				return nil
			}

			if !p.Exited() {
				continue
			}

			p.Logger().Debug("Restarting plugin")
			if err := p.Start(ctx); err != nil {
				p.Logger().Error("Failed to restart plugin", "error", err)
				continue
			}
			p.Logger().Debug("Plugin restarted")
		}
	}
}

// shutdown stops all backend plugin processes
func (m *PluginManager) shutdown(ctx context.Context) {
	var wg sync.WaitGroup
	for _, p := range m.availablePlugins(ctx) {
		wg.Add(1)
		go func(p backendplugin.Plugin, ctx context.Context) {
			defer wg.Done()
			p.Logger().Debug("Stopping plugin")
			if err := p.Stop(ctx); err != nil {
				p.Logger().Error("Failed to stop plugin", "error", err)
			}
			p.Logger().Debug("Plugin stopped")
		}(p, ctx)
	}
	wg.Wait()
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
