// Package discovery defines the Discovery stage of the plugin loader pipeline.

// The Discovery stage must implement the Discoverer interface.
// - Discover(ctx context.Context, src plugins.PluginSource) ([]*plugins.FoundBundle, error)

package discovery
