package testdata

import (
	"embed"
)

// CueSchemaFS embeds all schema-related CUE files in the plugin.
//
//go:embed src/*.cue src/plugin.json
var CueSchemaFS embed.FS
