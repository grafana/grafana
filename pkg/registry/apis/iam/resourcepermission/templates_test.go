package resourcepermission

import (
	"testing"
	"text/template"

	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
)

func TestListResourcePermissionsQuery(t *testing.T) {
	nodb := &legacysql.LegacyDatabaseHelper{
		Table: func(n string) string {
			return "grafana." + n
		},
	}

	getListResourcePermissionsQuery := func(q *ListResourcePermissionsQuery) sqltemplate.SQLTemplate {
		v := listResourcePermissionsQueryTemplate{
			SQLTemplate:        sqltemplate.New(nodb.DialectForDriver()),
			Query:              q,
			PermissionTable:    nodb.Table("permission"),
			RoleTable:          nodb.Table("role"),
			UserTable:          nodb.Table("user"),
			TeamTable:          nodb.Table("team"),
			BuiltinRoleTable:   nodb.Table("builtin_role"),
			UserRoleTable:      nodb.Table("user_role"),
			TeamRoleTable:      nodb.Table("team_role"),
			ManagedRolePattern: "managed:%",
		}
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	getDeleteResourcePermissionsQuery := func(q *DeleteResourcePermissionsQuery) sqltemplate.SQLTemplate {
		v := deleteResourcePermissionsQueryTemplate{
			SQLTemplate:        sqltemplate.New(nodb.DialectForDriver()),
			Query:              q,
			PermissionTable:    nodb.Table("permission"),
			RoleTable:          nodb.Table("role"),
			ManagedRolePattern: "managed:%",
		}
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir:        "testdata",
		SQLTemplatesFS: sqlTemplatesFS,
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			resourcePermissionsQueryTplt: {
				{
					Name: "basic_query",
					Data: getListResourcePermissionsQuery(&ListResourcePermissionsQuery{}),
				},
				{
					Name: "with_all_fields",
					Data: getListResourcePermissionsQuery(&ListResourcePermissionsQuery{
						Scope:      "123",
						OrgID:      3,
						ActionSets: []string{"folders:admin", "folders:edit", "folders:view"},
					}),
				},
			},
			resourcePermissionDeletionQueryTplt: {
				{
					Name: "basic_delete_query",
					Data: getDeleteResourcePermissionsQuery(&DeleteResourcePermissionsQuery{
						Scope: "dash_123",
						OrgID: 3,
					}),
				},
			},
		},
	})
}
