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
	sqlStarsQuery       = mustTemplate("sql_stars_query.sql")
	sqlStarsRV          = mustTemplate("sql_stars_rv.sql")
	sqlPreferencesQuery = mustTemplate("sql_preferences_query.sql")
	sqlPreferencesRV    = mustTemplate("sql_preferences_rv.sql")
)

type starQuery struct {
	sqltemplate.SQLTemplate

	OrgID   int64 // >= 1 if UserID != ""
	UserUID string

	StarTable string
	UserTable string
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

		StarTable: sql.Table("star"),
		UserTable: sql.Table("user"),
	}
}

type preferencesQuery struct {
	sqltemplate.SQLTemplate

	OrgID   int64 // required
	UserUID string
	TeamUID string
	Teams   []string // also requires user UID

	UserTable        string
	TeamTable        string
	PreferencesTable string
}

func (r preferencesQuery) Validate() error {
	if r.OrgID < 1 {
		return fmt.Errorf("must include an orgID")
	}
	return nil
}

func newPreferencesQueryReq(sql *legacysql.LegacyDatabaseHelper, user string, orgId int64) preferencesQuery {
	return preferencesQuery{
		SQLTemplate: sqltemplate.New(sql.DialectForDriver()),

		UserUID: user,
		OrgID:   orgId,

		PreferencesTable: sql.Table("preferences"),
		UserTable:        sql.Table("user"),
		TeamTable:        sql.Table("team"),
	}
}
