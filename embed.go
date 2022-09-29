package grafana

import (
	"embed"
)

// CueSchemaFS embeds all schema-related CUE files in the Grafana project.
//
//go:embed cue.mod/module.cue packages/grafana-schema/src/schema/*.cue public/app/plugins/*/*/*.cue public/app/plugins/*/*/plugin.json pkg/framework/coremodel/*.cue
var CueSchemaFS embed.FS
