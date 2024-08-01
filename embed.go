package grafana

import (
	"embed"
)

// CueSchemaFS embeds all schema-related CUE files in the Grafana project.
//
//go:embed cue.mod/module.cue
var CueSchemaFS embed.FS

// PublicViewsFS allows embedding the public/views/ directory at compile time.
// Files are available inside this fsys using the path public/views/.
//
//go:embed public/views/*.html
var PublicViewsFS embed.FS
