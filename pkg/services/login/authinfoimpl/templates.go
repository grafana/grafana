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
	getAuthInfoTemplate               = mustTemplate("get_auth_info.sql")
	getUsersRecentlyUsedLabelTemplate = mustTemplate("get_users_recently_used_label.sql")
	getUserAuthModulesTemplate        = mustTemplate("get_user_auth_modules.sql")
	insertAuthInfoTemplate            = mustTemplate("insert_auth_info.sql")
	updateAuthInfoTemplate            = mustTemplate("update_auth_info.sql")
	findDuplicateAuthInfoTemplate     = mustTemplate("find_duplicate_auth_info.sql")
	deleteDuplicateAuthInfoTemplate   = mustTemplate("delete_duplicate_auth_info.sql")
	deleteUserAuthInfoTemplate        = mustTemplate("delete_user_auth_info.sql")
	authInfoUserUIDMigrationTemplate  = mustTemplate("auth_info_user_uid_migration.sql")
)
