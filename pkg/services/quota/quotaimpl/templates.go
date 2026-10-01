package quotaimpl

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
	deleteByUserTemplate   = mustTemplate("delete_by_user.sql")
	findQuotaTemplate      = mustTemplate("find_quota.sql")
	insertQuotaTemplate    = mustTemplate("insert_quota.sql")
	updateQuotaTemplate    = mustTemplate("update_quota.sql")
	userScopeQuotaTemplate = mustTemplate("user_scope_quota.sql")
	orgScopeQuotaTemplate  = mustTemplate("org_scope_quota.sql")
)
