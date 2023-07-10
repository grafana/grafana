// Package discovery defines the first stage of the plugin loader pipeline.

// The Discovery stage must implement the Discoverer interface.
// - Discover(ctx context.Context, src plugins.PluginSource) ([]*plugins.Plugin, error)
//
// The Discovery stage is made up of the following steps (in order):
// 	 Find: Find plugins (from disk, remote, etc.)
// - Filter: Filter the results based on some criteria.
// - Bootstrap: Prepare the plugin for use.
//
// The Find stage is implemented by the FindFunc type.
// - func(ctx context.Context, src plugins.PluginSource) ([]*plugins.FoundBundle, error)
//
// The Filter stage is implemented by the FindFilterFunc type.
// - func(ctx context.Context, bundles []*plugins.FoundBundle) ([]*plugins.FoundBundle, error)
//
// The Bootstrap stage is implemented by the BootstrapFunc type.
// - func(ctx context.Context, src plugins.PluginSource, bundles []*plugins.FoundBundle) ([]*plugins.Plugin, error)

package discovery
