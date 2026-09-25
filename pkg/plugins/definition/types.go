package definition

import (
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/pluginschema"
	"github.com/grafana/grafana/pkg/plugins"
)

// Plugin definition contains the normalized static information defined inside a plugin.
// This is currently read from multiple files, however it will eventually be combined into
// a single file that can be loaded in a single request.
// NOTE: Although this has json tags it is not intended as a long term API format
type PluginDefinition struct {
	JSONData plugins.JSONData `json:"jsonData"`

	// apiVersion -> schema (currently only v0alpha1)
	// This will be nil if no schemas are found, or if withSchemas is false when loading.
	// NOTE: this will soon be merged into ManifestData (automatically)
	Schemas map[string]*pluginschema.PluginSchema `json:"schemas,omitempty"`

	// When an app manifest is defined, we can use that
	Manifest *app.ManifestData `json:"manifest,omitempty"`
}

// Internal, cloud specific type used by the router to know which MT plugins exist
type PluginDeployment struct {
	Definition PluginDefinition `json:"definition"`

	// Host is a "host:port" for the plugin's gRPC backend, set only when
	// configured for this plugin; plugin-manifests does not otherwise use or validate it.
	Host string `json:"host,omitempty"`
}

// Internal, cloud specific type used by the router to know which MT plugins exist
type PluginDeployments struct {
	// Key indicates if anything may have changed in the deployments
	// This may be an resource version or timestamp when things were last loaded
	Key string `json:"key"`

	// The list of plugin deployments
	Plugins []PluginDeployment `json:"plugins"`
}
