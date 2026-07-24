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
	sqlPreferencesQuery = mustTemplate("sql_preferences_query.sql")
	sqlPreferencesRV    = mustTemplate("sql_preferences_rv.sql")
)

type preferencesQuery struct {
	sqltemplate.SQLTemplate

	OrgID     int64 // required
	UserUID   string
	UserTeams []string // also requires user UID
	TeamUID   string
	All       bool // explicitly request all preferences
	Namespace bool // get the org preferences

	UserTable        string
	TeamTable        string
	PreferencesTable string
}

func (r preferencesQuery) CheckTeams() bool {
	return r.UserTeams != nil
}

func (r preferencesQuery) HasTeams() bool {
	return len(r.UserTeams) > 0
}

func (r preferencesQuery) Validate() error {
	if r.OrgID < 1 {
		return fmt.Errorf("must include an orgID")
	}
	if len(r.UserTeams) > 0 && r.UserUID == "" {
		return fmt.Errorf("user required when filtering by a set of teams")
	}
	if r.UserUID == "" && r.TeamUID == "" {
		if r.All || r.Namespace {
			return nil // OK
		}
		return fmt.Errorf("to list all preferences, explicitly set the .All flag")
	}
	return nil
}

func newPreferencesQueryReq(sql *legacysql.LegacyDatabaseHelper, orgId int64) preferencesQuery {
	return preferencesQuery{
		SQLTemplate: sqltemplate.New(sql.DialectForDriver()),

		OrgID: orgId,

		PreferencesTable: sql.Table("preferences"),
		UserTable:        sql.Table("user"),
		TeamTable:        sql.Table("team"),
	}
}
