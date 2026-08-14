package migrator

import (
	"testing"
	"text/template"

	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
)

func TestQueryCacheConfigQueries(t *testing.T) {
	// prefix tables with grafana
	nodb := &legacysql.LegacyDatabaseHelper{
		Table: func(n string) string {
			return "grafana." + n
		},
	}

	getQueryCacheConfigQuery := func(q *queryCacheConfigQuery) sqltemplate.SQLTemplate {
		v := newQueryReq(nodb, q)
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir:        "testdata",
		SQLTemplatesFS: sqlTemplatesFS,
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			sqlQueryCacheConfigs: {
				{
					Name: "list",
					Data: getQueryCacheConfigQuery(&queryCacheConfigQuery{
						OrgID: 1,
					}),
				},
				{
					Name: "last-id",
					Data: getQueryCacheConfigQuery(&queryCacheConfigQuery{
						OrgID:  1,
						LastID: 5,
					}),
				},
				{
					Name: "limit",
					Data: getQueryCacheConfigQuery(&queryCacheConfigQuery{
						OrgID: 1,
						Limit: 10,
					}),
				},
				{
					Name: "all",
					Data: getQueryCacheConfigQuery(&queryCacheConfigQuery{
						OrgID:  1,
						LastID: 5,
						Limit:  10,
					}),
				},
			},
		},
	})
}
