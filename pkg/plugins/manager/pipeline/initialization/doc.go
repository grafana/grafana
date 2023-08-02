// Package initialization defines the fourth stage of the plugin loader pipeline.
//
// The Initialization stage must implement the Initializer interface.
// - Initialize(ctx context.Context, ps []*plugins.Plugin) ([]*plugins.Plugin, error)

package initialization
