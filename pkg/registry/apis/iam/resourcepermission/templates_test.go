package resourcepermission

import (
	"testing"
	"text/template"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
)

func TestTemplates(t *testing.T) {
	nodb := &legacysql.LegacyDatabaseHelper{
		Table: func(n string) string {
			return "grafana." + n
		},
	}

	getInsertRole := func(orgID int64, name string, displayName string) sqltemplate.SQLTemplate {
		v := insertRoleTemplate{
			SQLTemplate: sqltemplate.New(nodb.DialectForDriver()),
			RoleTable:   nodb.Table("role"),
			OrgID:       orgID,
			UID:         name,
			Name:        displayName,
			Now:         "2025-08-27 21:35:00",
		}
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	getInsertPermission := func(roleID int64, permission accesscontrol.Permission) sqltemplate.SQLTemplate {
		v := insertPermissionTemplate{
			SQLTemplate:     sqltemplate.New(nodb.DialectForDriver()),
			PermissionTable: nodb.Table("permission"),
			RoleID:          roleID,
			Permission:      permission,
			Now:             "2025-08-27 21:35:00",
		}
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	getInsertAssignment := func(orgID int64, roleID int64, assignment rbacAssignmentCreate) sqltemplate.SQLTemplate {
		v := insertAssignmentTemplate{
			SQLTemplate:      sqltemplate.New(nodb.DialectForDriver()),
			AssignmentTable:  nodb.Table(assignment.AssignmentTable),
			AssignmentColumn: assignment.AssignmentColumn,
			RoleID:           roleID,
			OrgID:            orgID,
			SubjectID:        assignment.SubjectID,
			Now:              "2025-08-27 21:35:00",
		}
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
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
			roleInsertTplt: {
				{
					Name: "insert_role",
					Data: getInsertRole(
						8,
						accesscontrol.PrefixedRoleUID("managed:builtins:editor:1:permissions"+":org:8"),
						"managed:builtins:editor:1:permissions",
					),
				},
			},
			permissionInsertTplt: {
				{
					Name: "insert_permission",
					Data: getInsertPermission(23, accesscontrol.Permission{
						Action:     "dashboards:view",
						Scope:      "dashboard:uid:dash1",
						Kind:       "dashboard",
						Attribute:  "uid",
						Identifier: "dash1",
					}),
				},
			},
			assignmentInsertTplt: {
				{
					Name: "insert user assignment",
					Data: getInsertAssignment(8, 23, rbacAssignmentCreate{
						SubjectID:        5,
						AssignmentTable:  "user_role",
						AssignmentColumn: "user_id",
						Action:           "dashboards:edit",
						Scope:            "dashboard:uid:dash1",
					}),
				},
				{
					Name: "insert basic role assignment",
					Data: getInsertAssignment(74, 96, rbacAssignmentCreate{
						SubjectID:        "Viewer",
						AssignmentTable:  "builtin_role",
						AssignmentColumn: "role",
						Action:           "dashboards:admin",
						Scope:            "dashboard:uid:dash2",
					}),
				},
			},
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
