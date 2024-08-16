package legacy

import (
	"testing"
	"text/template"

	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
)

func TestQueries(t *testing.T) {
	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir: "testdata",
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			sqlQueryTeams: {
				{
					Name: "teams_uid",
					Data: &sqlQueryListTeams{
						SQLTemplateIface: mocks.NewTestingSQLTemplate(),
						Query: &ListTeamQuery{
							UID: "abc",
						},
					},
				},
				{
					Name: "teams_page_1",
					Data: &sqlQueryListTeams{
						SQLTemplateIface: mocks.NewTestingSQLTemplate(),
						Query: &ListTeamQuery{
							Limit: 5,
						},
					},
				},
				{
					Name: "teams_page_2",
					Data: &sqlQueryListTeams{
						SQLTemplateIface: mocks.NewTestingSQLTemplate(),
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
						SQLTemplateIface: mocks.NewTestingSQLTemplate(),
						Query: &ListUserQuery{
							UID: "abc",
						},
					},
				},
				{
					Name: "users_page_1",
					Data: &sqlQueryListUsers{
						SQLTemplateIface: mocks.NewTestingSQLTemplate(),
						Query: &ListUserQuery{
							Limit: 5,
						},
					},
				},
				{
					Name: "users_page_2",
					Data: &sqlQueryListUsers{
						SQLTemplateIface: mocks.NewTestingSQLTemplate(),
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
						SQLTemplateIface: mocks.NewTestingSQLTemplate(),
						Query: &GetUserDisplayQuery{
							OrgID: 2,
							UIDs:  []string{"a", "b"},
						},
					},
				},
				{
					Name: "display_ids",
					Data: &sqlQueryGetDisplay{
						SQLTemplateIface: mocks.NewTestingSQLTemplate(),
						Query: &GetUserDisplayQuery{
							OrgID: 2,
							IDs:   []int64{1, 2},
						},
					},
				},
				{
					Name: "display_ids_uids",
					Data: &sqlQueryGetDisplay{
						SQLTemplateIface: mocks.NewTestingSQLTemplate(),
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
