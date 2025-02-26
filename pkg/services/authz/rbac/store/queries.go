package store

import (
	"embed"
	"fmt"
	"text/template"

	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

var (
	//go:embed *.sql
	sqlTemplatesFS embed.FS
	sqlTemplates   = template.Must(template.New("sql").ParseFS(sqlTemplatesFS, `*.sql`))

	sqlQueryBasicRoles = mustTemplate("basic_role_query.sql")
	sqlUserIdentifiers = mustTemplate("user_identifier_query.sql")
)

func mustTemplate(filename string) *template.Template {
	if t := sqlTemplates.Lookup(filename); t != nil {
		return t
	}
	panic(fmt.Sprintf("template file not found: %s", filename))
}

type getUserIdentifiers struct {
	sqltemplate.SQLTemplate
	Query *UserIdentifierQuery

	UserTable string
}

func (r getUserIdentifiers) Validate() error {
	return nil
}

func newGetUserIdentifiers(sql *legacysql.LegacyDatabaseHelper, q *UserIdentifierQuery) getUserIdentifiers {
	return getUserIdentifiers{
		SQLTemplate: sqltemplate.New(sql.DialectForDriver()),
		Query:       q,
		UserTable:   sql.Table("user"),
	}
}

type getBasicRolesQuery struct {
	sqltemplate.SQLTemplate
	Query *BasicRoleQuery

	UserTable    string
	OrgUserTable string
}

func (r getBasicRolesQuery) Validate() error {
	return nil
}

func newGetBasicRoles(sql *legacysql.LegacyDatabaseHelper, q *BasicRoleQuery) getBasicRolesQuery {
	return getBasicRolesQuery{
		SQLTemplate:  sqltemplate.New(sql.DialectForDriver()),
		Query:        q,
		UserTable:    sql.Table("user"),
		OrgUserTable: sql.Table("org_user"),
	}
}

type getFoldersQuery struct {
	sqltemplate.SQLTemplate
	Query *FolderQuery

	FolderTable string
}

func (r getFoldersQuery) Validate() error {
	return nil
}

func newGetFolders(sql *legacysql.LegacyDatabaseHelper, q *FolderQuery) getFoldersQuery {
	return getFoldersQuery{
		SQLTemplate: sqltemplate.New(sql.DialectForDriver()),
		Query:       q,
		FolderTable: sql.Table("folder"),
	}
}
