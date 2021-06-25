package plugins

import (
	"context"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
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
