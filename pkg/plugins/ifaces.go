package plugins

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
)

// Manager is the plugin manager service interface.
type Manager interface {
	// Renderer gets the renderer plugin.
	Renderer() *RendererPlugin
	// GetDataSource gets a data source plugin with a certain ID.
	GetDataSource(id string) *DataSourcePlugin
	// GetDataPlugin gets a data plugin with a certain ID.
	GetDataPlugin(id string) DataPlugin
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
		requestHandler DataRequestHandler) (PluginDashboardInfoDTO, error)
	// ScanningErrors returns plugin scanning errors encountered.
	ScanningErrors() []PluginError
	// LoadPluginDashboard loads a plugin dashboard.
	LoadPluginDashboard(pluginID, path string) (*models.Dashboard, error)
	// IsAppInstalled returns whether an app is installed.
	IsAppInstalled(id string) bool
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

type PluginFinderV2 interface {
	// Load loads a plugin and returns it.
	Find(string) (interface{}, error)
}

type PluginLoaderV2 interface {
	// Load loads a plugin and returns it.
	Load() (interface{}, error)
}

type PluginInitializerV2 interface {
	// Load loads a plugin and returns it.
	Initialize(plugin PluginV2) (interface{}, error)
}

type PluginManagerV2 interface {
	PluginFinderV2      // find plugins
	PluginLoaderV2      // load plugins
	PluginInitializerV2 // initialize plugins

	Reload() // find, load and initialize dynamically

	// Probably not necessary as loading/initializing will cover this step
	//Register(pluginID string) error
	//Unregister(pluginID string) error

	StartPlugin(ctx context.Context, pluginID string) error
	StopPlugin(ctx context.Context, pluginID string) error

	// Fetch plugin info
	DataSource(pluginID string)
	Panel(pluginID string)
	App(pluginID string)
	Renderer()

	DataSources()
	Apps()

	// Plugin error metadata
	Errors(pluginID string)

	// Fetch plugin data
	//backend.QueryDataHandler
	QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error)
	CallResource(pluginConfig backend.PluginContext, ctx *models.ReqContext, path string)
	CollectMetrics(ctx context.Context, pluginID string) (*backend.CollectMetricsResult, error)
	CheckHealth(ctx context.Context, pCtx backend.PluginContext) (*backend.CheckHealthResult, error)
	// StreamingHandler

	IsSupported(pluginID string) bool
	IsEnabled() bool

	Register(PluginV2) error

	// Plugin dashboards
}

type PluginV2 struct {
	ID string

	// Would be nice that when we retrieve plugins, we will know their capability
	// This will also allow any plugin to have different responsibilities
	backend.QueryDataHandler
	backend.StreamHandler
	backend.CallResourceHandler
	backend.CheckHealthHandler
}

// refer to ID of backend plugin instead of backend:true and executable

// can maintain a map of what’s been migrated fully
