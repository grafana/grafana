package installer

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
)

// Service is responsible for managing plugins (add / remove) on the file system.
type Service interface {
	// Install downloads the requested plugin in the provided file system location.
	Install(ctx context.Context, pluginID, version, pluginsDir, pluginZipURL, pluginRepoURL string) error
	// Uninstall removes the requested plugin from the provided file system location.
	Uninstall(ctx context.Context, pluginDir string) error
	// GetUpdateInfo provides update information for the requested plugin.
	GetUpdateInfo(ctx context.Context, pluginID, version, pluginRepoURL string) (plugins.UpdateInfo, error)
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
