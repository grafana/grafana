package authinfoimpl

import (
	"embed"
	"fmt"
	"text/template"
)

//go:embed queries/*.sql
var sqlTemplatesFS embed.FS

var sqlTemplates = template.Must(template.New("sql").ParseFS(sqlTemplatesFS, "queries/*.sql"))

func mustTemplate(filename string) *template.Template {
	if tmpl := sqlTemplates.Lookup(filename); tmpl != nil {
		return tmpl
	}
	panic(fmt.Sprintf("template file not found: %s", filename))
}

var (
	lookupDuplicateUserAuthTemplate = mustTemplate("lookup_duplicate_user_auth.sql")
	deleteDuplicateUserAuthTemplate = mustTemplate("delete_duplicate_user_auth.sql")
	deleteUserAuthTemplate          = mustTemplate("delete_user_auth.sql")
	userAuthUIDMigrationTemplate    = mustTemplate("user_auth_uid_migration.sql")
)
