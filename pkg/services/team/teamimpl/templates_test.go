package teamimpl

import (
	"testing"
	"text/template"

	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
)

func TestTeamQueryTemplates(t *testing.T) {
	// Qualified identifiers prove that .Ident quotes schema-qualified names.
	dbHelper := &legacysql.LegacyDatabaseHelper{
		Table: func(name string) string {
			return "test_schema." + name
		},
	}

	teamTable := dbHelper.Table("team")
	teamMemberTable := dbHelper.Table("team_member")
	userTable := dbHelper.Table("user")
	dashboardACLTable := dbHelper.Table("dashboard_acl")

	newT := func() sqltemplate.SQLTemplate { return mocks.NewTestingSQLTemplate() }

	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir:        "testdata",
		SQLTemplatesFS: sqlTemplatesFS,
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			searchTeamsTemplate: {
				{
					Name: "minimal",
					Data: searchTeamsQuery{
						SQLTemplate:     newT(),
						TeamTable:       teamTable,
						TeamMemberTable: teamMemberTable,
						UserTable:       userTable,
						ACFilterWhere:   " (1 = 1)",
						OrderBy:         " order by team.name asc",
					},
				},
				{
					Name: "hidden_users",
					Data: searchTeamsQuery{
						SQLTemplate:     newT(),
						TeamTable:       teamTable,
						TeamMemberTable: teamMemberTable,
						UserTable:       userTable,
						FilteredUsers:   []string{"userLogin1", "userLogin2"},
						ACFilterWhere:   " (1 = 1)",
						OrderBy:         " order by team.name asc",
					},
				},
				{
					Name: "all_filters",
					Data: searchTeamsQuery{
						SQLTemplate:     newT(),
						TeamTable:       teamTable,
						TeamMemberTable: teamMemberTable,
						UserTable:       userTable,
						LikeWhere:       "team.name LIKE ?",
						HasNameFilter:   true,
						TeamIDs:         []int64{1, 2},
						UIDs:            []string{"a", "b"},
						ACFilterWhere:   " team.id IN (?, ?)",
						OrderBy:         " order by team.name asc",
						LimitClause:     " LIMIT 10 OFFSET 0",
					},
				},
			},
			getTeamByIDTemplate: {
				{
					Name: "by_id",
					Data: getTeamByIDQuery{
						SQLTemplate:     newT(),
						TeamTable:       teamTable,
						TeamMemberTable: teamMemberTable,
						UserTable:       userTable,
					},
				},
				{
					Name: "by_uid_hidden_users",
					Data: getTeamByIDQuery{
						SQLTemplate:     newT(),
						TeamTable:       teamTable,
						TeamMemberTable: teamMemberTable,
						UserTable:       userTable,
						FilteredUsers:   []string{"userLogin1"},
						ByUID:           true,
					},
				},
			},
			getTeamsByUserTemplate: {
				{
					Name: "basic",
					Data: getTeamsByUserQuery{
						SQLTemplate:     newT(),
						TeamTable:       teamTable,
						TeamMemberTable: teamMemberTable,
						ACFilterWhere:   " (1 = 1)",
					},
				},
			},
			getTeamIDsByUserTemplate: {
				{
					Name: "basic",
					Data: teamIDsByUserQuery{
						SQLTemplate:     newT(),
						TeamTable:       teamTable,
						TeamMemberTable: teamMemberTable,
						UserID:          1,
						OrgID:           2,
					},
				},
			},
			teamExistsTemplate: {
				{
					Name: "basic",
					Data: teamExistsQuery{
						SQLTemplate: newT(),
						TeamTable:   teamTable,
						OrgID:       1,
						TeamID:      2,
					},
				},
			},
			isTeamMemberTemplate: {
				{
					Name: "basic",
					Data: isTeamMemberQuery{
						SQLTemplate:     newT(),
						TeamMemberTable: teamMemberTable,
						OrgID:           1,
						TeamID:          2,
						UserID:          3,
					},
				},
			},
			getTeamMemberTemplate: {
				{
					Name: "basic",
					Data: getTeamMemberQuery{
						SQLTemplate:     newT(),
						TeamMemberTable: teamMemberTable,
						OrgID:           1,
						TeamID:          2,
						UserID:          3,
					},
				},
			},
			deleteTeamMembersTemplate: {
				{
					Name: "basic",
					Data: deleteTeamMembersQuery{
						SQLTemplate:     newT(),
						TeamMemberTable: teamMemberTable,
						OrgID:           1,
						TeamID:          2,
					},
				},
			},
			deleteTeamTemplate: {
				{
					Name: "basic",
					Data: deleteTeamQuery{
						SQLTemplate: newT(),
						TeamTable:   teamTable,
						OrgID:       1,
						TeamID:      2,
					},
				},
			},
			deleteDashboardACLTemplate: {
				{
					Name: "basic",
					Data: deleteDashboardACLQuery{
						SQLTemplate:       newT(),
						DashboardACLTable: dashboardACLTable,
						OrgID:             1,
						TeamID:            2,
					},
				},
			},
			removeTeamMemberTemplate: {
				{
					Name: "basic",
					Data: removeTeamMemberQuery{
						SQLTemplate:     newT(),
						TeamMemberTable: teamMemberTable,
						OrgID:           1,
						TeamID:          2,
						UserID:          3,
					},
				},
			},
			removeUserMembershipTemplate: {
				{
					Name: "basic",
					Data: removeUserMembershipsQuery{
						SQLTemplate:     newT(),
						TeamMemberTable: teamMemberTable,
						UserID:          1,
					},
				},
			},
			teamMemberUIDMigrationTmpl: {
				{
					Name: "basic",
					Data: teamMemberUIDMigrationQuery{
						SQLTemplate:     newT(),
						TeamMemberTable: teamMemberTable,
					},
				},
			},
		},
	})
}
