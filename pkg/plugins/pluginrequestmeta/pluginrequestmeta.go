package pluginrequestmeta

import "context"

// StatusSource is an enum-like string value representing the source of a
// plugin query data response status code
type StatusSource string

const (
	StatusSourcePlugin     StatusSource = "plugin"
	StatusSourceDownstream StatusSource = "downstream"
)

// MetaData contains metadata about a plugin request.
// It can be stored into a [context.Context] with [WithMetaData]
// and later retrieved with [FromContext].
type MetaData struct {
	// StatusSource is the source of the status code in the plugin response.
	StatusSource StatusSource
}

type rMDContextKey struct{}

var pluginRequestMetaDataContextKey = rMDContextKey{}

// FromContext returns the plugin request metadata stored in the context.
// if request metadata is missing it will return the default values.
func FromContext(ctx context.Context) *MetaData {
	val := ctx.Value(pluginRequestMetaDataContextKey)

	value, ok := val.(*MetaData)
	if ok {
		return value
	}

	rmd := DefaultPluginRequestMetadata()
	return &rmd
}

// WithMetaData sets the plugin request metadata for the context.
func WithMetaData(ctx context.Context, prmd MetaData) context.Context {
	return context.WithValue(ctx, pluginRequestMetaDataContextKey, &prmd)
}

// WithDownstreamStatusSource sets the StatusSource field of the [MetaData] for the
// context to [StatusSourceDownstream].
func WithDownstreamStatusSource(ctx context.Context) {
	v := FromContext(ctx)
	v.StatusSource = StatusSourceDownstream
}

// DefaultPluginRequestMetadata returns the default MetaData.
func DefaultPluginRequestMetadata() MetaData {
	return MetaData{
		StatusSource: StatusSourcePlugin,
	}
}
