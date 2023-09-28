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

	// ErrPluginHealthCheck error returned when a plugin fails its health check.
	// Exposed as a base error to wrap it with plugin error.
	ErrPluginHealthCheck = errutil.Internal("plugin.healthCheck",
		errutil.WithPublicMessage("Plugin health check failed"),
		errutil.WithDownstream())

	// ErrPluginDownstreamError error returned when a plugin request fails.
	// Exposed as a base error to wrap it with plugin downstream errors.
	ErrPluginDownstreamErrorBase = errutil.Internal("plugin.downstreamError",
		errutil.WithPublicMessage("An error occurred within the plugin"),
		errutil.WithDownstream())
)
