package legacy

import (
	"testing"
	"text/template"

	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
)

func TestQueries(t *testing.T) {
	userTableValue := "grafana.user"
	teamTableValue := "grafana.team"
	orgUserTableValue := "grafana.org_user"

	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir: "testdata",
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			sqlQueryTeams: {
				{
					Name: "teams_uid",
					Data: &sqlQueryListTeams{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Query: &ListTeamQuery{
							UID: "abc",
						},
						TeamTable: teamTableValue,
					},
				},
				{
					Name: "teams_page_1",
					Data: &sqlQueryListTeams{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Query: &ListTeamQuery{
							Limit: 5,
						},
						TeamTable: teamTableValue,
					},
				},
				{
					Name: "teams_page_2",
					Data: &sqlQueryListTeams{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Query: &ListTeamQuery{
							ContinueID: 1,
							Limit:      2,
						},
						TeamTable: teamTableValue,
					},
				},
			},
			sqlQueryUsers: {
				{
					Name: "users_uid",
					Data: &sqlQueryListUsers{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Query: &ListUserQuery{
							UID: "abc",
						},
						UserTable:    userTableValue,
						OrgUserTable: orgUserTableValue,
					},
				},
				{
					Name: "users_page_1",
					Data: &sqlQueryListUsers{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Query: &ListUserQuery{
							Limit: 5,
						},
						UserTable:    userTableValue,
						OrgUserTable: orgUserTableValue,
					},
				},
				{
					Name: "users_page_2",
					Data: &sqlQueryListUsers{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Query: &ListUserQuery{
							ContinueID: 1,
							Limit:      2,
						},
						UserTable:    userTableValue,
						OrgUserTable: orgUserTableValue,
					},
				},
			},
			sqlQueryDisplay: {
				{
					Name: "display_uids",
					Data: &sqlQueryGetDisplay{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Query: &GetUserDisplayQuery{
							OrgID: 2,
							UIDs:  []string{"a", "b"},
						},
						UserTable:    userTableValue,
						OrgUserTable: orgUserTableValue,
					},
				},
				{
					Name: "display_ids",
					Data: &sqlQueryGetDisplay{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Query: &GetUserDisplayQuery{
							OrgID: 2,
							IDs:   []int64{1, 2},
						},
						UserTable:    userTableValue,
						OrgUserTable: orgUserTableValue,
					},
				},
				{
					Name: "display_ids_uids",
					Data: &sqlQueryGetDisplay{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Query: &GetUserDisplayQuery{
							OrgID: 2,
							UIDs:  []string{"a", "b"},
							IDs:   []int64{1, 2},
						},
						UserTable:    userTableValue,
						OrgUserTable: orgUserTableValue,
					},
				},
			},
		},
	})
}
