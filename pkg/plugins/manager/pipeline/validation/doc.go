// Package validation defines the Validation stage of the plugin loader pipeline.
//
// The Validation stage must implement the Validator interface.
// - Validate(ctx context.Context, ps []*plugins.Plugin) ([]*plugins.Plugin, error)

package validation
