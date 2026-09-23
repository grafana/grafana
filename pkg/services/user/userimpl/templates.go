package userimpl

import (
	"embed"
	"fmt"
	"text/template"
)

var (
	//go:embed queries/*.sql
	sqlTemplatesFS embed.FS

	sqlTemplates = template.Must(template.New("sql").ParseFS(sqlTemplatesFS, `queries/*.sql`))
)

func mustTemplate(filename string) *template.Template {
	if tmpl := sqlTemplates.Lookup(filename); tmpl != nil {
		return tmpl
	}
	panic(fmt.Sprintf("template file not found: %s", filename))
}

var (
	deleteUserTemplate                     = mustTemplate("delete_user.sql")
	getUserTemplate                        = mustTemplate("get_user.sql")
	getSignedInUserTemplate                = mustTemplate("get_signed_in_user.sql")
	countUsersTemplate                     = mustTemplate("count_users.sql")
	countUserAccountsWithEmptyRoleTemplate = mustTemplate("count_user_accounts_with_empty_role.sql")
	batchDisableUsersTemplate              = mustTemplate("batch_disable_users.sql")
	searchUsersTemplate                    = mustTemplate("search_users.sql")
	countSearchUsersTemplate               = mustTemplate("count_search_users.sql")
	updateUserTemplate                     = mustTemplate("update_user.sql")
)
