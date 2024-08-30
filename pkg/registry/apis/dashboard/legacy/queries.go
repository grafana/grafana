package legacy

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
)

func mustTemplate(filename string) *template.Template {
	if t := sqlTemplates.Lookup(filename); t != nil {
		return t
	}
	panic(fmt.Sprintf("template file not found: %s", filename))
}

// Templates.
var (
	sqlQueryDashboards = mustTemplate("query_dashboards.sql")
	sqlQueryPanels     = mustTemplate("query_panels.sql")
)

type sqlQuery struct {
	sqltemplate.SQLTemplate
	Query *DashboardQuery

	DashboardTable    string
	VersionTable      string
	ProvisioningTable string
	UserTable         string
}

func (r sqlQuery) Validate() error {
	return nil // TODO
}

func newQueryReq(sql *legacysql.LegacyDatabaseHelper, query *DashboardQuery) sqlQuery {
	return sqlQuery{
		SQLTemplate: sqltemplate.New(sql.DialectForDriver()),
		Query:       query,

		DashboardTable:    sql.Table("dashboard"),
		VersionTable:      sql.Table("dashboard_version"),
		ProvisioningTable: sql.Table("dashboard_provisioning"),
		UserTable:         sql.Table("user"),
	}
}

type sqlLibraryQuery struct {
	sqltemplate.SQLTemplate
	Query *LibraryPanelQuery

	LibraryElementTable string
	UserTable           string
}

func (r sqlLibraryQuery) Validate() error {
	return nil // TODO
}

func newLibraryQueryReq(sql *legacysql.LegacyDatabaseHelper, query *LibraryPanelQuery) sqlLibraryQuery {
	return sqlLibraryQuery{
		SQLTemplate: sqltemplate.New(sql.DialectForDriver()),
		Query:       query,

		LibraryElementTable: sql.Table("library_element"),
		UserTable:           sql.Table("user"),
	}
}
