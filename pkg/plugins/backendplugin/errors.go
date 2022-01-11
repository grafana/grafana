package backendplugin

import "errors"

var (
	// ErrPluginNotRegistered error returned when plugin not registered.
	ErrPluginNotRegistered = errors.New("plugin not registered")
	// ErrHealthCheckFailed error returned when health check failed.
	ErrHealthCheckFailed = errors.New("health check failed")
	// ErrPluginUnavailable error returned when plugin is unavailable.
	ErrPluginUnavailable = errors.New("plugin unavailable")
	// ErrPluginConnectionFailure error returned when plugin connection failed.
	ErrPluginConnectionFailure = errors.New("plugin connection failed")
	// ErrMethodNotImplemented error returned when plugin method not implemented.
	ErrMethodNotImplemented = errors.New("method not implemented")
)
