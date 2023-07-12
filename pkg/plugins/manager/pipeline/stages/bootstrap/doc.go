// Package bootstrap defines the second stage of the plugin loader pipeline.
//
// The Bootstrap stage must implement the Bootstrapper interface.
// - Bootstrap(ctx context.Context, src plugins.PluginSource, bundles []*plugins.FoundBundle) ([]*plugins.Plugin, error)
//
// The Bootstrap stage is made up of the following steps (in order):
// - Construct: Create the initial plugin structs based on the plugins found in the discovery stage.
// - Decorate: Decorate the plugins with additional metadata.
package bootstrap
