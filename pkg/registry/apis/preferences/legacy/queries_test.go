package legacy

import (
	"testing"
	"text/template"

	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
)

func TestPreferencesQueries(t *testing.T) {
	// prefix tables with grafana
	nodb := &legacysql.LegacyDatabaseHelper{
		Table: func(n string) string {
			return "grafana." + n
		},
	}

	getPreferencesQuery := func(orgId int64, cb func(q *preferencesQuery)) sqltemplate.SQLTemplate {
		v := newPreferencesQueryReq(nodb, orgId)
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		cb(&v)
		return &v
	}

	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir:        "testdata",
		SQLTemplatesFS: sqlTemplatesFS,
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			sqlPreferencesQuery: {
				{
					Name:            "all-error",
					Data:            getPreferencesQuery(1, func(q *preferencesQuery) {}),
					ValidationError: "to list all preferences, explicitly set the .All flag",
				},
				{
					Name:            "missing-org",
					Data:            getPreferencesQuery(0, func(q *preferencesQuery) {}),
					ValidationError: "must include an orgID",
				},
				{
					Name: "missing-user",
					Data: getPreferencesQuery(1, func(q *preferencesQuery) {
						q.UserTeams = []string{"a"}
					}),
					ValidationError: "user required when filtering by a set of teams",
				},
				{
					Name: "all",
					Data: getPreferencesQuery(1, func(q *preferencesQuery) {
						q.All = true
					}),
				},
				{
					Name: "user-no-teams",
					Data: getPreferencesQuery(1, func(q *preferencesQuery) {
						q.UserUID = "uuu"
						q.UserTeams = []string{}
					}),
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
				{
					Name: "namespace",
					Data: getPreferencesQuery(1, func(q *preferencesQuery) {
						q.Namespace = true
					}),
				},
			},
			sqlPreferencesRV: {
				{
					Name: "get",
					Data: getPreferencesQuery(1, func(q *preferencesQuery) {
						q.All = true // avoid validation error
					}),
				},
			},
		},
	})
}
