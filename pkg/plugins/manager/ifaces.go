package manager

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
)

// PluginRegistry is responsible for the storing and retrieval of plugins.
type PluginRegistry interface {
	// Plugin finds a plugin by its ID.
	Plugin(ctx context.Context, id string) (*plugins.Plugin, bool)
	// Plugins returns all plugins.
	Plugins(ctx context.Context) []*plugins.Plugin
	// Add adds the provided plugin to the registry.
	Add(ctx context.Context, plugin *plugins.Plugin) error
	// Remove deletes the requested plugin from the registry.
	Remove(ctx context.Context, id string) error
}

// PluginLoader is responsible for loading plugins from the file system.
type PluginLoader interface {
	// Load will return a list of plugins found in the provided file system paths.
	Load(ctx context.Context, class plugins.Class, paths []string, ignore map[string]struct{}) ([]*plugins.Plugin, error)
}

// PluginInstaller is responsible for managing plugins (add / remove) on the file system.
type PluginInstaller interface {
	// Install downloads the requested plugin in the provided file system location.
	Install(ctx context.Context, pluginID, version, pluginsDir, pluginZipURL, pluginRepoURL string) error
	// Uninstall removes the requested plugin from the provided file system location.
	Uninstall(ctx context.Context, pluginDir string) error
	// GetUpdateInfo provides update information for the requested plugin.
	GetUpdateInfo(ctx context.Context, pluginID, version, pluginRepoURL string) (plugins.UpdateInfo, error)
}
