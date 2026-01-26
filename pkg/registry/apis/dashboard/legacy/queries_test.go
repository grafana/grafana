package legacy

import (
	"testing"
	"text/template"

	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
)

func TestDashboardQueries(t *testing.T) {
	// prefix tables with grafana
	nodb := &legacysql.LegacyDatabaseHelper{
		Table: func(n string) string {
			return "grafana." + n
		},
	}

	getQuery := func(q *DashboardQuery) sqltemplate.SQLTemplate {
		v := newQueryReq(nodb, q)
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	getLibraryQuery := func(q *LibraryPanelQuery) sqltemplate.SQLTemplate {
		v := newLibraryQueryReq(nodb, q)
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	getPlaylistQuery := func(q *PlaylistQuery) sqltemplate.SQLTemplate {
		v := newPlaylistQueryReq(nodb, q)
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir:        "testdata",
		SQLTemplatesFS: sqlTemplatesFS,
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			sqlQueryDashboards: {
				{
					Name: "history_uid",
					Data: getQuery(&DashboardQuery{
						OrgID: 2,
						UID:   "UUU",
					}),
				},
				{
					Name: "history_uid_at_version",
					Data: getQuery(&DashboardQuery{
						OrgID:   2,
						UID:     "UUU",
						Version: 3,
					}),
				},
				{
					Name: "history_uid_second_page",
					Data: getQuery(&DashboardQuery{
						OrgID:  2,
						UID:    "UUU",
						LastID: 7,
					}),
				},
				{
					Name: "dashboard",
					Data: getQuery(&DashboardQuery{
						OrgID: 2,
					}),
				},
				{
					Name: "dashboard_next_page",
					Data: getQuery(&DashboardQuery{
						OrgID:  2,
						LastID: 22,
					}),
				},
				{
					Name: "folders",
					Data: getQuery(&DashboardQuery{
						OrgID:      2,
						GetFolders: true,
					}),
				},
				{
					Name: "export_with_history",
					Data: getQuery(&DashboardQuery{
						OrgID:      1,
						GetHistory: true,
						Order:      "ASC",
					}),
				},
				{
					Name: "migration_with_fallback",
					Data: getQuery(&DashboardQuery{
						OrgID:         1,
						GetHistory:    true,
						AllowFallback: true,
						Order:         "ASC",
					}),
				},
				{
					// Tests that MaxRows generates LIMIT clause for regular dashboard queries
					Name: "dashboard_with_max_rows",
					Data: getQuery(&DashboardQuery{
						OrgID:   2,
						MaxRows: 100,
					}),
				},
				{
					// Tests that MaxRows generates LIMIT clause for history queries
					Name: "history_with_max_rows",
					Data: getQuery(&DashboardQuery{
						OrgID:      1,
						GetHistory: true,
						MaxRows:    50,
					}),
				},
				{
					// Tests that MaxRows + LastID generates correct pagination query
					Name: "dashboard_with_max_rows_last_id",
					Data: getQuery(&DashboardQuery{
						OrgID:   2,
						MaxRows: 100,
						LastID:  500,
					}),
				},
				{
					// Tests that MaxRows + LastID generates correct pagination query
					Name: "history_with_max_rows_last_id",
					Data: getQuery(&DashboardQuery{
						OrgID:      2,
						MaxRows:    100,
						GetHistory: true,
						LastID:     500,
					}),
				},
			},
			sqlQueryPanels: {
				{
					Name: "list",
					Data: getLibraryQuery(&LibraryPanelQuery{
						OrgID: 1,
						Limit: 5,
					}),
				},
				{
					Name: "list_page_two",
					Data: getLibraryQuery(&LibraryPanelQuery{
						OrgID:  1,
						LastID: 4,
					}),
				},
				{
					Name: "get_uid",
					Data: getLibraryQuery(&LibraryPanelQuery{
						OrgID: 1,
						UID:   "xyz",
					}),
				},
			},
			sqlQueryPlaylists: {
				{
					Name: "list",
					Data: getPlaylistQuery(&PlaylistQuery{
						OrgID: 1,
					}),
				},
			},
		},
	})
}
