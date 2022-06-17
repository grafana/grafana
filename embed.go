package grafana

import (
	"embed"
)

// CueSchemaFS embeds all schema-related CUE files in the Grafana project.
//
//go:embed cue.mod packages/grafana-schema/src/schema/*.cue public/app/plugins/*/*/*.cue public/app/plugins/*/*/plugin.json
var CueSchemaFS embed.FS
