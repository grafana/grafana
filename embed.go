package grafana

import (
	"embed"
)

// CueSchemaFS embeds all schema-related CUE files in the Grafana project.
//
//go:embed cue.mod/module.cue
var CueSchemaFS embed.FS
