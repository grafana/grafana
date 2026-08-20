package definition

import (
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/pluginschema"
	"github.com/grafana/grafana/pkg/plugins"
)

// Plugin definition contains the normalized static information defined inside a plugin.
// This is currently read from multiple files, however it will eventually be combined into
// a single file that can be loaded in a single request.
type PluginDefinition struct {
	JSONData plugins.JSONData

	// apiVersion -> schema (currently only v0alpha1)
	// This will be nil if no schemas are found, or if withSchemas is false when loading.
	// NOTE: this will soon be merged into ManifestData (automatically)
	Schemas map[string]*pluginschema.PluginSchema

	// When an app manifest is defined, we can use that
	Manifest *app.ManifestData
}
