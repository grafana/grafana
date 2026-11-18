package legacypermissions

import (
	"embed"
	"text/template"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

//go:embed legacy_*_query.sql
var remoteQueriesFS embed.FS

var remoteQueries = template.Must(template.New("legacy_permissions").ParseFS(remoteQueriesFS, "legacy_*_query.sql"))

type remotePermissionQuery struct {
	sqltemplate.SQLTemplate
	Query            ac.GetUserPermissionsQuery
	Actions          []string
	PermissionTable  string
	RoleTable        string
	UserRoleTable    string
	TeamRoleTable    string
	BuiltinRoleTable string
}

func (q remotePermissionQuery) Validate() error { return nil }

func newRemotePermissionQuery(helper *legacysql.LegacyDatabaseHelper, query ac.GetUserPermissionsQuery, actions []string) remotePermissionQuery {
	return remotePermissionQuery{
		SQLTemplate:      sqltemplate.New(helper.DialectForDriver()),
		Query:            query,
		Actions:          actions,
		PermissionTable:  helper.Table("permission"),
		RoleTable:        helper.Table("role"),
		UserRoleTable:    helper.Table("user_role"),
		TeamRoleTable:    helper.Table("team_role"),
		BuiltinRoleTable: helper.Table("builtin_role"),
	}
}
