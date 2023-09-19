package plugins

import "github.com/grafana/grafana/pkg/util/errutil"

var (
	errPluginNotRegisteredBase = errutil.NotFound("plugin.notRegistered")
	// ErrPluginNotRegistered error returned when a plugin is not registered.
	ErrPluginNotRegistered = errPluginNotRegisteredBase.Errorf("%w", errPluginNotRegisteredBase)

	errPluginUnavailableBase = errutil.Internal("plugin.unavailable")
	// ErrPluginUnavailable error returned when a plugin is unavailable.
	ErrPluginUnavailable = errPluginUnavailableBase.Errorf("%w", errPluginUnavailableBase)

	errMethodNotImplementedBase = errutil.NotFound("plugin.notImplemented",
		errutil.WithPublicMessage("Not implemented"))
	// ErrMethodNotImplemented error returned when a plugin method is not implemented.
	ErrMethodNotImplemented = errMethodNotImplementedBase.Errorf("%w", errMethodNotImplementedBase)

	// ErrPluginDownstreamError error returned when a plugin request fails.
	// Exposed as a base error to wrap it with plugin downstream errors.
	ErrPluginDownstreamErrorBase = errutil.Internal("plugin.downstreamError",
		errutil.WithPublicMessage("An error occurred within the plugin"),
		errutil.WithDownstream())
)
