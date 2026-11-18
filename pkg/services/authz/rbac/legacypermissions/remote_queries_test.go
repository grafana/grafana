package legacypermissions

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

func TestRemotePermissionQueryDialects(t *testing.T) {
	for _, dialect := range []sqltemplate.Dialect{sqltemplate.MySQL, sqltemplate.PostgreSQL, sqltemplate.SQLite} {
		t.Run(dialect.DialectName(), func(t *testing.T) {
			for _, teams := range []bool{false, true} {
				name := "legacy_permissions_query.sql"
				if teams {
					name = "legacy_team_permissions_query.sql"
				}
				t.Run(name, func(t *testing.T) {
					q := newRemotePermissionQuery(&legacysql.LegacyDatabaseHelper{Table: func(table string) string {
						return "hg_tenant." + table
					}}, ac.GetUserPermissionsQuery{
						OrgID: 4, UserID: 7, TeamIDs: []int64{11, 12}, Roles: []string{"Viewer", "Admin"},
						RolePrefixes: []string{"managed:", "custom:'"}, ExcludeRedundantManagedPermissions: true,
					}, []string{"users:read", "users:read') OR 1=1 --"})
					q.SQLTemplate = sqltemplate.New(dialect)
					statement, err := sqltemplate.Execute(remoteQueries.Lookup(name), q)
					require.NoError(t, err)
					tables := []string{"permission", "role", "team_role"}
					if !teams {
						tables = append(tables, "user_role", "builtin_role")
					}
					for _, table := range tables {
						qualified, err := dialect.Ident("hg_tenant." + table)
						require.NoError(t, err)
						require.Contains(t, statement, qualified)
						unqualified, err := dialect.Ident(table)
						require.NoError(t, err)
						require.NotContains(t, statement, "FROM "+unqualified)
						require.NotContains(t, statement, "JOIN "+unqualified)
					}
					require.NotContains(t, statement, "OR 1=1")
					require.NotContains(t, statement, "custom:'")
					require.NotContains(t, statement, "UNION ALL")
					require.NotContains(t, statement, "SELECT DISTINCT")
					require.Contains(t, statement, "AND NOT (")
					if teams {
						require.Equal(t, []any{int64(11), int64(12), int64(4), "managed:%", "custom:'%"}, q.GetArgs())
					} else {
						require.Equal(t, 2, strings.Count(statement, "UNION"))
						require.Equal(t, []any{int64(7), int64(4), int64(11), int64(12), int64(4), "Viewer", "Admin", int64(4), "managed:%", "custom:'%", "users:read", "users:read') OR 1=1 --"}, q.GetArgs())
					}
				})
			}
		})
	}
}
