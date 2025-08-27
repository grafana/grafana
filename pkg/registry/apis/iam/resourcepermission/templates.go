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

	roleInsertTplt       = mustTemplate("role_insert.sql")
	assignmentInsertTplt = mustTemplate("assignment_insert.sql")
	permissionDeleteTplt = mustTemplate("permission_delete.sql")
	permissionInsertTplt = mustTemplate("permissions_insert.sql")
)

func mustTemplate(filename string) *template.Template {
	if t := sqlTemplates.Lookup(filename); t != nil {
		return t
	}
	panic(fmt.Sprintf("template file not found: %s", filename))
}

// List

// Get

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
		Now:         time.Now().Format(time.DateTime),
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
		AssignmentTable:  assignment.AssignmentTable,
		AssignmentColumn: assignment.AssignmentColumn,
		RoleID:           roleID,
		OrgID:            orgID,
		AssigneeID:       assignment.AssigneeID,
		Now:              time.Now().Format(time.DateTime),
	}
	rawQuery, err := sqltemplate.Execute(assignmentInsertTplt, req)
	if err != nil {
		return "", nil, fmt.Errorf("rendering sql template: %w", err)
	}
	return rawQuery, req.GetArgs(), nil
}

type deletePermissionTemplate struct {
	sqltemplate.SQLTemplate
	PermissionTable string
	RoleID          int64
	Scope           string
}

func (t deletePermissionTemplate) Validate() error {
	return nil
}

func buildDeletePermissionQuery(dbHelper *legacysql.LegacyDatabaseHelper, roleID int64, scope string) (string, []any, error) {
	req := deletePermissionTemplate{
		SQLTemplate:     sqltemplate.New(dbHelper.DialectForDriver()),
		PermissionTable: dbHelper.Table("permission"),
		RoleID:          roleID,
		Scope:           scope,
	}
	rawQuery, err := sqltemplate.Execute(permissionDeleteTplt, req)
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
	}
	rawQuery, err := sqltemplate.Execute(permissionInsertTplt, req)
	if err != nil {
		return "", nil, fmt.Errorf("rendering sql template: %w", err)
	}
	return rawQuery, req.GetArgs(), nil
}

// Update

// Delete
