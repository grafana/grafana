package legacy

import (
	"embed"
	"fmt"
	"text/template"
	"time"

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
	sqlDeletePanel     = mustTemplate("delete_panel.sql")
	sqlCreatePanel     = mustTemplate("create_panel.sql")
	sqlUpdatePanel     = mustTemplate("update_panel.sql")
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
	if r.Query.Order == "ASC" && r.Query.LastID > 0 {
		return fmt.Errorf("ascending order does not support paging by last id")
	}
	return nil // TODO
}

func newQueryReq(sql *legacysql.LegacyDatabaseHelper, query *DashboardQuery) sqlQuery {
	if query.Order == "" {
		query.Order = "DESC" // use version as RV
	}
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

type sqlSavePanelQuery struct {
	sqltemplate.SQLTemplate
	Query *SavePanelQuery

	LibraryElementTable string
	UserTable           string
}

type SavePanelQuery struct {
	OrgID       int64
	FolderID    int64
	FolderUID   string
	UID         string
	Name        string
	Kind        int64
	Type        string
	Description string
	Model       []byte
	Version     int64
	Created     time.Time
	CreatedBy   string
	Updated     time.Time
	UpdatedBy   string
}

func newSavePanelQueryReq(sql *legacysql.LegacyDatabaseHelper, query *SavePanelQuery) sqlSavePanelQuery {
	return sqlSavePanelQuery{
		SQLTemplate: sqltemplate.New(sql.DialectForDriver()),
		Query:       query,

		LibraryElementTable: sql.Table("library_element"),
		UserTable:           sql.Table("user"),
	}
}
