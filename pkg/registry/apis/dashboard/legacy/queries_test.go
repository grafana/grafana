package legacy

import (
	"testing"
	"text/template"

	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

func TestQueries(t *testing.T) {
	sqltemplate.CheckQuerySnapshots(t, sqltemplate.TemplateTestSetup{
		RootDir: "testdata",
		Templates: map[*template.Template][]sqltemplate.TemplateTestCase{
			sqlQueryDashboards: {
				{
					Name: "history_uid",
					Data: &sqlQuery{
						SQLTemplate: new(sqltemplate.SQLTemplate),
						Query: &DashboardQuery{
							OrgID: 2,
							UID:   "UUU",
						},
					},
				},
				{
					Name: "history_uid_at_version",
					Data: &sqlQuery{
						SQLTemplate: new(sqltemplate.SQLTemplate),
						Query: &DashboardQuery{
							OrgID:   2,
							UID:     "UUU",
							Version: 3,
						},
					},
				},
				{
					Name: "history_uid_second_page",
					Data: &sqlQuery{
						SQLTemplate: new(sqltemplate.SQLTemplate),
						Query: &DashboardQuery{
							OrgID:  2,
							UID:    "UUU",
							LastID: 7,
						},
					},
				},
				{
					Name: "dashboard",
					Data: &sqlQuery{
						SQLTemplate: new(sqltemplate.SQLTemplate),
						Query: &DashboardQuery{
							OrgID: 2,
						},
					},
				},
				{
					Name: "dashboard_next_page",
					Data: &sqlQuery{
						SQLTemplate: new(sqltemplate.SQLTemplate),
						Query: &DashboardQuery{
							OrgID:  2,
							LastID: 22,
						},
					},
				},
			},
		},
	})
}
