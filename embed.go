package grafana

import (
	"embed"
	"io/fs"
)

// CoreSchema embeds all core CUE files, which live in packages/grafana-schema/src
//
//go:embed cue.mod cue packages/grafana-schema/src/schema/*.cue packages/grafana-schema/src/scuemata/*/*.cue
var CoreSchema embed.FS

//go:embed public/app/plugins/*/*/*.cue public/app/plugins/*/*/plugin.json
var base embed.FS

// PluginSchema embeds all CUE files within the public/ subdirectory.
var PluginSchema, _ = fs.Sub(base, "public/app/plugins")
