package store

import (
	"embed"
	"fmt"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"text/template"
)

var (
	//go:embed *.sql
	sqlTemplatesFS embed.FS
	sqlTemplates   = template.Must(template.New("sql").ParseFS(sqlTemplatesFS, `*.sql`))

	sqlUserPerms       = mustTemplate("permission_query.sql")
	sqlQueryBasicRoles = mustTemplate("basic_role_query.sql")
)

func mustTemplate(filename string) *template.Template {
	if t := sqlTemplates.Lookup(filename); t != nil {
		return t
	}
	panic(fmt.Sprintf("template file not found: %s", filename))
}

type getBasicRolesQuery struct {
	sqltemplate.SQLTemplate
	Query *BasicRoleQuery

	UserTable    string
	OrgUserTable string
}

func newGetBasicRoles(sql *legacysql.LegacyDatabaseHelper, q *BasicRoleQuery) getBasicRolesQuery {
	return getBasicRolesQuery{
		SQLTemplate:  sqltemplate.New(sql.DialectForDriver()),
		Query:        q,
		UserTable:    sql.Table("user"),
		OrgUserTable: sql.Table("org_user"),
	}
}

type getPermissionsQuery struct {
	sqltemplate.SQLTemplate
	Query *PermissionsQuery

	PermissionTable  string
	UserRoleTable    string
	TeamRoleTable    string
	BuiltinRoleTable string
}

func newGetPermissions(sql *legacysql.LegacyDatabaseHelper, q *PermissionsQuery) getPermissionsQuery {
	return getPermissionsQuery{
		SQLTemplate:      sqltemplate.New(sql.DialectForDriver()),
		Query:            q,
		PermissionTable:  sql.Table("permission"),
		UserRoleTable:    sql.Table("user_role"),
		TeamRoleTable:    sql.Table("team_role"),
		BuiltinRoleTable: sql.Table("builtin_role"),
	}
}
