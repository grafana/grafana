package grafana

import (
	"embed"
	"io/fs"
)

// CoreSchema embeds all CUE files within the cue/ subdirectory.
//
// TODO good rule about where to search
//
//go:embed cue/*/*.cue
var CoreSchema embed.FS

// TODO good rule about where to search
//
//go:embed public/app/plugins/*/*/*.cue public/app/plugins/*/*/plugin.json
var base embed.FS

// PluginSchema embeds all CUE files within the public/ subdirectory.
var PluginSchema, _ = fs.Sub(base, "public/app/plugins")
