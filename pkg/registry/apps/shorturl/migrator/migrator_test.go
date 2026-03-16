package migrator

import (
	"testing"
	"text/template"

	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
)

func TestShortURLQueries(t *testing.T) {
	// prefix tables with grafana
	nodb := &legacysql.LegacyDatabaseHelper{
		Table: func(n string) string {
			return "grafana." + n
		},
	}

	getShortURLQuery := func(q *ShortURLQuery) sqltemplate.SQLTemplate {
		v := newShortURLQueryReq(nodb, q)
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir:        "testdata",
		SQLTemplatesFS: shortURLSQLTemplatesFS,
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			sqlQueryShortURLs: {
				{
					Name: "list",
					Data: getShortURLQuery(&ShortURLQuery{
						OrgID: 1,
					}),
				},
			},
		},
	})
}
