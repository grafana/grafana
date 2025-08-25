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
	//go:embed *.sql queries/*.sql
	sqlTemplatesFS embed.FS

	sqlTemplates = template.Must(template.New("sql").ParseFS(sqlTemplatesFS, `*.sql`, `queries/*.sql`))

	resourcePermissionsQueryTplt = mustTemplate("resource_permission_query.sql")
	resourcePermissionInsertTplt = mustTemplate("resourcepermission_insert.sql")

	// Delete operation templates
	managedRolesQueryTplt            = mustTemplate("managed_roles_query.sql")
	permissionsDeleteTplt            = mustTemplate("permissions_delete.sql")
	roleDeleteTplt                   = mustTemplate("role_delete.sql")
	builtinRoleAssignmentsDeleteTplt = mustTemplate("builtin_role_assignments_delete.sql")
	userRoleAssignmentsDeleteTplt    = mustTemplate("user_role_assignments_delete.sql")
	teamRoleAssignmentsDeleteTplt    = mustTemplate("team_role_assignments_delete.sql")
)

func mustTemplate(filename string) *template.Template {
	if t := sqlTemplates.Lookup(filename); t != nil {
		return t
	}
	panic(fmt.Sprintf("template file not found: %s", filename))
}

type listResourcePermissionsQueryTemplate struct {
	sqltemplate.SQLTemplate
	Query           *ListResourcePermissionsQuery
	PermissionTable string
	RoleTable       string
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
		SQLTemplate:     sqltemplate.New(sql.DialectForDriver()),
		Query:           query,
		PermissionTable: sql.Table("permission"),
		RoleTable:       sql.Table("role"),
	}

	rawQuery, err := sqltemplate.Execute(resourcePermissionsQueryTplt, req)
	if err != nil {
		return "", nil, fmt.Errorf("execute template %q: %w", resourcePermissionsQueryTplt.Name(), err)
	}

	return rawQuery, req.GetArgs(), nil
}

type resourcePermissionInsertTemplate struct {
	sqltemplate.SQLTemplate
	PermissionTable     string
	RoleID              int64
	ResourcePermissions []resourcePermissionForInsert
	Now                 time.Time
}

type resourcePermissionForInsert struct {
	Action     string
	Scope      string
	Kind       string
	Attribute  string
	Identifier string
}

func (r resourcePermissionInsertTemplate) Validate() error {
	return nil
}

func buildResourcePermissionInsertQuery(dbHelper *legacysql.LegacyDatabaseHelper, permissions []accesscontrol.Permission, roleID int64) (string, []any, error) {
	// Convert to template format
	insertPermissions := make([]resourcePermissionForInsert, 0, len(permissions))
	for _, perm := range permissions {
		insertPermissions = append(insertPermissions, resourcePermissionForInsert{
			Action:     perm.Action,
			Scope:      perm.Scope,
			Kind:       perm.Kind,
			Attribute:  perm.Attribute,
			Identifier: perm.Identifier,
		})
	}

	req := resourcePermissionInsertTemplate{
		SQLTemplate:         sqltemplate.New(dbHelper.DialectForDriver()),
		PermissionTable:     dbHelper.Table("permission"),
		RoleID:              roleID,
		ResourcePermissions: insertPermissions,
		Now:                 time.Now(),
	}

	rawQuery, err := sqltemplate.Execute(resourcePermissionInsertTplt, req)
	if err != nil {
		return "", nil, err
	}

	return rawQuery, req.GetArgs(), nil
}

// Delete operation template structures

type managedRolesQueryTemplate struct {
	sqltemplate.SQLTemplate
	RoleTable       string
	OrgID           int64
	RoleDescription string
}

func (r managedRolesQueryTemplate) Validate() error {
	return nil
}

type permissionsDeleteTemplate struct {
	sqltemplate.SQLTemplate
	PermissionTable string
	RoleID          int64
}

func (r permissionsDeleteTemplate) Validate() error {
	return nil
}

type roleDeleteTemplate struct {
	sqltemplate.SQLTemplate
	RoleTable string
	RoleID    int64
	OrgID     int64
}

func (r roleDeleteTemplate) Validate() error {
	return nil
}

type builtinRoleAssignmentsDeleteTemplate struct {
	sqltemplate.SQLTemplate
	BuiltinRoleTable string
	RoleID           int64
	OrgID            int64
}

func (r builtinRoleAssignmentsDeleteTemplate) Validate() error {
	return nil
}

type userRoleAssignmentsDeleteTemplate struct {
	sqltemplate.SQLTemplate
	UserRoleTable string
	RoleID        int64
	OrgID         int64
}

func (r userRoleAssignmentsDeleteTemplate) Validate() error {
	return nil
}

type teamRoleAssignmentsDeleteTemplate struct {
	sqltemplate.SQLTemplate
	TeamRoleTable string
	RoleID        int64
	OrgID         int64
}

func (r teamRoleAssignmentsDeleteTemplate) Validate() error {
	return nil
}
