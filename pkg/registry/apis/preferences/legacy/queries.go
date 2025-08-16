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
	sqlStarsQuery = mustTemplate("stars_query.sql")
	sqlStarsRV    = mustTemplate("stars_rv.sql")
)

type sqlQuery struct {
	sqltemplate.SQLTemplate

	OrgID   int64 // >= 1 if UserID != ""
	UserUID string

	StarTable string
	UserTable string
	TeamTable string
}

func (r sqlQuery) Validate() error {
	if r.UserUID != "" && r.OrgID < 1 {
		return fmt.Errorf("requests with a userid, must include an orgID")
	}
	return nil
}

func newQueryReq(sql *legacysql.LegacyDatabaseHelper, user string, orgId int64) sqlQuery {
	return sqlQuery{
		SQLTemplate: sqltemplate.New(sql.DialectForDriver()),

		UserUID: user,
		OrgID:   orgId,

		StarTable: sql.Table("star"),
		UserTable: sql.Table("user"),
		TeamTable: sql.Table("team"),
	}
}
