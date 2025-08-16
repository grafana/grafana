package legacy

import (
	"testing"
	"text/template"

	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
)

func TestStarsQueries(t *testing.T) {
	// prefix tables with grafana
	nodb := &legacysql.LegacyDatabaseHelper{
		Table: func(n string) string {
			return "grafana." + n
		},
	}

	getStarQuery := func(orgId int64, user string) sqltemplate.SQLTemplate {
		v := newStarQueryReq(nodb, user, orgId)
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	getPreferencesQuery := func(orgId int64, cb func(q *preferencesQuery)) sqltemplate.SQLTemplate {
		v := newPreferencesQueryReq(nodb, orgId)
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		cb(&v)
		return &v
	}

	getTeamQuery := func(orgId int64, user string, admin bool) sqltemplate.SQLTemplate {
		v := newTeamsQueryReq(nodb, orgId, user, admin)
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir:        "testdata",
		SQLTemplatesFS: sqlTemplatesFS,
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			sqlStarsQuery: {
				{
					Name: "all",
					Data: getStarQuery(0, ""),
				},
				{
					Name: "org",
					Data: getStarQuery(3, ""),
				},
				{
					Name: "user",
					Data: getStarQuery(3, "abc"),
				},
			},
			sqlStarsRV: {
				{
					Name: "get",
					Data: getStarQuery(0, ""),
				},
			},
			sqlPreferencesQuery: {
				{
					Name: "all",
					Data: getPreferencesQuery(1, func(q *preferencesQuery) {}),
				},
				{
					Name: "current", // user + user teams
					Data: getPreferencesQuery(1, func(q *preferencesQuery) {
						q.UserUID = "uuu"
						q.UserTeams = []string{"a", "b", "c"}
					}),
				},
				{
					Name: "user",
					Data: getPreferencesQuery(1, func(q *preferencesQuery) {
						q.UserUID = "uuu"
					}),
				},
				{
					Name: "team",
					Data: getPreferencesQuery(1, func(q *preferencesQuery) {
						q.TeamUID = "ttt"
					}),
				},
			},
			sqlPreferencesRV: {
				{
					Name: "get",
					Data: getPreferencesQuery(1, func(q *preferencesQuery) {}),
				},
			},
			sqlTeams: {
				{
					Name: "members",
					Data: getTeamQuery(1, "uuu", false),
				},
				{
					Name: "admin",
					Data: getTeamQuery(1, "uuu", true),
				},
			},
		},
	})
}
