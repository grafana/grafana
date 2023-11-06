package pluginrequestmeta

import (
	"context"
	"errors"
)

// StatusSource is an enum-like string value representing the source of a
// plugin query data response status code
type StatusSource string

const (
	StatusSourcePlugin     StatusSource = "plugin"
	StatusSourceDownstream StatusSource = "downstream"
)

type statusSourceCtxKey struct{}

// StatusSourceFromContext returns the plugin request status source stored in the context.
// If no plugin request status source is stored in the context, [StatusSourcePlugin] is returned.
func StatusSourceFromContext(ctx context.Context) StatusSource {
	value, ok := ctx.Value(statusSourceCtxKey{}).(*StatusSource)
	if ok {
		return *value
	}
	return StatusSourcePlugin
}

// WithStatusSource sets the plugin request status source for the context.
func WithStatusSource(ctx context.Context, s StatusSource) context.Context {
	return context.WithValue(ctx, statusSourceCtxKey{}, &s)
}

// WithDownstreamStatusSource mutates the provided context by setting the plugin request status source to
// StatusSourceDownstream. If the provided context does not have a plugin request status source, the context
// will not be mutated. This means that [WithStatusSource] has to be called before this function.
func WithDownstreamStatusSource(ctx context.Context) error {
	v, ok := ctx.Value(statusSourceCtxKey{}).(*StatusSource)
	if !ok {
		return errors.New("the provided context does not have a plugin request status source")
	}
	*v = StatusSourceDownstream
	return nil
}
