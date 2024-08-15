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
			sqlQueryTeams: {
				{
					Name: "teams_uid",
					Data: &sqlQueryListTeams{
						SQLTemplate: new(sqltemplate.SQLTemplate),
						Query: &ListTeamQuery{
							UID: "abc",
						},
					},
				},
				{
					Name: "teams_page_1",
					Data: &sqlQueryListTeams{
						SQLTemplate: new(sqltemplate.SQLTemplate),
						Query: &ListTeamQuery{
							Limit: 5,
						},
					},
				},
				{
					Name: "teams_page_2",
					Data: &sqlQueryListTeams{
						SQLTemplate: new(sqltemplate.SQLTemplate),
						Query: &ListTeamQuery{
							ContinueID: 1,
							Limit:      2,
						},
					},
				},
			},
			sqlQueryUsers: {
				{
					Name: "users_uid",
					Data: &sqlQueryListUsers{
						SQLTemplate: new(sqltemplate.SQLTemplate),
						Query: &ListUserQuery{
							UID: "abc",
						},
					},
				},
				{
					Name: "users_page_1",
					Data: &sqlQueryListUsers{
						SQLTemplate: new(sqltemplate.SQLTemplate),
						Query: &ListUserQuery{
							Limit: 5,
						},
					},
				},
				{
					Name: "users_page_2",
					Data: &sqlQueryListUsers{
						SQLTemplate: new(sqltemplate.SQLTemplate),
						Query: &ListUserQuery{
							ContinueID: 1,
							Limit:      2,
						},
					},
				},
			},
			sqlQueryDisplay: {
				{
					Name: "display_uids",
					Data: &sqlQueryGetDisplay{
						SQLTemplate: new(sqltemplate.SQLTemplate),
						Query: &GetUserDisplayQuery{
							OrgID: 2,
							UIDs:  []string{"a", "b"},
						},
					},
				},
				{
					Name: "display_ids",
					Data: &sqlQueryGetDisplay{
						SQLTemplate: new(sqltemplate.SQLTemplate),
						Query: &GetUserDisplayQuery{
							OrgID: 2,
							IDs:   []int64{1, 2},
						},
					},
				},
				{
					Name: "display_ids_uids",
					Data: &sqlQueryGetDisplay{
						SQLTemplate: new(sqltemplate.SQLTemplate),
						Query: &GetUserDisplayQuery{
							OrgID: 2,
							UIDs:  []string{"a", "b"},
							IDs:   []int64{1, 2},
						},
					},
				},
			},
		},
	})
}
