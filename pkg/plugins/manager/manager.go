package manager

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"path/filepath"
	"sync"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/instrumentation"
	"github.com/grafana/grafana/pkg/plugins/manager/installer"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"
)

const (
	grafanaComURL = "https://grafana.com/api/plugins"
)

var _ plugins.Client = (*PluginManager)(nil)
var _ plugins.Store = (*PluginManager)(nil)
var _ plugins.PluginDashboardManager = (*PluginManager)(nil)
var _ plugins.StaticRouteResolver = (*PluginManager)(nil)
var _ plugins.RendererManager = (*PluginManager)(nil)

type PluginManager struct {
	cfg              *plugins.Cfg
	requestValidator models.PluginRequestValidator
	sqlStore         *sqlstore.SQLStore
	store            map[string]*plugins.Plugin
	pluginInstaller  plugins.Installer
	pluginLoader     plugins.Loader
	pluginsMu        sync.RWMutex
	pluginPaths      map[plugins.Class][]string
	log              log.Logger
}

func ProvideService(grafanaCfg *setting.Cfg, requestValidator models.PluginRequestValidator, pluginLoader plugins.Loader,
	sqlStore *sqlstore.SQLStore) (*PluginManager, error) {
	pm := New(plugins.FromGrafanaCfg(grafanaCfg), requestValidator, map[plugins.Class][]string{
		plugins.Core:     corePluginPaths(grafanaCfg),
		plugins.Bundled:  {grafanaCfg.BundledPluginsPath},
		plugins.External: append([]string{grafanaCfg.PluginsPath}, pluginSettingPaths(grafanaCfg)...),
	}, pluginLoader, sqlStore)
	if err := pm.Init(); err != nil {
		return nil, err
	}
	return pm, nil
}

func New(cfg *plugins.Cfg, requestValidator models.PluginRequestValidator, pluginPaths map[plugins.Class][]string,
	pluginLoader plugins.Loader, sqlStore *sqlstore.SQLStore) *PluginManager {
	return &PluginManager{
		cfg:              cfg,
		requestValidator: requestValidator,
		pluginLoader:     pluginLoader,
		pluginPaths:      pluginPaths,
		store:            make(map[string]*plugins.Plugin),
		log:              log.New("plugin.manager"),
		pluginInstaller:  installer.New(false, cfg.BuildVersion, newInstallerLogger("plugin.installer", true)),
		sqlStore:         sqlStore,
	}
}

func (m *PluginManager) Init() error {
	for class, paths := range m.pluginPaths {
		err := m.loadPlugins(context.Background(), class, paths...)
		if err != nil {
			return err
		}
	}

	return nil
}

func (m *PluginManager) Run(ctx context.Context) error {
	if m.cfg.CheckForUpdates {
		go func() {
			m.checkForUpdates(ctx)

			ticker := time.NewTicker(time.Minute * 10)
			run := true

			for run {
				select {
				case <-ticker.C:
					m.checkForUpdates(ctx)
				case <-ctx.Done():
					run = false
				}
			}
		}()
	}

	<-ctx.Done()
	m.shutdown(ctx)
	return ctx.Err()
}

func (m *PluginManager) plugin(pluginID string) (*plugins.Plugin, bool) {
	m.pluginsMu.RLock()
	defer m.pluginsMu.RUnlock()
	p, exists := m.store[pluginID]

	if !exists || (p.IsDecommissioned()) {
		return nil, false
	}

	return p, true
}

func (m *PluginManager) plugins() []*plugins.Plugin {
	m.pluginsMu.RLock()
	defer m.pluginsMu.RUnlock()

	res := make([]*plugins.Plugin, 0)
	for _, p := range m.store {
		if !p.IsDecommissioned() {
			res = append(res, p)
		}
	}

	return res
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

	loadedPlugins, err := m.pluginLoader.Load(ctx, class, pluginPaths, m.registeredPlugins())
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

func (m *PluginManager) registeredPlugins() map[string]struct{} {
	pluginsByID := make(map[string]struct{})
	for _, p := range m.plugins() {
		pluginsByID[p.ID] = struct{}{}
	}

	return pluginsByID
}

func (m *PluginManager) Renderer() *plugins.Plugin {
	for _, p := range m.plugins() {
		if p.IsRenderer() {
			return p
		}
	}

	return nil
}

func (m *PluginManager) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	plugin, exists := m.plugin(req.PluginContext.PluginID)
	if !exists {
		return nil, backendplugin.ErrPluginNotRegistered
	}

	var resp *backend.QueryDataResponse
	err := instrumentation.InstrumentQueryDataRequest(req.PluginContext.PluginID, func() (innerErr error) {
		resp, innerErr = plugin.QueryData(ctx, req)
		return
	})

	if err != nil {
		if errors.Is(err, backendplugin.ErrMethodNotImplemented) {
			return nil, err
		}

		if errors.Is(err, backendplugin.ErrPluginUnavailable) {
			return nil, err
		}

		return nil, errutil.Wrap("failed to query data", err)
	}

	for refID, res := range resp.Responses {
		// set frame ref ID based on response ref ID
		for _, f := range res.Frames {
			if f.RefID == "" {
				f.RefID = refID
			}
		}
	}

	return resp, err
}

func (m *PluginManager) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	p, exists := m.plugin(req.PluginContext.PluginID)
	if !exists {
		return backendplugin.ErrPluginNotRegistered
	}

	err := instrumentation.InstrumentCallResourceRequest(p.PluginID(), func() error {
		if err := p.CallResource(ctx, req, sender); err != nil {
			return err
		}
		return nil
	})

	if err != nil {
		return err
	}

	return nil
}

func (m *PluginManager) CollectMetrics(ctx context.Context, pluginID string) (*backend.CollectMetricsResult, error) {
	p, exists := m.plugin(pluginID)
	if !exists {
		return nil, backendplugin.ErrPluginNotRegistered
	}

	var resp *backend.CollectMetricsResult
	err := instrumentation.InstrumentCollectMetrics(p.PluginID(), func() (innerErr error) {
		resp, innerErr = p.CollectMetrics(ctx)
		return
	})
	if err != nil {
		return nil, err
	}

	return resp, nil
}

func (m *PluginManager) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	var dsURL string
	if req.PluginContext.DataSourceInstanceSettings != nil {
		dsURL = req.PluginContext.DataSourceInstanceSettings.URL
	}

	err := m.requestValidator.Validate(dsURL, nil)
	if err != nil {
		return &backend.CheckHealthResult{
			Status:  http.StatusForbidden,
			Message: "Access denied",
		}, nil
	}

	p, exists := m.plugin(req.PluginContext.PluginID)
	if !exists {
		return nil, backendplugin.ErrPluginNotRegistered
	}

	var resp *backend.CheckHealthResult
	err = instrumentation.InstrumentCheckHealthRequest(p.PluginID(), func() (innerErr error) {
		resp, innerErr = p.CheckHealth(ctx, &backend.CheckHealthRequest{PluginContext: req.PluginContext})
		return
	})

	if err != nil {
		if errors.Is(err, backendplugin.ErrMethodNotImplemented) {
			return nil, err
		}

		if errors.Is(err, backendplugin.ErrPluginUnavailable) {
			return nil, err
		}

		return nil, errutil.Wrap("failed to check plugin health", backendplugin.ErrHealthCheckFailed)
	}

	return resp, nil
}

func (m *PluginManager) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	plugin, exists := m.plugin(req.PluginContext.PluginID)
	if !exists {
		return nil, backendplugin.ErrPluginNotRegistered
	}

	return plugin.SubscribeStream(ctx, req)
}

func (m *PluginManager) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	plugin, exists := m.plugin(req.PluginContext.PluginID)
	if !exists {
		return nil, backendplugin.ErrPluginNotRegistered
	}

	return plugin.PublishStream(ctx, req)
}

func (m *PluginManager) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	plugin, exists := m.plugin(req.PluginContext.PluginID)
	if !exists {
		return backendplugin.ErrPluginNotRegistered
	}

	return plugin.RunStream(ctx, req, sender)
}

func (m *PluginManager) isRegistered(pluginID string) bool {
	p, exists := m.plugin(pluginID)
	if !exists {
		return false
	}

	return !p.IsDecommissioned()
}

func (m *PluginManager) Routes() []*plugins.StaticRoute {
	staticRoutes := make([]*plugins.StaticRoute, 0)

	for _, p := range m.plugins() {
		if p.StaticRoute() != nil {
			staticRoutes = append(staticRoutes, p.StaticRoute())
		}
	}
	return staticRoutes
}

func (m *PluginManager) registerAndStart(ctx context.Context, plugin *plugins.Plugin) error {
	err := m.register(plugin)
	if err != nil {
		return err
	}

	if !m.isRegistered(plugin.ID) {
		return fmt.Errorf("plugin %s is not registered", plugin.ID)
	}

	return m.start(ctx, plugin)
}

func (m *PluginManager) register(p *plugins.Plugin) error {
	if m.isRegistered(p.ID) {
		return fmt.Errorf("plugin %s is already registered", p.ID)
	}

	m.pluginsMu.Lock()
	m.store[p.ID] = p
	m.pluginsMu.Unlock()

	if !p.IsCorePlugin() {
		m.log.Info("Plugin registered", "pluginId", p.ID)
	}

	return nil
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

	delete(m.store, p.ID)

	m.log.Debug("Plugin unregistered", "pluginId", p.ID)
	return nil
}

// start starts a backend plugin process
func (m *PluginManager) start(ctx context.Context, p *plugins.Plugin) error {
	if !p.IsManaged() || !p.Backend || p.SignatureError != nil {
		return nil
	}

	if !m.isRegistered(p.ID) {
		return backendplugin.ErrPluginNotRegistered
	}

	if err := startPluginAndRestartKilledProcesses(ctx, p); err != nil {
		return err
	}

	if !p.IsCorePlugin() {
		p.Logger().Debug("Successfully started backend plugin process")
	}

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
	for _, p := range m.plugins() {
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
	datasourcePaths := []string{
		filepath.Join(cfg.StaticRootPath, "app/plugins/datasource/alertmanager"),
		filepath.Join(cfg.StaticRootPath, "app/plugins/datasource/dashboard"),
		filepath.Join(cfg.StaticRootPath, "app/plugins/datasource/jaeger"),
		filepath.Join(cfg.StaticRootPath, "app/plugins/datasource/mixed"),
		filepath.Join(cfg.StaticRootPath, "app/plugins/datasource/zipkin"),
	}

	panelsPath := filepath.Join(cfg.StaticRootPath, "app/plugins/panel")

	return append(datasourcePaths, panelsPath)
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
