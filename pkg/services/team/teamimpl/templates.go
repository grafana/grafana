package teamimpl

import (
	"embed"
	"fmt"
	"text/template"
)

var (
	//go:embed queries/*.sql
	sqlTemplatesFS embed.FS

	sqlTemplates = template.Must(template.New("sql").ParseFS(sqlTemplatesFS, "queries/*.sql"))
)

func mustTemplate(filename string) *template.Template {
	if tmpl := sqlTemplates.Lookup(filename); tmpl != nil {
		return tmpl
	}
	panic(fmt.Sprintf("template file not found: %s", filename))
}

var (
	searchTeamsTemplate      = mustTemplate("search_teams.sql")
	getTeamByIDTemplate      = mustTemplate("get_team_by_id.sql")
	getTeamsByUserTemplate   = mustTemplate("get_teams_by_user.sql")
	getTeamIDsByUserTemplate = mustTemplate("get_team_ids_by_user.sql")
	isTeamMemberTemplate     = mustTemplate("is_team_member.sql")
)
