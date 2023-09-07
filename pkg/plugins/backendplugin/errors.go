package backendplugin

import (
	"errors"
)

var (
	// ErrPluginNotRegistered error returned when plugin is not registered.
	ErrPluginNotRegistered = errors.New("plugin not registered")
	// ErrPluginUnavailable error returned when plugin is unavailable.
	ErrPluginUnavailable = errors.New("plugin unavailable")
	// ErrMethodNotImplemented error returned when plugin method not implemented.
	ErrMethodNotImplemented = errors.New("method not implemented")
)
