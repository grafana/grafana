package manager

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/fs"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/instrumentation"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/setting"
)

var _ plugins.PluginManagerV2 = (*PluginManagerV2)(nil)

var (
	pmlog = log.New("plugin.manager")
)

type PluginManagerV2 struct {
	Cfg                  *setting.Cfg                `inject:""`
	BackendPluginManager backendplugin.Manager       `inject:""`
	PluginFinder         plugins.PluginFinderV2      `inject:""`
	PluginLoader         plugins.PluginLoaderV2      `inject:""`
	PluginInitializer    plugins.PluginInitializerV2 `inject:""`

	AllowUnsignedPluginsCondition unsignedPluginV2ConditionFunc

	plugins   map[string]*plugins.PluginV2
	pluginsMu sync.RWMutex
}

func init() {
	registry.Register(&registry.Descriptor{
		Name:         "PluginManagerV2",
		Instance:     &PluginManagerV2{},
		InitPriority: registry.MediumHigh,
	})
}

func (m *PluginManagerV2) Init() error {
	m.plugins = map[string]*plugins.PluginV2{}

	// install Core plugins
	//err := m.installPlugins(filepath.Join(m.Cfg.StaticRootPath, "app/plugins"), false)
	//if err != nil {
	//	return err
	//}

	// install Bundled plugins
	err := m.installPlugins(m.Cfg.BundledPluginsPath, false)
	if err != nil {
		return err
	}

	// install External plugins
	externalPluginsDir := m.Cfg.PluginsPath
	exists, err := fs.Exists(externalPluginsDir)
	if err != nil {
		return err
	}

	if !exists {
		if err = os.MkdirAll(m.Cfg.PluginsPath, os.ModePerm); err != nil {
			pmlog.Error("Failed to create plugins directory", "dir", externalPluginsDir, "error", err)
		}
	}
	err = m.installPlugins(m.Cfg.PluginsPath, true)
	if err != nil {
		return err
	}

	return nil
}

func (m *PluginManagerV2) Run(ctx context.Context) error {
	m.start(ctx)
	<-ctx.Done()
	m.stop(ctx)
	return ctx.Err()
}

// start starts all managed backend plugins
func (m *PluginManagerV2) start(ctx context.Context) {
	m.pluginsMu.RLock()
	defer m.pluginsMu.RUnlock()
	for _, p := range m.plugins {
		if !p.IsManaged() || p.IsCorePlugin {
			continue
		}

		if err := startPluginAndRestartKilledProcesses(ctx, p); err != nil {
			p.Logger().Error("Failed to start plugin", "error", err)
			continue
		}
	}
}

func (m *PluginManagerV2) stop(ctx context.Context) {
	m.pluginsMu.RLock()
	defer m.pluginsMu.RUnlock()
	var wg sync.WaitGroup
	for _, p := range m.plugins {
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

func startPluginAndRestartKilledProcesses(ctx context.Context, p *plugins.PluginV2) error {
	if err := p.Start(ctx); err != nil {
		return err
	}

	go func(ctx context.Context, p *plugins.PluginV2) {
		if err := restartKilledProcess(ctx, p); err != nil {
			p.Logger().Error("Attempt to restart killed plugin process failed", "error", err)
		}
	}(ctx, p)

	return nil
}

func restartKilledProcess(ctx context.Context, p *plugins.PluginV2) error {
	ticker := time.NewTicker(time.Second * 1)

	for {
		select {
		case <-ctx.Done():
			if err := ctx.Err(); err != nil && !errors.Is(err, context.Canceled) {
				return err
			}
			return nil
		case <-ticker.C:
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

func (m *PluginManagerV2) InstallCorePlugin(pluginJSONPath string, opts plugins.InstallOpts) error {
	fullPath := filepath.Join(m.Cfg.StaticRootPath, "app/plugins", pluginJSONPath)

	plugin, err := m.PluginLoader.Load(fullPath, PluginSignatureValidator{
		cfg:                           m.Cfg,
		log:                           pmlog,
		requireSigned:                 false,
		allowUnsignedPluginsCondition: m.AllowUnsignedPluginsCondition,
	})
	if err != nil {
		return err
	}

	plugin.Client = opts

	err = m.PluginInitializer.Initialize(plugin)
	if err != nil {
		return err
	}

	m.plugins[plugin.ID] = plugin

	return nil
}

func (m *PluginManagerV2) installPlugins(path string, requireSigning bool) error {
	exists, err := fs.Exists(path)
	if err != nil {
		return err
	}

	if !exists {
		return fmt.Errorf("aborting install as plugins directory %s does not exist", path)
	}

	pluginJSONPaths, err := m.PluginFinder.Find(path)
	if err != nil {
		return err
	}

	loadedPlugins, err := m.PluginLoader.LoadAll(pluginJSONPaths, PluginSignatureValidator{
		cfg:                           m.Cfg,
		log:                           pmlog,
		requireSigned:                 requireSigning,
		allowUnsignedPluginsCondition: m.AllowUnsignedPluginsCondition,
	})
	if err != nil {
		return err
	}

	for _, p := range loadedPlugins {
		pmlog.Info("Loaded plugin", "pluginID", p.ID)

		err = m.PluginInitializer.Initialize(p)
		if err != nil {
			return err
		}
		m.plugins[p.ID] = p
	}

	return nil
}

func (m *PluginManagerV2) IsDisabled() bool {
	_, exists := m.Cfg.FeatureToggles["pluginManagerV2"]
	return !exists
}

func (m *PluginManagerV2) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	plugin, exists := m.plugins[req.PluginContext.PluginID]
	if !exists {
		return &backend.QueryDataResponse{}, nil
	}

	var resp *backend.QueryDataResponse
	err := instrumentation.InstrumentQueryDataRequest(req.PluginContext.PluginID, func() (innerErr error) {
		resp, innerErr = plugin.QueryData(ctx, req)
		return
	})

	return resp, err
}

func (m *PluginManagerV2) Reload() {
}

func (m *PluginManagerV2) StartPlugin(ctx context.Context, pluginID string) error {
	return nil
}

func (m *PluginManagerV2) StopPlugin(ctx context.Context, pluginID string) error {
	return nil
}

func (m *PluginManagerV2) DataSource(pluginID string) {

}

func (m *PluginManagerV2) Panel(pluginID string) {

}

func (m *PluginManagerV2) App(pluginID string) {

}

func (m *PluginManagerV2) Renderer() {

}

func (m *PluginManagerV2) DataSources() {

}

func (m *PluginManagerV2) Apps() {

}

func (m *PluginManagerV2) Errors(pluginID string) {
	//m.PluginLoader.errors
}

func (m *PluginManagerV2) CallResource(pluginConfig backend.PluginContext, ctx *models.ReqContext, path string) {

}

func (m *PluginManagerV2) CollectMetrics(ctx context.Context, pluginID string) (*backend.CollectMetricsResult, error) {
	return &backend.CollectMetricsResult{}, nil
}

func (m *PluginManagerV2) CheckHealth(ctx context.Context, pCtx backend.PluginContext) (*backend.CheckHealthResult, error) {
	return &backend.CheckHealthResult{}, nil
}

func (m *PluginManagerV2) Register(p *plugins.PluginV2) error {
	m.plugins[p.ID] = p

	return nil
}

func (m *PluginManagerV2) IsEnabled() bool {
	return !m.IsDisabled()
}

func (m *PluginManagerV2) IsSupported(pluginID string) bool {
	for pID := range m.plugins {
		if pID == pluginID {
			return true
		}
	}
	return false
}

// WHAT PLUGIN CAN ALREADY START FOLLOWING THIS FLOW
// IE CAN WE PIECE A POC TOGETHER SO THAT WE HAVE AT
// LEAST ONE PLUGIN THAT

// WHAT PLUGIN IS NOT DOING ANY SORT OF TSDB STUFF? CloudWatch + TestData
// WHAT ABOUT EXTERNAL? GITHUB-DATASOURCE?

// IS IT EASIER TO CAPTURE ALLOWLIST THAN DISALLOWLIST? IE ONES THAT WE KNOW ARE NOT CONVERTED?
