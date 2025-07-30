package resourcepermission

import (
	"testing"
	"text/template"
	"time"

	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
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
			SQLTemplate:     sqltemplate.New(nodb.DialectForDriver()),
			Query:           q,
			PermissionTable: nodb.Table("permission"),
			RoleTable:       nodb.Table("role"),
		}
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	getResourcePermissionInsertTemplate := func(roleID int64, permissions []resourcePermissionForInsert) sqltemplate.SQLTemplate {
		v := resourcePermissionInsertTemplate{
			SQLTemplate:         sqltemplate.New(nodb.DialectForDriver()),
			PermissionTable:     nodb.Table("permission"),
			RoleID:              roleID,
			ResourcePermissions: permissions,
			Now:                 time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC),
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
					Data: getListResourcePermissionsQuery(&ListResourcePermissionsQuery{
						Pagination: common.Pagination{Limit: 10, Continue: 0},
					}),
				},
				{
					Name: "with_pagination",
					Data: getListResourcePermissionsQuery(&ListResourcePermissionsQuery{
						Pagination: common.Pagination{Limit: 15, Continue: 5},
					}),
				},
			},
			resourcePermissionInsertTplt: {
				{
					Name: "basic_insert",
					Data: getResourcePermissionInsertTemplate(123, []resourcePermissionForInsert{
						{
							Action:     "read",
							Scope:      "dashboards:*",
							Kind:       "dashboard",
							Attribute:  "",
							Identifier: "",
						},
						{
							Action:     "write",
							Scope:      "dashboards:uid:abc123",
							Kind:       "dashboard",
							Attribute:  "",
							Identifier: "abc123",
						},
					}),
				},
				{
					Name: "single_permission",
					Data: getResourcePermissionInsertTemplate(456, []resourcePermissionForInsert{
						{
							Action:     "admin",
							Scope:      "folders:uid:folder1",
							Kind:       "folder",
							Attribute:  "org",
							Identifier: "folder1",
						},
					}),
				},
			},
		},
	})
}
