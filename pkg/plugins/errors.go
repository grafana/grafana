package plugins

import "github.com/grafana/grafana/pkg/util/errutil"

var (
	// ErrPluginNotRegistered error returned when a plugin is not registered.
	ErrPluginNotRegistered = errutil.NotFound("plugin.notRegistered")
	// ErrHealthCheckFailed error returned when a plugin health check failed.
	ErrHealthCheckFailed = errutil.Internal("plugin.failedHealthCheck")
	// ErrPluginUnavailable error returned when a plugin is unavailable.
	ErrPluginUnavailable = errutil.Internal("plugin.unavailable")
	// ErrMethodNotImplemented error returned when a plugin method is not implemented.
	ErrMethodNotImplemented = errutil.NotImplemented("plugin.notImplemented")
	// ErrPluginDownstreamError error returned when a plugin method is not implemented.
	ErrPluginDownstreamError = errutil.Internal("plugin.downstreamError",
		errutil.WithPublicMessage("An error occurred within the plugin"))
)
