package teamimpl

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
	searchTeamsTemplate          = mustTemplate("search_teams.sql")
	getTeamByIDTemplate          = mustTemplate("get_team_by_id.sql")
	getTeamsByUserTemplate       = mustTemplate("get_teams_by_user.sql")
	getTeamIDsByUserTemplate     = mustTemplate("get_team_ids_by_user.sql")
	teamExistsTemplate           = mustTemplate("team_exists.sql")
	isTeamMemberTemplate         = mustTemplate("is_team_member.sql")
	getTeamMemberTemplate        = mustTemplate("get_team_member.sql")
	deleteTeamMembersTemplate    = mustTemplate("delete_team_members.sql")
	deleteTeamTemplate           = mustTemplate("delete_team.sql")
	deleteDashboardACLTemplate   = mustTemplate("delete_dashboard_acl.sql")
	removeTeamMemberTemplate     = mustTemplate("remove_team_member.sql")
	removeUserMembershipTemplate = mustTemplate("remove_user_memberships.sql")
	teamMemberUIDMigrationTmpl   = mustTemplate("team_member_uid_migration.sql")
)
