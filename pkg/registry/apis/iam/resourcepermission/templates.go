package resourcepermission

import (
	"embed"
	"fmt"
	"text/template"

	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

// Templates setup.
var (
	//go:embed *.sql
	sqlTemplatesFS embed.FS

	sqlTemplates = template.Must(template.New("sql").ParseFS(sqlTemplatesFS, `*.sql`))

	resourcePermissionsQueryTplt = mustTemplate("resource_permission_query.sql")
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
