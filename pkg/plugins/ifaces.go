package plugins

import (
	"context"
	"io"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

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
	// Remove removes a plugin from the store.
	Remove(ctx context.Context, pluginID string) error
}

// Loader is responsible for loading plugins from the file system.
type Loader interface {
	// Load will return a list of plugins found in the provided file system paths.
	Load(ctx context.Context, class Class, paths []string, ignore map[string]struct{}) ([]*Plugin, error)
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
	backend.CollectMetricsHandler
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

// ListPluginDashboardFilesArgs list plugin dashboard files argument model.
type ListPluginDashboardFilesArgs struct {
	PluginID string
}

// GetPluginDashboardFilesArgs list plugin dashboard files result model.
type ListPluginDashboardFilesResult struct {
	FileReferences []string
}

// GetPluginDashboardFileContentsArgs get plugin dashboard file content argument model.
type GetPluginDashboardFileContentsArgs struct {
	PluginID      string
	FileReference string
}

// GetPluginDashboardFileContentsResult get plugin dashboard file content result model.
type GetPluginDashboardFileContentsResult struct {
	Content io.ReadCloser
}

// DashboardFileStore is the interface for plugin dashboard file storage.
type DashboardFileStore interface {
	// ListPluginDashboardFiles lists plugin dashboard files.
	ListPluginDashboardFiles(ctx context.Context, args *ListPluginDashboardFilesArgs) (*ListPluginDashboardFilesResult, error)

	// GetPluginDashboardFileContents gets the referenced plugin dashboard file content.
	GetPluginDashboardFileContents(ctx context.Context, args *GetPluginDashboardFileContentsArgs) (*GetPluginDashboardFileContentsResult, error)
}
