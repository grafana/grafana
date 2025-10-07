package reconcilers

import (
	"context"
)

// PluginInstaller defines the interface for installing and removing plugins
type PluginInstaller interface {
	// Add adds a new plugin with the specified ID and version
	Add(ctx context.Context, pluginID, version string, opts AddOpts) error
	// Remove removes an existing plugin
	Remove(ctx context.Context, pluginID, version string) error
}

// PluginRegistry defines the interface for querying installed plugins
type PluginRegistry interface {
	// Plugin finds a plugin by its ID and version
	// Returns the plugin info and true if found, or empty info and false if not found
	Plugin(ctx context.Context, id, version string) (PluginInfo, bool)
}

// PluginInfo holds minimal information about a plugin
type PluginInfo struct {
	// Version is the installed version of the plugin
	Version string
	// Class is the plugin class (e.g., "external", "core", "bundled")
	Class string
}

// AddOpts holds options for adding a plugin
type AddOpts struct {
	// GrafanaVersion is the Grafana version to install plugins for
	GrafanaVersion string
	// OS is the operating system (e.g., "linux", "darwin", "windows")
	OS string
	// Arch is the architecture (e.g., "amd64", "arm64")
	Arch string
	// URL is an optional URL to download the plugin from (for URL-based installs)
	URL string
}

// NewAddOpts creates a new AddOpts with the specified parameters
func NewAddOpts(grafanaVersion, os, arch, url string) AddOpts {
	return AddOpts{
		GrafanaVersion: grafanaVersion,
		OS:             os,
		Arch:           arch,
		URL:            url,
	}
}
