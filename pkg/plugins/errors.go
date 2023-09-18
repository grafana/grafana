package plugins

import "github.com/grafana/grafana/pkg/util/errutil"

var (
	// ErrPluginNotRegistered error returned when a plugin is not registered.
	ErrPluginNotRegistered = errutil.NotFound("plugin.notRegistered",
		errutil.WithPublicMessage("Plugin not found"))
	// ErrHealthCheckFailed error returned when a plugin health check failed.
	ErrHealthCheckFailed = errutil.Internal("plugin.failedHealthCheck")
	// ErrPluginUnavailable error returned when a plugin is unavailable.
	ErrPluginUnavailable = errutil.Internal("plugin.unavailable")
	// ErrMethodNotImplemented error returned when a plugin method is not implemented.
	ErrMethodNotImplemented = errutil.NotImplemented("plugin.notImplemented")
	// ErrPluginDownstreamError error returned when a plugin request fails.
	ErrPluginDownstreamError = errutil.Internal("plugin.downstreamError",
		errutil.WithPublicMessage("An error occurred within the plugin"),
		errutil.WithDownstream())
	// ErrInstallCorePlugin error returned when trying to install a core plugin.
	ErrInstallCorePlugin = errutil.Forbidden("plugin.installCorePlugin",
		errutil.WithPublicMessage("Cannot install a Core plugin"))
	// ErrUninstallCorePlugin error returned when trying to uninstall a core plugin.
	ErrUninstallCorePlugin = errutil.Forbidden("plugin.uninstallCorePlugin",
		errutil.WithPublicMessage("Cannot uninstall a Core plugin"))
	// ErrFileNotExist error returned when a file does not exist.
	ErrFileNotExist = errutil.NotFound("plugin.fileNotFound",
		errutil.WithPublicMessage("File does not exist"))
	// ErrPluginFileRead error returned when a file could not be read.
	ErrPluginFileRead = errutil.Internal("plugin.fileReadError",
		errutil.WithPublicMessage("File could not be read"))
)
