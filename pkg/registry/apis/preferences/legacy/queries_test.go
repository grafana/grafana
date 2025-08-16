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

	getStarQuery := func(user string, orgId int64) sqltemplate.SQLTemplate {
		v := newStarQueryReq(nodb, user, orgId)
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	getPreferencesQuery := func(user string, orgId int64) sqltemplate.SQLTemplate {
		v := newPreferencesQueryReq(nodb, user, orgId)
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
					Data: getStarQuery("", 0),
				},
				{
					Name: "org",
					Data: getStarQuery("", 3),
				},
				{
					Name: "user",
					Data: getStarQuery("abc", 3),
				},
			},
			sqlStarsRV: {
				{
					Name: "get",
					Data: getStarQuery("", 0),
				},
			},
			sqlPreferencesQuery: {
				{
					Name: "all",
					Data: getPreferencesQuery("", 1),
				},
			},
			sqlPreferencesRV: {
				{
					Name: "get",
					Data: getPreferencesQuery("", 1),
				},
			},
		},
	})
}
