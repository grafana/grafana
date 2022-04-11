package backendplugin

import (
	"errors"
	"fmt"
)

var (
	// ErrPluginNotRegistered error returned when plugin not registered.
	ErrPluginNotRegistered = errors.New("plugin not registered")
	// ErrHealthCheckFailed error returned when health check failed.
	ErrHealthCheckFailed = errors.New("health check failed")
	// ErrPluginUnavailable error returned when plugin is unavailable.
	ErrPluginUnavailable = errors.New("plugin unavailable")
	// ErrMethodNotImplemented error returned when plugin method not implemented.
	ErrMethodNotImplemented = errors.New("method not implemented")
)

type ErrFailedQuery struct {
	err error
}

func NewErrFailedQuery(err error) *ErrFailedQuery {
	return &ErrFailedQuery{err: err}
}

func (e ErrFailedQuery) Error() string {
	return fmt.Sprintf("query failure: %v", e.err)
}
