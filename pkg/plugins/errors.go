package plugins

import "github.com/grafana/grafana/pkg/util/errutil"

var (
	errPluginNotRegisteredBase = errutil.NotFound("plugin.notRegistered",
		errutil.WithPublicMessage("Plugin not registered"))
	// ErrPluginNotRegistered error returned when a plugin is not registered.
	ErrPluginNotRegistered = errPluginNotRegisteredBase.Errorf("plugin not registered")

	errPluginUnavailableBase = errutil.Internal("plugin.unavailable",
		errutil.WithPublicMessage("Plugin unavailable"))
	// ErrPluginUnavailable error returned when a plugin is unavailable.
	ErrPluginUnavailable = errPluginUnavailableBase.Errorf("plugin unavailable")

	errMethodNotImplementedBase = errutil.NotFound("plugin.notImplemented",
		errutil.WithPublicMessage("Method not implemented"))
	// ErrMethodNotImplemented error returned when a plugin method is not implemented.
	ErrMethodNotImplemented = errMethodNotImplementedBase.Errorf("method not implemented")

	// ErrPluginDownstreamError error returned when a plugin request fails.
	// Exposed as a base error to wrap it with plugin downstream errors.
	ErrPluginDownstreamErrorBase = errutil.Internal("plugin.downstreamError",
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
