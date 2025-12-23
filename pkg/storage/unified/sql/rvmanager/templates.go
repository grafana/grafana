package rvmanager

import (
	"embed"
	"fmt"
	"text/template"
)

// Templates setup.
var (
	//go:embed data/*.sql
	sqlTemplatesFS embed.FS

	sqlTemplates = template.Must(template.New("sql").ParseFS(sqlTemplatesFS, `data/*.sql`))
)

func mustTemplate(filename string) *template.Template {
	if t := sqlTemplates.Lookup(filename); t != nil {
		return t
	}
	panic(fmt.Sprintf("template file not found: %s", filename))
}

var (
	SqlResourceUpdateRV        = mustTemplate("resource_update_rv.sql")
	SqlResourceHistoryUpdateRV = mustTemplate("resource_history_update_rv.sql")
	SqlResourceVersionGet      = mustTemplate("resource_version_get.sql")
	SqlResourceVersionUpdate   = mustTemplate("resource_version_update.sql")
	SqlResourceVersionInsert   = mustTemplate("resource_version_insert.sql")
)
