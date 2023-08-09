// Package bootstrap defines the Bootstrap stage of the plugin loader pipeline.
//
// The Bootstrap stage must implement the Bootstrapper interface.
// - Bootstrap(ctx context.Context, src plugins.PluginSource, bundles []*plugins.FoundBundle) ([]*plugins.Plugin, error)

package bootstrap
