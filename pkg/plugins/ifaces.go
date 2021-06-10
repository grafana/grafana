package plugins

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
)

// Manager is the plugin manager service interface.
type Manager interface {
	// Renderer gets the renderer plugin.
	Renderer() *RendererPlugin
	// GetDataSource gets a data source plugin with a certain ID.
	GetDataSource(id string) *DataSourcePlugin
	// GetPlugin gets a plugin with a certain ID.
	GetPlugin(id string) *PluginBase
	// GetApp gets an app plugin with a certain ID.
	GetApp(id string) *AppPlugin
	// DataSourceCount gets the number of data sources.
	DataSourceCount() int
	// DataSources gets all data sources.
	DataSources() []*DataSourcePlugin
	// Apps gets all app plugins.
	Apps() []*AppPlugin
	// PanelCount gets the number of panels.
	PanelCount() int
	// AppCount gets the number of apps.
	AppCount() int
	// GetEnabledPlugins gets enabled plugins.
	// GetEnabledPlugins gets enabled plugins.
	GetEnabledPlugins(orgID int64) (*EnabledPlugins, error)
	// GrafanaLatestVersion gets the latest Grafana version.
	GrafanaLatestVersion() string
	// GrafanaHasUpdate returns whether Grafana has an update.
	GrafanaHasUpdate() bool
	// Plugins gets all plugins.
	Plugins() []*PluginBase
	// StaticRoutes gets all static routes.
	StaticRoutes() []*PluginStaticRoute
	// GetPluginSettings gets settings for a certain plugin.
	GetPluginSettings(orgID int64) (map[string]*models.PluginSettingInfoDTO, error)
	// GetPluginDashboards gets dashboards for a certain org/plugin.
	GetPluginDashboards(orgID int64, pluginID string) ([]*PluginDashboardInfoDTO, error)
	// GetPluginMarkdown gets markdown for a certain plugin/name.
	GetPluginMarkdown(pluginID string, name string) ([]byte, error)
	// ImportDashboard imports a dashboard.
	ImportDashboard(pluginID, path string, orgID, folderID int64, dashboardModel *simplejson.Json,
		overwrite bool, inputs []ImportDashboardInput, user *models.SignedInUser,
		requestHandler DataRequestHandler) (PluginDashboardInfoDTO, *models.Dashboard, error)
	// ScanningErrors returns plugin scanning errors encountered.
	ScanningErrors() []PluginError
	// LoadPluginDashboard loads a plugin dashboard.
	LoadPluginDashboard(pluginID, path string) (*models.Dashboard, error)
	// IsAppInstalled returns whether an app is installed.
	IsAppInstalled(id string) bool
	// Install installs a plugin.
	Install(ctx context.Context, pluginID, version string) error
	// Uninstall uninstalls a plugin.
	Uninstall(ctx context.Context, pluginID string) error
}

type ImportDashboardInput struct {
	Type     string `json:"type"`
	PluginId string `json:"pluginId"`
	Name     string `json:"name"`
	Value    string `json:"value"`
}

// DataRequestHandler is a data request handler interface.
type DataRequestHandler interface {
	// HandleRequest handles a data request.
	HandleRequest(context.Context, *models.DataSource, DataQuery) (DataResponse, error)
}

type PluginInstaller interface {
	// Install finds the plugin given the provided information
	// and installs in the provided plugins directory.
	Install(ctx context.Context, pluginID, version, pluginsDirectory, pluginZipURL, pluginRepoURL string) error
	// Uninstall removes the specified plugin from the provided plugins directory.
	Uninstall(ctx context.Context, pluginID, pluginPath string) error
}

type PluginInstallerLogger interface {
	Successf(format string, args ...interface{})
	Failuref(format string, args ...interface{})

	Info(args ...interface{})
	Infof(format string, args ...interface{})
	Debug(args ...interface{})
	Debugf(format string, args ...interface{})
	Warn(args ...interface{})
	Warnf(format string, args ...interface{})
	Error(args ...interface{})
	Errorf(format string, args ...interface{})
}

type PluginFinderV2 interface {
	// Find tries to discover all plugin.json in the provided directory and then returns their file-system paths.
	Find(string) ([]string, error)
}

type PluginLoaderV2 interface {
	// LoadAll loads a list plugins and returns them.
	LoadAll(pluginJSONPaths []string, requireSigned bool) ([]*PluginV2, error)

	// Load loads a plugin and returns it.
	Load(pluginJSONPath string, requireSigned bool) (*PluginV2, error)
}

type PluginInitializerV2 interface {
	// Initialize initializes a plugin.
	Initialize(plugin *PluginV2) error
}

type PluginManagerV2 interface {
	// Fetch plugin info
	DataSource(pluginID string)
	Panel(pluginID string)
	App(pluginID string)
	Renderer() *PluginV2

	Plugins()
	DataSources()
	Apps()

	StaticRoutes() []*PluginStaticRoute

	// Plugin error metadata
	Errors(pluginID string)

	// Fetch plugin data
	QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error)
	CallResource(pluginConfig backend.PluginContext, ctx *models.ReqContext, path string)
	CollectMetrics(ctx context.Context, pluginID string) (*backend.CollectMetricsResult, error)
	CheckHealth(ctx context.Context, pCtx backend.PluginContext) (*backend.CheckHealthResult, error)
	// StreamingHandler

	IsSupported(pluginID string) bool
	IsEnabled() bool

	Register(*PluginV2) error
	// IsRegistered checks if a plugin is registered with the manager
	IsRegistered(pluginID string) bool
	// RegisterCorePlugin registers and starts a core plugin
	RegisterCorePlugin(ctx context.Context, pluginJSONPath string, factory backendplugin.PluginFactoryFunc) error

	// Install installs a plugin.
	Install(ctx context.Context, pluginID, version string) error
	// Uninstall uninstalls a plugin.
	Uninstall(ctx context.Context, pluginID string) error
}
