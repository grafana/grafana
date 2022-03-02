package repository

import "context"

// Service is responsible for retrieving plugin information from a repository.
type Service interface {
	// GetPluginArchive fetches the requested plugin archive.
	GetPluginArchive(ctx context.Context, pluginID, version string, opts CompatabilityOpts) (*PluginArchive, error)
	// GetPluginArchiveByURL fetches the requested plugin from the specified URL.
	GetPluginArchiveByURL(ctx context.Context, archiveURL string, opts CompatabilityOpts) (*PluginArchive, error)
	// GetPluginDownloadOptions fetches information for downloading the requested plugin.
	GetPluginDownloadOptions(ctx context.Context, pluginID, version string, opts CompatabilityOpts) (*PluginDownloadOptions, error)
}

type CompatabilityOpts struct {
	GrafanaVersion string
}
