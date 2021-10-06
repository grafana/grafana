package plugins

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
)

// DataRequestHandler is a data request handler interface.
type DataRequestHandler interface {
	// HandleRequest handles a data request.
	HandleRequest(context.Context, *models.DataSource, DataQuery) (DataResponse, error)
}

type Store interface {
	// Plugin finds a plugin by its ID.
	Plugin(pluginID string) *Plugin
	// Plugins returns plugins by their requested type.
	Plugins(pluginTypes ...Type) []*Plugin

	// Install installs a plugin.
	Install(ctx context.Context, pluginID, version string, opts InstallOpts) error
	// Uninstall uninstalls a plugin.
	Uninstall(ctx context.Context, pluginID string) error
}

type InstallOpts struct {
	InstallDir, PluginZipURL, PluginRepoURL string
}

type Client interface {
	// QueryData queries data from a plugin.
	QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error)
	// CallResource calls a plugin resource.
	CallResource(pCtx backend.PluginContext, ctx *models.ReqContext, path string)
	// CollectMetrics collects metrics from a plugin.
	CollectMetrics(ctx context.Context, pluginID string) (*backend.CollectMetricsResult, error)
	// CheckHealth performs a health check on a plugin.
	CheckHealth(ctx context.Context, pCtx backend.PluginContext) (*backend.CheckHealthResult, error)
}

type RendererManager interface {
	// Renderer returns a renderer plugin.
	Renderer() *Plugin
}

type CoreBackendRegistrar interface {
	//LoadAndRegister loads and registers a Core backend plugin
	LoadAndRegister(pluginID string, factory backendplugin.PluginFactoryFunc) error
}

type StaticRouteResolver interface {
	Routes() []*PluginStaticRoute
}

type PluginDashboardManager interface {
	// GetPluginDashboards gets dashboards for a certain org/plugin.
	GetPluginDashboards(orgID int64, pluginID string) ([]*PluginDashboardInfoDTO, error)
	// LoadPluginDashboard loads a plugin dashboard.
	LoadPluginDashboard(pluginID, path string) (*models.Dashboard, error)
	// ImportDashboard imports a dashboard.
	ImportDashboard(pluginID, path string, orgID, folderID int64, dashboardModel *simplejson.Json,
		overwrite bool, inputs []ImportDashboardInput, user *models.SignedInUser) (PluginDashboardInfoDTO,
		*models.Dashboard, error)
}

type ImportDashboardInput struct {
	Type     string `json:"type"`
	PluginId string `json:"pluginId"`
	Name     string `json:"name"`
	Value    string `json:"value"`
}
