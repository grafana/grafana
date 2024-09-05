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

	getDisplay := func(q *ListDisplayQuery) sqltemplate.SQLTemplate {
		v := newListDisplay(nodb, q)
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	listUsers := func(q *ListUserQuery) sqltemplate.SQLTemplate {
		v := newListUser(nodb, q)
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	listTeams := func(q *ListTeamQuery) sqltemplate.SQLTemplate {
		v := newListTeams(nodb, q)
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	listTeamBindings := func(q *ListTeamBindingsQuery) sqltemplate.SQLTemplate {
		v := newListTeamBindings(nodb, q)
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	listTeamMembers := func(q *ListTeamMembersQuery) sqltemplate.SQLTemplate {
		v := newListTeamMembers(nodb, q)
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	listUserTeams := func(q *ListUserTeamsQuery) sqltemplate.SQLTemplate {
		v := newListUserTeams(nodb, q)
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir: "testdata",
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			sqlQueryTeamsTemplate: {
				{
					Name: "teams_uid",
					Data: listTeams(&ListTeamQuery{
						UID:        "abc",
						Pagination: common.Pagination{Limit: 1},
					}),
				},
				{
					Name: "teams_page_1",
					Data: listTeams(&ListTeamQuery{
						Pagination: common.Pagination{Limit: 5},
					}),
				},
				{
					Name: "teams_page_2",
					Data: listTeams(&ListTeamQuery{
						Pagination: common.Pagination{
							Limit:    1,
							Continue: 2,
						},
					}),
				},
			},
			sqlQueryUsersTemplate: {
				{
					Name: "users_uid",
					Data: listUsers(&ListUserQuery{
						UID:        "abc",
						Pagination: common.Pagination{Limit: 1},
					}),
				},
				{
					Name: "users_page_1",
					Data: listUsers(&ListUserQuery{
						Pagination: common.Pagination{Limit: 5},
					}),
				},
				{
					Name: "users_page_2",
					Data: listUsers(&ListUserQuery{
						Pagination: common.Pagination{
							Limit:    1,
							Continue: 2,
						},
					}),
				},
			},
			sqlQueryDisplayTemplate: {
				{
					Name: "display_uids",
					Data: getDisplay(&ListDisplayQuery{
						OrgID: 2,
						UIDs:  []string{"a", "b"},
					}),
				},
				{
					Name: "display_ids",
					Data: getDisplay(&ListDisplayQuery{
						OrgID: 2,
						IDs:   []int64{1, 2},
					}),
				},
				{
					Name: "display_ids_uids",
					Data: getDisplay(&ListDisplayQuery{
						OrgID: 2,
						UIDs:  []string{"a", "b"},
						IDs:   []int64{1, 2},
					}),
				},
			},
			sqlQueryTeamBindingsTemplate: {
				{
					Name: "team_1_bindings",
					Data: listTeamBindings(&ListTeamBindingsQuery{
						OrgID:      1,
						UID:        "team-1",
						Pagination: common.Pagination{Limit: 1},
					}),
				},
				{
					Name: "team_bindings_page_1",
					Data: listTeamBindings(&ListTeamBindingsQuery{
						OrgID:      1,
						Pagination: common.Pagination{Limit: 5},
					}),
				},
				{
					Name: "team_bindings_page_2",
					Data: listTeamBindings(&ListTeamBindingsQuery{
						OrgID: 1,
						Pagination: common.Pagination{
							Limit:    1,
							Continue: 2,
						},
					}),
				},
			},
			sqlQueryTeamMembersTemplate: {
				{
					Name: "team_1_members_page_1",
					Data: listTeamMembers(&ListTeamMembersQuery{
						UID:        "team-1",
						OrgID:      1,
						Pagination: common.Pagination{Limit: 1},
					}),
				},
				{
					Name: "team_1_members_page_2",
					Data: listTeamMembers(&ListTeamMembersQuery{
						UID:        "team-1",
						OrgID:      1,
						Pagination: common.Pagination{Limit: 1, Continue: 2},
					}),
				},
			},
			sqlQueryUserTeamsTemplate: {
				{
					Name: "team_1_members_page_1",
					Data: listUserTeams(&ListUserTeamsQuery{
						UserUID:    "user-1",
						OrgID:      1,
						Pagination: common.Pagination{Limit: 1},
					}),
				},
				{
					Name: "team_1_members_page_2",
					Data: listUserTeams(&ListUserTeamsQuery{
						UserUID:    "user-1",
						OrgID:      1,
						Pagination: common.Pagination{Limit: 1, Continue: 2},
					}),
				},
			},
		},
	})
}
