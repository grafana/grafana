package legacy

import (
	"embed"
	"fmt"
	"text/template"

	"github.com/grafana/grafana/pkg/storage/legacysql"
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
	sqlQueryTeamMembers = mustTemplate("query_team_members.sql")
)

type sqlQueryListTeamMembers struct {
	sqltemplate.SQLTemplate
	Query           *ListTeamMembersQuery
	UserTable       string
	TeamTable       string
	TeamMemberTable string
}

func (r sqlQueryListTeamMembers) Validate() error {
	return nil // TODO
}

func newListTeamMembers(sql *legacysql.LegacyDatabaseHelper, q *ListTeamMembersQuery) sqlQueryListTeamMembers {
	return sqlQueryListTeamMembers{
		SQLTemplate:     sqltemplate.New(sql.DialectForDriver()),
		UserTable:       sql.Table("user"),
		TeamTable:       sql.Table("team"),
		TeamMemberTable: sql.Table("team_member"),
		Query:           q,
	}
}
