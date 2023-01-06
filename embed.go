package grafana

import (
	"embed"
)

// CueSchemaFS embeds all schema-related CUE files in the Grafana project.
//
//go:embed cue.mod/module.cue kinds/*.cue kinds/*/*.cue public/app/plugins/*/*/*.cue public/app/plugins/*/*/plugin.json pkg/kindsys/*.cue pkg/plugins/*/*.cue packages/grafana-schema/src/schema/*.cue
var CueSchemaFS embed.FS
