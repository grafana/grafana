package backendplugin

import (
	"errors"

	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	// ErrPluginNotRegistered error returned when plugin is not registered.
	ErrPluginNotRegistered = errors.New("plugin not registered")
	// ErrHealthCheckFailed error returned when health check failed.
	ErrHealthCheckFailed = errors.New("health check failed")
	// ErrPluginUnavailable error returned when plugin is unavailable.
	ErrPluginUnavailable = errors.New("plugin unavailable")
	// ErrMethodNotImplemented error returned when plugin method not implemented.
	ErrMethodNotImplemented = errors.New("method not implemented")
	// ErrDownstreamError error returned when an error received from downstream plugin.
	ErrDownstreamError = errutil.BadGateway("backendplugin.downstreamError",
		errutil.WithPublicMessage("An error occurred within the plugin"))
)
