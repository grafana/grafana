package legacy

import (
	"testing"
	"text/template"

	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
)

func TestQueries(t *testing.T) {
	// prefix tables with grafana
	nodb := &legacysql.LegacyDatabaseHelper{
		Table: func(n string) string {
			return "grafana." + n
		},
	}

	getQuery := func(orgId int64, uid string, dsuids []string) sqltemplate.SQLTemplate {
		v := newCorrelationsQueryReq(nodb, orgId)
		v.CorrelationUID = uid
		v.SourceUIDs = dsuids
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir:        "testdata",
		SQLTemplatesFS: sqlTemplatesFS,
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			sqlQuery: {
				{
					Name: "all",
					Data: getQuery(1, "", nil),
				},
				{
					Name: "single",
					Data: getQuery(1, "xxx", nil),
				},
				{
					Name: "source uid",
					Data: getQuery(1, "", []string{"a"}),
				},
				{
					Name: "source uids",
					Data: getQuery(1, "", []string{"a", "b"}),
				},
			},
		},
	})
}
