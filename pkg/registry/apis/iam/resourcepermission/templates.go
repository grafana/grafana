package resourcepermission

import (
	"embed"
	"fmt"
	"text/template"
	"time"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

// Templates setup.
var (
	//go:embed queries/*.sql
	sqlTemplatesFS embed.FS

	sqlTemplates = template.Must(template.New("sql").ParseFS(sqlTemplatesFS, `queries/*.sql`))

	roleInsertTplt               = mustTemplate("role_insert.sql")
	assignmentInsertTplt         = mustTemplate("assignment_insert.sql")
	permissionInsertTplt         = mustTemplate("permission_insert.sql")
	resourcePermissionsQueryTplt = mustTemplate("resource_permission_query.sql")
)

func mustTemplate(filename string) *template.Template {
	if t := sqlTemplates.Lookup(filename); t != nil {
		return t
	}
	panic(fmt.Sprintf("template file not found: %s", filename))
}

// List

type listResourcePermissionsQueryTemplate struct {
	sqltemplate.SQLTemplate
	Query              *ListResourcePermissionsQuery
	PermissionTable    string
	RoleTable          string
	UserTable          string
	TeamTable          string
	BuiltinRoleTable   string
	UserRoleTable      string
	TeamRoleTable      string
	ManagedRolePattern string
}

// BooleanStr provides the BooleanStr functionality that the template is trying to access
func (r listResourcePermissionsQueryTemplate) BooleanStr(value bool) string {
	if value {
		return "1"
	}
	return "0"
}

func (r listResourcePermissionsQueryTemplate) Validate() error {
	return nil
}

func buildListResourcePermissionsQueryFromTemplate(sql *legacysql.LegacyDatabaseHelper, query *ListResourcePermissionsQuery) (string, []interface{}, error) {
	req := listResourcePermissionsQueryTemplate{
		SQLTemplate:        sqltemplate.New(sql.DialectForDriver()),
		Query:              query,
		PermissionTable:    sql.Table("permission"),
		RoleTable:          sql.Table("role"),
		UserTable:          sql.Table("user"),
		TeamTable:          sql.Table("team"),
		BuiltinRoleTable:   sql.Table("builtin_role"),
		UserRoleTable:      sql.Table("user_role"),
		TeamRoleTable:      sql.Table("team_role"),
		ManagedRolePattern: "managed:%",
	}

	rawQuery, err := sqltemplate.Execute(resourcePermissionsQueryTplt, req)
	if err != nil {
		return "", nil, fmt.Errorf("execute template %q: %w", resourcePermissionsQueryTplt.Name(), err)
	}

	return rawQuery, req.GetArgs(), nil
}

// Create

type insertRoleTemplate struct {
	sqltemplate.SQLTemplate
	RoleTable string
	OrgID     int64
	UID       string
	Name      string
	Now       string
}

func (t insertRoleTemplate) Validate() error {
	return nil
}

func buildInsertRoleQuery(dbHelper *legacysql.LegacyDatabaseHelper, orgID int64, uid string, name string) (string, []any, error) {
	req := insertRoleTemplate{
		SQLTemplate: sqltemplate.New(dbHelper.DialectForDriver()),
		RoleTable:   dbHelper.Table("role"),
		OrgID:       orgID,
		UID:         uid,
		Name:        name,
		Now:         timeNow().Format(time.DateTime),
	}
	rawQuery, err := sqltemplate.Execute(roleInsertTplt, req)
	if err != nil {
		return "", nil, fmt.Errorf("rendering sql template: %w", err)
	}
	return rawQuery, req.GetArgs(), nil
}

type insertAssignmentTemplate struct {
	sqltemplate.SQLTemplate
	AssignmentTable  string
	AssignmentColumn string
	RoleID           int64
	OrgID            int64
	AssigneeID       any // int64 or string
	Now              string
}

func (t insertAssignmentTemplate) Validate() error {
	if t.AssignmentTable == "" {
		return fmt.Errorf("assignment table is required")
	}
	if t.AssignmentColumn == "" {
		return fmt.Errorf("assignment column is required")
	}
	return nil
}

func buildInsertAssignmentQuery(dbHelper *legacysql.LegacyDatabaseHelper, orgID int64, roleID int64, assignment grant) (string, []any, error) {
	req := insertAssignmentTemplate{
		SQLTemplate:      sqltemplate.New(dbHelper.DialectForDriver()),
		AssignmentTable:  dbHelper.Table(assignment.AssignmentTable),
		AssignmentColumn: assignment.AssignmentColumn,
		RoleID:           roleID,
		OrgID:            orgID,
		AssigneeID:       assignment.AssigneeID,
		Now:              timeNow().Format(time.DateTime),
	}
	rawQuery, err := sqltemplate.Execute(assignmentInsertTplt, req)
	if err != nil {
		return "", nil, fmt.Errorf("rendering sql template: %w", err)
	}
	return rawQuery, req.GetArgs(), nil
}

type insertPermissionTemplate struct {
	sqltemplate.SQLTemplate
	PermissionTable string
	RoleID          int64
	Permission      accesscontrol.Permission
	Now             string
}

func (t insertPermissionTemplate) Validate() error {
	return nil
}

func buildInsertPermissionQuery(dbHelper *legacysql.LegacyDatabaseHelper, roleID int64, permission accesscontrol.Permission) (string, []any, error) {
	req := insertPermissionTemplate{
		SQLTemplate:     sqltemplate.New(dbHelper.DialectForDriver()),
		PermissionTable: dbHelper.Table("permission"),
		RoleID:          roleID,
		Permission:      permission,
		Now:             timeNow().Format(time.DateTime),
	}
	rawQuery, err := sqltemplate.Execute(permissionInsertTplt, req)
	if err != nil {
		return "", nil, fmt.Errorf("rendering sql template: %w", err)
	}
	return rawQuery, req.GetArgs(), nil
}

// Update

// Delete
