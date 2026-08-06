package orgimpl

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
	syncOrgSequenceTemplate            = mustTemplate("sync_org_sequence.sql")
	deleteByIDTemplate                 = mustTemplate("delete_by_id.sql")
	deleteAlertRuleTagsByOrgTemplate   = mustTemplate("delete_alert_rule_tags_by_org.sql")
	orgExistsTemplate                  = mustTemplate("org_exists.sql")
	orgUserExistsTemplate              = mustTemplate("org_user_exists.sql")
	countOrgsTemplate                  = mustTemplate("count_orgs.sql")
	countOrgUsersTemplate              = mustTemplate("count_org_users.sql")
	countUserOrgsTemplate              = mustTemplate("count_user_orgs.sql")
	validateOrgAdminTemplate           = mustTemplate("validate_org_admin.sql")
	deleteByOrgAndUserTemplate         = mustTemplate("delete_by_org_and_user.sql")
	deletePermissionByScopeTemplate    = mustTemplate("delete_permission_by_scope.sql")
	managedUserRoleIDsTemplate         = mustTemplate("managed_user_role_ids.sql")
	deletePermissionsByRoleIDsTemplate = mustTemplate("delete_permissions_by_role_ids.sql")
	deleteRoleByNameTemplate           = mustTemplate("delete_role_by_name.sql")
	getUserByIDTemplate                = mustTemplate("get_user_by_id.sql")
	getUserOrgListTemplate             = mustTemplate("get_user_org_list.sql")
	getUserOrgByUserAndOrgTemplate     = mustTemplate("get_user_org_by_user_and_org.sql")
	getUserOrgsByUserTemplate          = mustTemplate("get_user_orgs_by_user.sql")
	searchOrgUsersTemplate             = mustTemplate("search_org_users.sql")
	countSearchOrgUsersTemplate        = mustTemplate("count_search_org_users.sql")
	searchOrgUsersByEmailsTemplate     = mustTemplate("search_org_users_by_emails.sql")
)
