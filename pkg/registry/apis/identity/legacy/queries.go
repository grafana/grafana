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
	sqlQueryTeams        = mustTemplate("query_teams.sql")
	sqlQueryUsers        = mustTemplate("query_users.sql")
	sqlQueryDisplay      = mustTemplate("query_display.sql")
	sqlQueryTeamBindings = mustTemplate("query_team_bindings.sql")
)

type sqlQueryListUsers struct {
	sqltemplate.SQLTemplate
	Query        *ListUserQuery
	UserTable    string
	OrgUserTable string
}

func newListUser(sql *legacysql.LegacyDatabaseHelper, q *ListUserQuery) sqlQueryListUsers {
	return sqlQueryListUsers{
		SQLTemplate:  sqltemplate.New(sql.DialectForDriver()),
		UserTable:    sql.Table("user"),
		OrgUserTable: sql.Table("org_user"),
		Query:        q,
	}
}

func (r sqlQueryListUsers) Validate() error {
	return nil // TODO
}

type sqlQueryListTeams struct {
	sqltemplate.SQLTemplate
	Query     *ListTeamQuery
	TeamTable string
}

func newListTeams(sql *legacysql.LegacyDatabaseHelper, q *ListTeamQuery) sqlQueryListTeams {
	return sqlQueryListTeams{
		SQLTemplate: sqltemplate.New(sql.DialectForDriver()),
		TeamTable:   sql.Table("team"),
		Query:       q,
	}
}

func (r sqlQueryListTeams) Validate() error {
	return nil // TODO
}

type sqlQueryGetDisplay struct {
	sqltemplate.SQLTemplate
	Query        *GetUserDisplayQuery
	UserTable    string
	OrgUserTable string
}

func newGetDisplay(sql *legacysql.LegacyDatabaseHelper, q *GetUserDisplayQuery) sqlQueryGetDisplay {
	return sqlQueryGetDisplay{
		SQLTemplate:  sqltemplate.New(sql.DialectForDriver()),
		UserTable:    sql.Table("user"),
		OrgUserTable: sql.Table("org_user"),
		Query:        q,
	}
}

func (r sqlQueryGetDisplay) Validate() error {
	return nil // TODO
}

type sqlQueryListTeamBindings struct {
	sqltemplate.SQLTemplate
	Query           *ListTeamBindingsQuery
	UserTable       string
	TeamTable       string
	TeamMemberTable string
}

func (r sqlQueryListTeamBindings) Validate() error {
	return nil // TODO
}

func newListTeamBindings(sql *legacysql.LegacyDatabaseHelper, q *ListTeamBindingsQuery) sqlQueryListTeamBindings {
	return sqlQueryListTeamBindings{
		SQLTemplate:     sqltemplate.New(sql.DialectForDriver()),
		UserTable:       sql.Table("user"),
		TeamTable:       sql.Table("team"),
		TeamMemberTable: sql.Table("team_member"),
		Query:           q,
	}
}
