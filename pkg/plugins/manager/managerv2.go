package manager

import (
	"context"
	"os"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/fs"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
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

	plugins map[string]*plugins.PluginV2
}

func (m *PluginManagerV2) InstallPlugin(pluginJSONPath string, opts plugins.InstallOpts) error {
	plugin, err := m.PluginLoader.Load(pluginJSONPath)
	if err != nil {
		return err
	}

	plugin.QueryDataHandler = opts.QueryDataHandler
	plugin.CheckHealthHandler = opts.CheckHealthHandler
	plugin.CallResourceHandler = opts.CallResourceHandler
	plugin.StreamHandler = opts.StreamHandler

	err = m.PluginInitializer.Initialize(plugin)
	if err != nil {
		return err
	}

	m.plugins[plugin.ID] = plugin

	return nil
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

	// install Core plugins
	err = m.installPlugins(m.Cfg.PluginsPath, true)
	if err != nil {
		return err
	}

	return nil
}

func (m *PluginManagerV2) installPlugins(path string, forceCreatePath bool) error {
	exists, err := fs.Exists(path)
	if err != nil {
		return err
	}

	if !exists && forceCreatePath {
		if err = os.MkdirAll(path, os.ModePerm); err != nil {
			pmlog.Error("Failed to create plugins directory", "dir", path, "error", err)
		} else {
			pmlog.Info("Plugins directory created", "directory", path)
		}
	}

	pluginJSONPaths, err := m.PluginFinder.Find(path)
	if err != nil {
		return err
	}

	loadedPlugins, err := m.PluginLoader.LoadAll(pluginJSONPaths)
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

func (m *PluginManagerV2) Run(ctx context.Context) error {
	return nil
}

func (m *PluginManagerV2) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	plugin, exists := m.plugins[req.PluginContext.PluginID]
	if !exists {
		return &backend.QueryDataResponse{}, nil
	}

	return plugin.QueryData(ctx, req)
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
