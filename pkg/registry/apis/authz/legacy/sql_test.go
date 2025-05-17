package legacy

import (
	"testing"
	"text/template"

	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
)

func TestIdentityQueries(t *testing.T) {
	// prefix tables with grafana
	nodb := &legacysql.LegacyDatabaseHelper{
		Table: func(n string) string {
			return "grafana." + n
		},
	}

	listRoles := func(q *ListRolesQuery) sqltemplate.SQLTemplate {
		v := newListRoles(nodb, q)
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir:        "testdata",
		SQLTemplatesFS: sqlTemplatesFS,
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			sqlQueryRolesTemplate: {
				{
					Name: "roles__uid",
					Data: listRoles(&ListRolesQuery{
						UID:        "abc",
						Pagination: common.Pagination{Limit: 1},
					}),
				},
				{
					Name: "roles_page_1",
					Data: listRoles(&ListRolesQuery{
						Pagination: common.Pagination{Limit: 5},
					}),
				},
				{
					Name: "roles_page_2",
					Data: listRoles(&ListRolesQuery{
						Pagination: common.Pagination{
							Limit:    1,
							Continue: 2,
						},
					}),
				},
			},
		},
	})
}
