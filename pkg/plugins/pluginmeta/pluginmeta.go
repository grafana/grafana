package pluginmeta

import "context"

// StatusSource is an enum-like string value representing the source of a
// plugin query data response status code
type StatusSource string

const (
	StatusSourcePlugin     StatusSource = "plugin"
	StatusSourceDownstream StatusSource = "downstream"
)

// PluginRequestMetaData contains metadata about a plugin request.
// It can be stored into a [context.Context] with [SetRequestMetaData]
// and later retrieved with [GetPluginRequestMetaData].
type PluginRequestMetaData struct {
	// StatusSource is the source of the status code in the plugin response.
	StatusSource StatusSource
}

type rMDContextKey struct{}

var pluginRequestMetaDataContextKey = rMDContextKey{}

// GetPluginRequestMetaData returns the plugin request metadata for the context.
// if request metadata is missing it will return the default values.
func GetPluginRequestMetaData(ctx context.Context) *PluginRequestMetaData {
	val := ctx.Value(pluginRequestMetaDataContextKey)

	value, ok := val.(*PluginRequestMetaData)
	if ok {
		return value
	}

	rmd := DefaultPluginRequestMetadata()
	return &rmd
}

// SetRequestMetaData sets the plugin request metadata for the context.
func SetRequestMetaData(ctx context.Context, prmd PluginRequestMetaData) context.Context {
	return context.WithValue(ctx, pluginRequestMetaDataContextKey, &prmd)
}

// WithDownstreamStatusSource sets the StatusSource field of the [PluginRequestMetaData] for the
// context to [StatusSourceDownstream].
func WithDownstreamStatusSource(ctx context.Context) {
	v := GetPluginRequestMetaData(ctx)
	v.StatusSource = StatusSourceDownstream
}

// DefaultPluginRequestMetadata returns the default PluginRequestMetaData.
func DefaultPluginRequestMetadata() PluginRequestMetaData {
	return PluginRequestMetaData{
		StatusSource: StatusSourcePlugin,
	}
}
