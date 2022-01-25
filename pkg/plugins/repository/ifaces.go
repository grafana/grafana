package repository

import "context"

// Repository is responsible for retrieving plugin information from a repository.
type Repository interface {
	// Download downloads the requested plugin archive.
	Download(ctx context.Context, pluginID, version string, opts CompatabilityOpts) (*PluginArchiveInfo, error)
	// DownloadWithURL downloads the requested plugin from the specified URL.
	DownloadWithURL(ctx context.Context, archiveURL string, opts CompatabilityOpts) (*PluginArchiveInfo, error)
	// GetDownloadOptions provides information for downloading the requested plugin.
	GetDownloadOptions(ctx context.Context, pluginID, version string, opts CompatabilityOpts) (*PluginDownloadOptions, error)
}

type CompatabilityOpts struct {
	GrafanaVersion string
}
