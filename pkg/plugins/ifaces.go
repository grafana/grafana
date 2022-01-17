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
	Plugin(ctx context.Context, pluginID string) (PluginDTO, bool)
	// Plugins returns plugins by their requested type.
	Plugins(ctx context.Context, pluginTypes ...Type) []PluginDTO

	// Add adds a plugin to the store.
	Add(ctx context.Context, pluginID, version string) error
	// AddWithFactory adds a plugin to the store.
	AddWithFactory(ctx context.Context, pluginID string, factory backendplugin.PluginFactoryFunc, resolver PluginPathResolver) error
	// Remove removes a plugin from the store.
	Remove(ctx context.Context, pluginID string) error
}

type PluginPathResolver func() (string, error)

type AddOpts struct {
	PluginInstallDir, PluginZipURL, PluginRepoURL string
}

// Loader is responsible for loading plugins from the file system.
type Loader interface {
	// Load will return a list of plugins found in the provided file system paths.
	Load(ctx context.Context, class Class, paths []string, ignore map[string]struct{}) ([]*Plugin, error)
	// LoadWithFactory will return a plugin found in the provided file system path and use the provided factory to
	// construct the plugin backend client.
	LoadWithFactory(ctx context.Context, class Class, path string, factory backendplugin.PluginFactoryFunc) (*Plugin, error)
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
	backend.StreamHandler
	backend.CallResourceHandler

	// CollectMetrics collects metrics from a plugin.
	CollectMetrics(ctx context.Context, pluginID string) (*backend.CollectMetricsResult, error)
}

// BackendFactoryProvider provides a backend factory for a provided plugin.
type BackendFactoryProvider interface {
	BackendFactory(ctx context.Context, p *Plugin) backendplugin.PluginFactoryFunc
}

type RendererManager interface {
	// Renderer returns a renderer plugin.
	Renderer() *Plugin
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
	GetPluginDashboards(ctx context.Context, orgID int64, pluginID string) ([]*PluginDashboardInfoDTO, error)
	// LoadPluginDashboard loads a plugin dashboard.
	LoadPluginDashboard(ctx context.Context, pluginID, path string) (*models.Dashboard, error)
	// ImportDashboard imports a dashboard.
	ImportDashboard(ctx context.Context, pluginID, path string, orgID, folderID int64, dashboardModel *simplejson.Json,
		overwrite bool, inputs []ImportDashboardInput, user *models.SignedInUser) (PluginDashboardInfoDTO,
		*models.Dashboard, error)
}

type ImportDashboardInput struct {
	Type     string `json:"type"`
	PluginId string `json:"pluginId"`
	Name     string `json:"name"`
	Value    string `json:"value"`
}
