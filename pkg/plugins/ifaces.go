package plugins

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
)

// Store is the storage for plugins.
type Store interface {
	// Plugin finds a plugin by its ID.
	Plugin(pluginID string) *Plugin
	// Plugins returns plugins by their requested type.
	Plugins(pluginTypes ...Type) []*Plugin

	// Add adds a plugin to the store.
	Add(ctx context.Context, pluginID, version string, opts AddOpts) error
	// Remove removes a plugin from the store.
	Remove(ctx context.Context, pluginID string) error
}

type AddOpts struct {
	PluginInstallDir, PluginZipURL, PluginRepoURL string
}

// Loader is responsible for loading plugins from the file system.
type Loader interface {
	// Load will return a list of plugins found in the provided file system paths.
	Load(paths []string, ignore map[string]struct{}) ([]*Plugin, error)
	// LoadWithFactory will return a plugin found in the provided file system path and use the provided factory to
	// construct the plugin backend client.
	LoadWithFactory(path string, factory backendplugin.PluginFactoryFunc) (*Plugin, error)
}

// Installer is responsible for managing plugins (add / remove) on the file system.
type Installer interface {
	// Install downloads the requested plugin in the provided file system location.
	Install(ctx context.Context, pluginID, version, pluginsDir, pluginZipURL, pluginRepoURL string) error
	// Uninstall removes the requested plugin from the provided file system location.
	Uninstall(ctx context.Context, pluginDir string) error
	// GetUpdateInfo provides update information for the requested plugin.
	GetUpdateInfo(ctx context.Context, pluginID, version, pluginRepoURL string) (UpdateInfo, error)
}

type UpdateInfo struct {
	PluginZipURL string
}

// Client is used to communicate with backend plugin implementations.
type Client interface {
	backend.QueryDataHandler
	backend.CheckHealthHandler

	// CallResource calls a plugin resource.
	CallResource(pCtx backend.PluginContext, ctx *models.ReqContext, path string)
	// CollectMetrics collects metrics from a plugin.
	CollectMetrics(ctx context.Context, pluginID string) (*backend.CollectMetricsResult, error)
}

type RendererManager interface {
	// Renderer returns a renderer plugin.
	Renderer() *Plugin
}

type CoreBackendRegistrar interface {
	// LoadAndRegister loads and registers a Core backend plugin
	LoadAndRegister(pluginID string, factory backendplugin.PluginFactoryFunc) error
}

type StaticRouteResolver interface {
	Routes() []*StaticRoute
}

type ErrorResolver interface {
	PluginErrors() []*Error
}

type PluginLoaderAuthorizer interface {
	// CanLoadPlugin confirms if a plugin is authorized to load
	CanLoadPlugin(plugin *Plugin) bool
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
