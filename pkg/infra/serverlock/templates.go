package serverlock

import (
	"embed"
	"fmt"
	"text/template"
)

var (
	//go:embed queries/*.sql
	sqlTemplatesFS embed.FS

	sqlTemplates = template.Must(template.New("sql").ParseFS(sqlTemplatesFS, "queries/*.sql"))

	updateVersionTemplate       = mustTemplate("update_version.sql")
	getLockTemplate             = mustTemplate("get_lock.sql")
	getLockForUpdateTemplate    = mustTemplate("get_lock_for_update.sql")
	updateLastExecutionTemplate = mustTemplate("update_last_execution.sql")
	releaseLockTemplate         = mustTemplate("release_lock.sql")
	createLockTemplate          = mustTemplate("create_lock.sql")
)

func mustTemplate(filename string) *template.Template {
	if tmpl := sqlTemplates.Lookup(filename); tmpl != nil {
		return tmpl
	}
	panic(fmt.Sprintf("template file not found: %s", filename))
}
