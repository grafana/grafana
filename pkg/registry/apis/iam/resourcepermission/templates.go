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
	//go:embed *.sql
	sqlTemplatesFS embed.FS

	sqlTemplates = template.Must(template.New("sql").ParseFS(sqlTemplatesFS, `*.sql`))

	resourcePermissionsQueryTplt = mustTemplate("resource_permission_query.sql")
	resourcePermissionInsertTplt = mustTemplate("resourcepermission_insert.sql")
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
