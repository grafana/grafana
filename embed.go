package grafana

import (
	"embed"
)

// CoreSchema embeds all core CUE files, which live in packages/grafana-schema/src
//
//go:embed cue.mod cue packages/grafana-schema/src/schema/*.cue packages/grafana-schema/src/scuemata/*/*.cue packages/grafana-schema/src/scuemata/*/*/*.cue
var CoreSchema embed.FS

// PluginSchema embeds all expected plugin CUE files and plugin metadata from
// within the public/app/plugins subdirectory.
//
//go:embed public/app/plugins/*/*/*.cue public/app/plugins/*/*/plugin.json
var PluginSchema embed.FS
