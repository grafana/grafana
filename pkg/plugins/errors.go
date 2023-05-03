package plugins

import "github.com/grafana/grafana/pkg/util/errutil"

var (
	// ErrPluginNotRegistered error returned when a plugin is not registered.
	ErrPluginNotRegistered = errutil.NewBase(errutil.StatusNotFound, "plugin.notRegistered")
	// ErrHealthCheckFailed error returned when a plugin health check failed.
	ErrHealthCheckFailed = errutil.NewBase(errutil.StatusInternal, "plugin.failedHealthCheck")
	// ErrPluginUnavailable error returned when a plugin is unavailable.
	ErrPluginUnavailable = errutil.NewBase(errutil.StatusInternal, "plugin.unavailable")
	// ErrMethodNotImplemented error returned when a plugin method is not implemented.
	ErrMethodNotImplemented = errutil.NewBase(errutil.StatusNotImplemented, "plugin.notImplemented")
	// ErrPluginDownstreamError error returned when a plugin method is not implemented.
	ErrPluginDownstreamError = errutil.NewBase(errutil.StatusInternal, "plugin.downstreamError", errutil.WithPublicMessage("An error occurred within the plugin"))
)
