// Package termination defines the Termination stage of the plugin loader pipeline.
//
// The Termination stage must implement the Terminator interface.
// - Terminate(ctx context.Context, pluginID string) error
package termination
