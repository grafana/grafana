package teamimpl

import (
	"testing"
	"text/template"

	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
)

func TestTemplates(t *testing.T) {
	dbHelper := &legacysql.LegacyDatabaseHelper{
		Table: func(name string) string {
			return "test_schema." + name
		},
	}
	queryTemplate := func() sqltemplate.SQLTemplate {
		return mocks.NewTestingSQLTemplate()
	}

	searchQuery := func(accessAll bool, accessTeamIDs []any) sqltemplate.SQLTemplate {
		return &searchTeamsQuery{
			SQLTemplate:     queryTemplate(),
			TeamTable:       dbHelper.Table("team"),
			TeamMemberTable: dbHelper.Table("team_member"),
			UserTable:       dbHelper.Table("user"),
			FilteredUsers:   []string{"hidden-user", "another-hidden-user"},
			OrgID:           7,
			NamePattern:     "%operations%",
			Name:            "Operations",
			TeamIDs:         []int64{11, 12},
			UIDs:            []string{"team-a", "team-b"},
			AccessAll:       accessAll,
			AccessTeamIDs:   accessTeamIDs,
			Sorts:           []string{"LOWER(team.name) DESC", "member_count ASC"},
			Limit:           25,
			Offset:          50,
		}
	}
	defaultSearchQuery := func() sqltemplate.SQLTemplate {
		return &searchTeamsQuery{
			SQLTemplate:     queryTemplate(),
			TeamTable:       dbHelper.Table("team"),
			TeamMemberTable: dbHelper.Table("team_member"),
			UserTable:       dbHelper.Table("user"),
			OrgID:           7,
			AccessAll:       true,
		}
	}
	teamByIDQuery := func(id int64, uid string, filteredUsers []string) sqltemplate.SQLTemplate {
		return &getTeamByIDQuery{
			SQLTemplate:     queryTemplate(),
			TeamTable:       dbHelper.Table("team"),
			TeamMemberTable: dbHelper.Table("team_member"),
			UserTable:       dbHelper.Table("user"),
			FilteredUsers:   filteredUsers,
			OrgID:           7,
			ID:              id,
			UID:             uid,
		}
	}
	teamsByUserQuery := func(accessAll bool, accessTeamIDs []any) sqltemplate.SQLTemplate {
		return &getTeamsByUserQuery{
			SQLTemplate:     queryTemplate(),
			TeamTable:       dbHelper.Table("team"),
			TeamMemberTable: dbHelper.Table("team_member"),
			OrgID:           7,
			UserID:          42,
			AccessAll:       accessAll,
			AccessTeamIDs:   accessTeamIDs,
		}
	}

	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir:        "testdata",
		SQLTemplatesFS: sqlTemplatesFS,
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			searchTeamsTemplate: {
				{Name: "all_filters", Data: searchQuery(false, []any{11, 12})},
				{Name: "default", Data: defaultSearchQuery()},
				{Name: "denied", Data: searchQuery(false, nil)},
			},
			getTeamByIDTemplate: {
				{Name: "by_id_with_hidden_users", Data: teamByIDQuery(11, "", []string{"hidden-user"})},
				{Name: "by_uid", Data: teamByIDQuery(0, "team-a", nil)},
			},
			getTeamsByUserTemplate: {
				{Name: "all_teams", Data: teamsByUserQuery(true, nil)},
				{Name: "selected_teams", Data: teamsByUserQuery(false, []any{11, 12})},
				{Name: "denied", Data: teamsByUserQuery(false, nil)},
			},
			getTeamIDsByUserTemplate: {
				{
					Name: "team_ids",
					Data: &getTeamIDsByUserQuery{
						SQLTemplate:     queryTemplate(),
						TeamTable:       dbHelper.Table("team"),
						TeamMemberTable: dbHelper.Table("team_member"),
						UserID:          42,
						OrgID:           7,
					},
				},
			},
			isTeamMemberTemplate: {
				{
					Name: "team_member",
					Data: &isTeamMemberQuery{
						SQLTemplate:     queryTemplate(),
						TeamMemberTable: dbHelper.Table("team_member"),
						OrgID:           7,
						TeamID:          11,
						UserID:          42,
					},
				},
			},
			teamExistsTemplate: {
				{
					Name: "team",
					Data: &teamExistsQuery{
						SQLTemplate: queryTemplate(),
						TeamTable:   dbHelper.Table("team"),
						OrgID:       7,
						TeamID:      11,
					},
				},
			},
			getTeamMemberTemplate: {
				{
					Name: "team_member",
					Data: &getTeamMemberQuery{
						SQLTemplate:     queryTemplate(),
						TeamMemberTable: dbHelper.Table("team_member"),
						OrgID:           7,
						TeamID:          11,
						UserID:          42,
					},
				},
			},
			deleteTeamMembersTemplate: {
				{
					Name: "team_members",
					Data: &deleteTeamMembersQuery{
						SQLTemplate:     queryTemplate(),
						TeamMemberTable: dbHelper.Table("team_member"),
						OrgID:           7,
						TeamID:          11,
					},
				},
			},
			deleteTeamTemplate: {
				{
					Name: "team",
					Data: &deleteTeamQuery{
						SQLTemplate: queryTemplate(),
						TeamTable:   dbHelper.Table("team"),
						OrgID:       7,
						TeamID:      11,
					},
				},
			},
			deleteDashboardACLTemplate: {
				{
					Name: "dashboard_acl",
					Data: &deleteDashboardACLQuery{
						SQLTemplate:       queryTemplate(),
						DashboardACLTable: dbHelper.Table("dashboard_acl"),
						OrgID:             7,
						TeamID:            11,
					},
				},
			},
			removeTeamMemberTemplate: {
				{
					Name: "team_member",
					Data: &removeTeamMemberQuery{
						SQLTemplate:     queryTemplate(),
						TeamMemberTable: dbHelper.Table("team_member"),
						OrgID:           7,
						TeamID:          11,
						UserID:          42,
					},
				},
			},
			removeUserMembershipsTemplate: {
				{
					Name: "user_memberships",
					Data: &removeUserMembershipsQuery{
						SQLTemplate:     queryTemplate(),
						TeamMemberTable: dbHelper.Table("team_member"),
						UserID:          42,
					},
				},
			},
		},
	})
}
