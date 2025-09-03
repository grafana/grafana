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
	sqlStarsDelete      = mustTemplate("sql_stars_delete.sql")
	sqlPreferencesQuery = mustTemplate("sql_preferences_query.sql")
	sqlPreferencesRV    = mustTemplate("sql_preferences_rv.sql")
	sqlTeams            = mustTemplate("sql_teams.sql")
)

type starQuery struct {
	sqltemplate.SQLTemplate

	OrgID   int64 // >= 1 if UserID != ""
	UserUID string

	StarTable string
	UserTable string

	// For Create/Update
	Dashboards []string

	// For Delete
	IDsForDelete []int64
}

func (r starQuery) Validate() error {
	if r.UserUID != "" && r.OrgID < 1 {
		return fmt.Errorf("requests with a userid, must include an orgID")
	}
	if len(r.Dashboards) > 0 && len(r.IDsForDelete) > 0 {
		return fmt.Errorf("dashboards and delete should not both be set")
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

	OrgID     int64 // required
	UserUID   string
	UserTeams []string // also requires user UID
	TeamUID   string

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

type teamQuery struct {
	sqltemplate.SQLTemplate

	OrgID   int64
	UserUID string
	IsAdmin bool

	TeamMemberTable string
	TeamTable       string
	UserTable       string
}

func (r teamQuery) Validate() error {
	if r.UserUID != "" && r.OrgID < 1 {
		return fmt.Errorf("requests with a userid, must include an orgID")
	}
	return nil
}

func newTeamsQueryReq(sql *legacysql.LegacyDatabaseHelper, orgId int64, user string, admin bool) teamQuery {
	return teamQuery{
		SQLTemplate: sqltemplate.New(sql.DialectForDriver()),

		OrgID:   orgId,
		UserUID: user,
		IsAdmin: admin,

		TeamMemberTable: sql.Table("team_member"),
		TeamTable:       sql.Table("team"),
		UserTable:       sql.Table("user"),
	}
}
