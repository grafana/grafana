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

	getQuery := func(user string, orgId int64) sqltemplate.SQLTemplate {
		v := newQueryReq(nodb, user, orgId)
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
					Data: getQuery("", 0),
				},
				{
					Name: "org",
					Data: getQuery("", 3),
				},
				{
					Name: "user",
					Data: getQuery("abc", 3),
				},
			},
			sqlStarsRV: {
				{
					Name: "get",
					Data: getQuery("", 0),
				},
			},
		},
	})
}
