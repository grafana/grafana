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
	sqlDashboardStarsQuery = mustTemplate("sql_dashboard_stars.sql")
	sqlDashboardStarsRV    = mustTemplate("sql_dashboard_stars_rv.sql")
)

type starQuery struct {
	sqltemplate.SQLTemplate

	OrgID     int64 // >= 1 if UserID != ""
	UserUID   string
	UserID    int64 // for stars
	QueryUIDs []string
	QueryUID  string

	StarTable              string
	UserTable              string
	QueryHistoryStarsTable string
	QueryHistoryTable      string
}

func (r starQuery) Validate() error {
	if r.UserUID != "" && r.OrgID < 1 {
		return fmt.Errorf("requests with a userid, must include an orgID")
	}
	return nil
}

func newStarQueryReq(sql *legacysql.LegacyDatabaseHelper, user string, orgId int64) starQuery {
	return starQuery{
		SQLTemplate: sqltemplate.New(sql.DialectForDriver()),

		UserUID: user,
		OrgID:   orgId,

		StarTable:              sql.Table("star"),
		UserTable:              sql.Table("user"),
		QueryHistoryStarsTable: sql.Table("query_history_star"),
		QueryHistoryTable:      sql.Table("query_history"),
	}
}
