package repository

import "context"

// Repository is responsible for retrieving plugin information from a repository.
type Repository interface {
	// Download downloads the requested plugin archive.
	Download(ctx context.Context, pluginID, version string) (*PluginArchiveInfo, error)
	// GetDownloadOptions provides information for downloading the requested plugin.
	GetDownloadOptions(ctx context.Context, pluginID, version string) (*PluginDownloadOptions, error)
	// DownloadWithURL downloads the requested plugin from the specified URL.
	DownloadWithURL(ctx context.Context, pluginID, archiveURL string) (*PluginArchiveInfo, error)
}

type Logger interface {
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
