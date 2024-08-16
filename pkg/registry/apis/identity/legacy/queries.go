package legacy

import (
	"embed"
	"fmt"
	"text/template"

	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

// Templates setup.
var (
	//go:embed *.sql
	sqlTemplatesFS embed.FS

	sqlTemplates = template.Must(template.New("sql").ParseFS(sqlTemplatesFS, `*.sql`))
)

func mustTemplate(filename string) *template.Template {
	if t := sqlTemplates.Lookup(filename); t != nil {
		return t
	}
	panic(fmt.Sprintf("template file not found: %s", filename))
}

// Templates.
var (
	sqlQueryTeams   = mustTemplate("query_teams.sql")
	sqlQueryUsers   = mustTemplate("query_users.sql")
	sqlQueryDisplay = mustTemplate("query_display.sql")
)

type sqlQueryListUsers struct {
	sqltemplate.SQLTemplate
	Query *ListUserQuery
}

func (r sqlQueryListUsers) Validate() error {
	return nil // TODO
}

type sqlQueryListTeams struct {
	sqltemplate.SQLTemplate
	Query *ListTeamQuery
}

func (r sqlQueryListTeams) Validate() error {
	return nil // TODO
}

type sqlQueryGetDisplay struct {
	sqltemplate.SQLTemplate
	Query *GetUserDisplayQuery
}

func (r sqlQueryGetDisplay) Validate() error {
	return nil // TODO
}
