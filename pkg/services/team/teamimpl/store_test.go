package teamimpl

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/quota/quotaimpl"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/sortopts"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
)

type TestContext struct {
	context.Context
	Tracer   tracing.Tracer
	TestUser *user.SignedInUser

	Store    *sqlstore.SQLStore
	Cfg      *setting.Cfg
	TeamSvc  team.Service
	QuotaSvc quota.Service
	OrgSvc   org.Service
	UserSvc  user.Service
}

func NewTestContext(t *testing.T) *TestContext {
	t.Helper()

	ctx := &TestContext{
		Context: context.Background(),
		Tracer:  tracing.InitializeTracerForTest(),
		TestUser: &user.SignedInUser{
			OrgID: 1,
			Permissions: map[int64]map[string][]string{
				1: {
					ac.ActionTeamsRead:         []string{ac.ScopeTeamsAll},
					ac.ActionOrgUsersRead:      []string{ac.ScopeUsersAll},
					serviceaccounts.ActionRead: []string{serviceaccounts.ScopeAll},
				},
			},
		},
	}

	ctx.Cfg = setting.NewCfg()
	ctx.Store = sqlstore.NewTestStore(t, sqlstore.WithCfg(ctx.Cfg))

	var err error
	ctx.TeamSvc, err = ProvideService(ctx.Store, ctx.Cfg, ctx.Tracer)
	require.NoError(t, err, "team service")

	ctx.QuotaSvc = quotaimpl.ProvideService(ctx.Store, ctx.Cfg)

	ctx.OrgSvc, err = orgimpl.ProvideService(ctx.Store, ctx.Cfg, ctx.QuotaSvc)
	require.NoError(t, err, "org service")

	ctx.UserSvc, err = userimpl.ProvideService(
		ctx.Store, ctx.OrgSvc, ctx.Cfg, ctx.TeamSvc, nil, ctx.Tracer,
		ctx.QuotaSvc, supportbundlestest.NewFakeBundleService(),
	)
	require.NoError(t, err, "user service")

	return ctx
}

func TestIntegrationTeamCommandsAndQueries(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	const orgID int64 = 1

	setup := func(t *testing.T) (*TestContext, []int64, team.Team, team.Team) {
		ctx := NewTestContext(t)

		var userIDs []int64
		for i := 0; i < 5; i++ {
			userCmd := user.CreateUserCommand{
				Email: fmt.Sprint("user", i, "@test.com"),
				Name:  fmt.Sprint("user", i),
				Login: fmt.Sprint("loginuser", i),
			}
			usr, err := ctx.UserSvc.Create(ctx, &userCmd)
			require.NoError(t, err, "creating user %d", i)
			userIDs = append(userIDs, usr.ID)
		}

		team1, err := ctx.TeamSvc.CreateTeam(ctx, "group1 name", "test1@test.com", orgID)
		require.NoError(t, err, "creating team1")
		team2, err := ctx.TeamSvc.CreateTeam(ctx, "group2 name", "test2@test.com", orgID)
		require.NoError(t, err, "creating team2")

		return ctx, userIDs, team1, team2
	}

	t.Run("Should be able to create teams and add users", func(t *testing.T) {
		ctx, userIDs, team1, _ := setup(t)

		query := &team.SearchTeamsQuery{OrgID: orgID, Name: team1.Name, Page: 1, Limit: 10, SignedInUser: ctx.TestUser}
		queryResult, err := ctx.TeamSvc.SearchTeams(ctx, query)
		require.NoError(t, err)
		require.Equal(t, query.Page, 1)

		foundTeam := queryResult.Teams[0]
		require.Equal(t, foundTeam.Name, team1.Name)
		require.Equal(t, foundTeam.Email, team1.Email)
		require.Equal(t, foundTeam.OrgID, orgID)
		require.EqualValues(t, foundTeam.MemberCount, 0)

		err = ctx.Store.WithDbSession(ctx, func(sess *db.Session) error {
			err := AddOrUpdateTeamMemberHook(sess, userIDs[0], orgID, foundTeam.ID, false, 0)
			if err != nil {
				return err
			}
			return AddOrUpdateTeamMemberHook(sess, userIDs[1], orgID, foundTeam.ID, true, 0)
		})
		require.NoError(t, err)

		q1 := &team.GetTeamMembersQuery{OrgID: orgID, TeamID: foundTeam.ID, SignedInUser: ctx.TestUser}
		q1Result, err := ctx.TeamSvc.GetTeamMembers(ctx, q1)
		require.NoError(t, err)
		require.Equal(t, 2, len(q1Result))
		require.Equal(t, q1Result[0].TeamID, foundTeam.ID)
		require.Equal(t, q1Result[0].Login, "loginuser0")
		require.Equal(t, q1Result[0].OrgID, orgID)
		require.Equal(t, q1Result[1].TeamID, foundTeam.ID)
		require.Equal(t, q1Result[1].Login, "loginuser1")
		require.Equal(t, q1Result[1].OrgID, orgID)
		require.Equal(t, q1Result[1].External, true)

		q2 := &team.GetTeamMembersQuery{OrgID: orgID, TeamID: foundTeam.ID, External: true, SignedInUser: ctx.TestUser}
		q2Result, err := ctx.TeamSvc.GetTeamMembers(ctx, q2)
		require.NoError(t, err)
		require.Equal(t, len(q2Result), 1)
		require.Equal(t, q2Result[0].TeamID, foundTeam.ID)
		require.Equal(t, q2Result[0].Login, "loginuser1")
		require.Equal(t, q2Result[0].OrgID, orgID)
		require.Equal(t, q2Result[0].External, true)

		queryResult, err = ctx.TeamSvc.SearchTeams(ctx, query)
		require.NoError(t, err)
		foundTeam = queryResult.Teams[0]
		require.EqualValues(t, foundTeam.MemberCount, 2)

		getTeamQuery := &team.GetTeamByIDQuery{OrgID: orgID, ID: foundTeam.ID, SignedInUser: ctx.TestUser}
		getTeamQueryResult, err := ctx.TeamSvc.GetTeamByID(ctx, getTeamQuery)
		require.NoError(t, err)
		foundTeam = getTeamQueryResult
		require.Equal(t, foundTeam.Name, "group1 name")
		require.Equal(t, foundTeam.Email, "test1@test.com")
		require.Equal(t, foundTeam.OrgID, orgID)
		require.EqualValues(t, foundTeam.MemberCount, 2)

		getIDsQuery := &team.GetTeamIDsByUserQuery{OrgID: orgID, UserID: userIDs[0]}
		getIDResult, err := ctx.TeamSvc.GetTeamIDsByUser(ctx, getIDsQuery)
		require.NoError(t, err)

		require.Equal(t, len(getIDResult), 1)
		require.Equal(t, getIDResult[0], foundTeam.ID)
	})

	t.Run("Should return latest auth module for users when getting team members", func(t *testing.T) {
		ctx, userIds, team1, _ := setup(t)

		userId := userIds[1]

		teamQuery := &team.SearchTeamsQuery{OrgID: orgID, Name: team1.Name, Page: 1, Limit: 10, SignedInUser: ctx.TestUser}
		teamQueryResult, err := ctx.TeamSvc.SearchTeams(ctx, teamQuery)
		require.NoError(t, err)
		require.Equal(t, teamQuery.Page, 1)

		foundTeam := teamQueryResult.Teams[0]

		err = ctx.Store.WithDbSession(ctx, func(sess *db.Session) error {
			return AddOrUpdateTeamMemberHook(sess, userId, orgID, foundTeam.ID, true, 0)
		})
		require.NoError(t, err)

		memberQuery := &team.GetTeamMembersQuery{OrgID: orgID, TeamID: foundTeam.ID, External: true, SignedInUser: ctx.TestUser}
		memberQueryResult, err := ctx.TeamSvc.GetTeamMembers(ctx, memberQuery)
		require.NoError(t, err)
		require.Equal(t, len(memberQueryResult), 1)
		require.Equal(t, memberQueryResult[0].TeamID, foundTeam.ID)
		require.Equal(t, memberQueryResult[0].Login, "loginuser1")
		require.Equal(t, memberQueryResult[0].OrgID, orgID)
		require.Equal(t, memberQueryResult[0].External, true)
	})

	t.Run("Should be able to update users in a team", func(t *testing.T) {
		ctx, userIds, team1, _ := setup(t)
		userId := userIds[0]

		err := ctx.Store.WithDbSession(ctx, func(sess *db.Session) error {
			return AddOrUpdateTeamMemberHook(sess, userId, orgID, team1.ID, false, 0)
		})
		require.NoError(t, err)

		qBeforeUpdate := &team.GetTeamMembersQuery{OrgID: orgID, TeamID: team1.ID, SignedInUser: ctx.TestUser}
		qBeforeUpdateResult, err := ctx.TeamSvc.GetTeamMembers(ctx, qBeforeUpdate)
		require.NoError(t, err)
		require.EqualValues(t, qBeforeUpdateResult[0].Permission, 0)

		err = ctx.Store.WithDbSession(ctx, func(sess *db.Session) error {
			return AddOrUpdateTeamMemberHook(sess, userId, orgID, team1.ID, false, team.PermissionTypeAdmin)
		})
		require.NoError(t, err)

		qAfterUpdate := &team.GetTeamMembersQuery{OrgID: orgID, TeamID: team1.ID, SignedInUser: ctx.TestUser}
		qAfterUpdateResult, err := ctx.TeamSvc.GetTeamMembers(ctx, qAfterUpdate)
		require.NoError(t, err)
		require.Equal(t, qAfterUpdateResult[0].Permission, team.PermissionTypeAdmin)
	})

	t.Run("Should default to member permission level when updating a user with invalid permission level", func(t *testing.T) {
		ctx, userIDs, team1, _ := setup(t)
		userID := userIDs[0]

		err := ctx.Store.WithDbSession(ctx, func(sess *db.Session) error {
			return AddOrUpdateTeamMemberHook(sess, userID, orgID, team1.ID, false, 0)
		})
		require.NoError(t, err)

		qBeforeUpdate := &team.GetTeamMembersQuery{OrgID: orgID, TeamID: team1.ID, SignedInUser: ctx.TestUser}
		qBeforeUpdateResult, err := ctx.TeamSvc.GetTeamMembers(ctx, qBeforeUpdate)
		require.NoError(t, err)
		require.EqualValues(t, qBeforeUpdateResult[0].Permission, 0)

		invalidPermissionLevel := 2
		err = ctx.Store.WithDbSession(ctx, func(sess *db.Session) error {
			return AddOrUpdateTeamMemberHook(sess, userID, orgID, team1.ID, false, team.PermissionType(invalidPermissionLevel))
		})
		require.NoError(t, err)

		qAfterUpdate := &team.GetTeamMembersQuery{OrgID: orgID, TeamID: team1.ID, SignedInUser: ctx.TestUser}
		qAfterUpdateResult, err := ctx.TeamSvc.GetTeamMembers(ctx, qAfterUpdate)
		require.NoError(t, err)
		require.EqualValues(t, qAfterUpdateResult[0].Permission, 0)
	})

	t.Run("Should be able to search for teams", func(t *testing.T) {
		ctx, _, _, _ := setup(t)

		query := &team.SearchTeamsQuery{OrgID: orgID, Query: "group", Page: 1, SignedInUser: ctx.TestUser}
		queryResult, err := ctx.TeamSvc.SearchTeams(ctx, query)
		require.NoError(t, err)
		require.Equal(t, len(queryResult.Teams), 2)
		require.EqualValues(t, queryResult.TotalCount, 2)

		query2 := &team.SearchTeamsQuery{OrgID: orgID, Query: "", SignedInUser: ctx.TestUser}
		require.Equal(t, len(queryResult.Teams), 2)
		query2Result, err := ctx.TeamSvc.SearchTeams(ctx, query2)
		require.NoError(t, err)
		require.Equal(t, len(query2Result.Teams), 2)
	})

	t.Run("Should be able to sort teams by descending member count order", func(t *testing.T) {
		ctx, userIds, team1, team2 := setup(t)

		sortOpts, err := sortopts.ParseSortQueryParam("memberCount-desc")
		require.NoError(t, err)

		// Add a team member
		err = ctx.Store.WithDbSession(ctx, func(sess *db.Session) error {
			err := AddOrUpdateTeamMemberHook(sess, userIds[2], orgID, team1.ID, false, 0)
			if err != nil {
				return err
			}
			err = AddOrUpdateTeamMemberHook(sess, userIds[3], orgID, team1.ID, false, 0)
			if err != nil {
				return err
			}
			return AddOrUpdateTeamMemberHook(sess, userIds[2], orgID, team2.ID, false, 0)
		})
		require.NoError(t, err)

		query := &team.SearchTeamsQuery{OrgID: orgID, SortOpts: sortOpts, SignedInUser: ctx.TestUser}
		queryResult, err := ctx.TeamSvc.SearchTeams(ctx, query)
		require.NoError(t, err)
		require.Equal(t, len(queryResult.Teams), 2)
		require.EqualValues(t, queryResult.TotalCount, 2)
		require.Greater(t, queryResult.Teams[0].MemberCount, queryResult.Teams[1].MemberCount)
	})

	t.Run("Should be able to sort teams by descending name order", func(t *testing.T) {
		ctx, _, team1, team2 := setup(t)

		sortOpts, err := sortopts.ParseSortQueryParam("name-desc")
		require.NoError(t, err)

		query := &team.SearchTeamsQuery{OrgID: orgID, SortOpts: sortOpts, SignedInUser: ctx.TestUser}
		queryResult, err := ctx.TeamSvc.SearchTeams(ctx, query)
		require.NoError(t, err)
		require.Equal(t, len(queryResult.Teams), 2)
		require.EqualValues(t, queryResult.TotalCount, 2)
		require.Equal(t, queryResult.Teams[0].Name, team2.Name)
		require.Equal(t, queryResult.Teams[1].Name, team1.Name)
	})

	t.Run("Should be able to query teams by ids", func(t *testing.T) {
		ctx, _, _, _ := setup(t)

		allTeamsQuery := &team.SearchTeamsQuery{OrgID: orgID, Query: "", SignedInUser: ctx.TestUser}
		allTeamsQueryResult, err := ctx.TeamSvc.SearchTeams(ctx, allTeamsQuery)
		require.NoError(t, err)
		require.Equal(t, len(allTeamsQueryResult.Teams), 2)

		teamIds := make([]int64, 0)
		for _, team := range allTeamsQueryResult.Teams {
			teamIds = append(teamIds, team.ID)
		}

		query := &team.SearchTeamsQuery{OrgID: orgID, SignedInUser: ctx.TestUser, TeamIds: teamIds}
		queryResult, err := ctx.TeamSvc.SearchTeams(ctx, query)
		require.NoError(t, err)
		require.Equal(t, len(queryResult.Teams), 2)
		require.EqualValues(t, queryResult.TotalCount, 2)
		require.Equal(t, queryResult.Teams[0].ID, teamIds[0])
		require.Equal(t, queryResult.Teams[1].ID, teamIds[1])
	})

	t.Run("Should be able to return all teams a user is member of", func(t *testing.T) {
		ctx, userIds, _, team2 := setup(t)

		groupId := team2.ID
		err := ctx.Store.WithDbSession(ctx, func(sess *db.Session) error {
			return AddOrUpdateTeamMemberHook(sess, userIds[0], orgID, groupId, false, 0)
		})
		require.NoError(t, err)

		query := &team.GetTeamsByUserQuery{
			OrgID:  orgID,
			UserID: userIds[0],
			SignedInUser: &user.SignedInUser{
				OrgID:       orgID,
				Permissions: map[int64]map[string][]string{orgID: {ac.ActionOrgUsersRead: {ac.ScopeUsersAll}, ac.ActionTeamsRead: {ac.ScopeTeamsAll}}},
			},
		}
		queryResult, err := ctx.TeamSvc.GetTeamsByUser(ctx, query)
		require.NoError(t, err)
		require.Equal(t, len(queryResult), 1)
		require.Equal(t, queryResult[0].Name, "group2 name")
		require.Equal(t, queryResult[0].Email, "test2@test.com")
	})

	t.Run("Should be able to remove users from a group", func(t *testing.T) {
		ctx, userIds, team1, _ := setup(t)

		err := ctx.Store.WithDbSession(ctx, func(sess *db.Session) error {
			return AddOrUpdateTeamMemberHook(sess, userIds[0], orgID, team1.ID, false, 0)
		})
		require.NoError(t, err)

		err = ctx.Store.WithDbSession(ctx, func(sess *db.Session) error {
			return RemoveTeamMemberHook(sess, &team.RemoveTeamMemberCommand{OrgID: orgID, TeamID: team1.ID, UserID: userIds[0]})
		})
		require.NoError(t, err)

		q2 := &team.GetTeamMembersQuery{OrgID: orgID, TeamID: team1.ID, SignedInUser: ctx.TestUser}
		q2Result, err := ctx.TeamSvc.GetTeamMembers(ctx, q2)
		require.NoError(t, err)
		require.Equal(t, len(q2Result), 0)
	})

	t.Run("Should have empty teams", func(t *testing.T) {
		ctx, userIds, team1, _ := setup(t)
		err := ctx.Store.WithDbSession(ctx, func(sess *db.Session) error {
			return AddOrUpdateTeamMemberHook(sess, userIds[0], orgID, team1.ID, false, team.PermissionTypeAdmin)
		})
		require.NoError(t, err)
	})

	t.Run("A user should be able to remove the admin permission for the last admin", func(t *testing.T) {
		ctx, userIds, team1, _ := setup(t)
		err := ctx.Store.WithDbSession(ctx, func(sess *db.Session) error {
			return AddOrUpdateTeamMemberHook(sess, userIds[0], orgID, team1.ID, false, 0)
		})
		require.NoError(t, err)
	})

	t.Run("A user should be able to remove the last member", func(t *testing.T) {
		ctx, userIds, team1, _ := setup(t)
		// Set up for the test...
		err := ctx.Store.WithDbSession(ctx, func(sess *db.Session) error {
			return AddOrUpdateTeamMemberHook(sess, userIds[0], orgID, team1.ID, false, 0)
		})
		require.NoError(t, err, "failed to add member in prep for the test")

		// This is the testing bit
		err = ctx.Store.WithDbSession(ctx, func(sess *db.Session) error {
			return RemoveTeamMemberHook(sess, &team.RemoveTeamMemberCommand{OrgID: orgID, TeamID: team1.ID, UserID: userIds[0]})
		})
		require.NoError(t, err)
	})

	t.Run("A user should be able to remove the admin permission if there are other admins", func(t *testing.T) {
		ctx, userIds, team1, _ := setup(t)

		err := ctx.Store.WithDbSession(ctx, func(sess *db.Session) error {
			err := AddOrUpdateTeamMemberHook(sess, userIds[0], orgID, team1.ID, false, team.PermissionTypeAdmin)
			if err != nil {
				return err
			}
			return AddOrUpdateTeamMemberHook(sess, userIds[1], orgID, team1.ID, false, team.PermissionTypeAdmin)
		})
		require.NoError(t, err)
		err = ctx.Store.WithDbSession(ctx, func(sess *db.Session) error {
			return AddOrUpdateTeamMemberHook(sess, userIds[0], orgID, team1.ID, false, 0)
		})
		require.NoError(t, err)
	})

	t.Run("Should not return hidden users in team member count", func(t *testing.T) {
		ctx, userIds, team1, _ := setup(t)
		hiddenUsers := map[string]struct{}{ctx.TestUser.Login: {}, "loginuser0": {}}

		teamId := team1.ID
		err := ctx.Store.WithDbSession(ctx, func(sess *db.Session) error {
			err := AddOrUpdateTeamMemberHook(sess, userIds[0], orgID, teamId, false, 0)
			if err != nil {
				return err
			}
			err = AddOrUpdateTeamMemberHook(sess, userIds[1], orgID, teamId, false, 0)
			if err != nil {
				return err
			}
			return AddOrUpdateTeamMemberHook(sess, userIds[2], orgID, teamId, false, 0)
		})

		searchQuery := &team.SearchTeamsQuery{OrgID: orgID, Page: 1, Limit: 10, SignedInUser: ctx.TestUser, HiddenUsers: hiddenUsers}
		searchQueryResult, err := ctx.TeamSvc.SearchTeams(ctx, searchQuery)
		require.NoError(t, err)
		require.Equal(t, len(searchQueryResult.Teams), 2)
		foundTeam := searchQueryResult.Teams[0]
		require.EqualValues(t, foundTeam.MemberCount, 2)

		getTeamQuery := &team.GetTeamByIDQuery{OrgID: orgID, ID: teamId, SignedInUser: ctx.TestUser, HiddenUsers: hiddenUsers}
		getTeamQueryResult, err := ctx.TeamSvc.GetTeamByID(ctx, getTeamQuery)
		require.NoError(t, err)
		require.EqualValues(t, getTeamQueryResult.MemberCount, 2)
	})

	t.Run("Should be able to exclude service accounts from team members", func(t *testing.T) {
		ctx, userIds, _, team2 := setup(t)

		userCmd := user.CreateUserCommand{
			Email:            fmt.Sprint("sa", 1, "@test.com"),
			Name:             fmt.Sprint("sa", 1),
			Login:            fmt.Sprint("login-sa", 1),
			IsServiceAccount: true,
		}
		serviceAccount, err := ctx.UserSvc.Create(ctx, &userCmd)
		require.NoError(t, err)

		groupId := team2.ID
		dbErr := ctx.Store.WithDbSession(ctx, func(sess *db.Session) error {
			// add service account to team
			err := AddOrUpdateTeamMemberHook(sess, serviceAccount.ID, orgID, groupId, false, 0)
			if err != nil {
				return err
			}
			// add user to team
			return AddOrUpdateTeamMemberHook(sess, userIds[0], orgID, groupId, false, 0)
		})
		require.NoError(t, dbErr)

		teamMembersQuery := &team.GetTeamMembersQuery{
			OrgID:        orgID,
			SignedInUser: ctx.TestUser,
			TeamID:       groupId,
		}
		teamMembersQueryResult, err := ctx.TeamSvc.GetTeamMembers(ctx, teamMembersQuery)
		require.NoError(t, err)
		// should not receive service account from query
		require.Equal(t, len(teamMembersQueryResult), 1)
	})
}

func TestIntegrationSQLStore_SearchTeams(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	type searchTeamsTestCase struct {
		desc              string
		query             *team.SearchTeamsQuery
		expectedTeamCount int
	}

	tests := []searchTeamsTestCase{
		{
			desc: "should return all teams",
			query: &team.SearchTeamsQuery{
				OrgID: 1,
				SignedInUser: &user.SignedInUser{
					OrgID:       1,
					Permissions: map[int64]map[string][]string{1: {ac.ActionTeamsRead: {ac.ScopeTeamsAll}}},
				},
			},
			expectedTeamCount: 10,
		},
		{
			desc: "should return no teams",
			query: &team.SearchTeamsQuery{
				OrgID: 1,
				SignedInUser: &user.SignedInUser{
					OrgID:       1,
					Permissions: map[int64]map[string][]string{1: {ac.ActionTeamsRead: {""}}},
				},
			},
			expectedTeamCount: 0,
		},
		{
			desc: "should return some teams",
			query: &team.SearchTeamsQuery{
				OrgID: 1,
				SignedInUser: &user.SignedInUser{
					OrgID: 1,
					Permissions: map[int64]map[string][]string{1: {ac.ActionTeamsRead: {
						"teams:id:1",
						"teams:id:5",
						"teams:id:9",
					}}},
				},
			},
			expectedTeamCount: 3,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			ctx := NewTestContext(t)
			// Seed 10 teams
			for i := 1; i <= 10; i++ {
				_, err := ctx.TeamSvc.CreateTeam(ctx, fmt.Sprintf("team-%d", i), fmt.Sprintf("team-%d@example.org", i), 1)
				require.NoError(t, err, "seeding team %d", i)
			}

			queryResult, err := ctx.TeamSvc.SearchTeams(ctx, tt.query)
			require.NoError(t, err)
			assert.Len(t, queryResult.Teams, tt.expectedTeamCount)
			assert.Equal(t, queryResult.TotalCount, int64(tt.expectedTeamCount))

			castSignedInUser := tt.query.SignedInUser.(*user.SignedInUser)
			if !hasWildcardScope(castSignedInUser, ac.ActionTeamsRead) {
				for _, team := range queryResult.Teams {
					assert.Contains(t, castSignedInUser.Permissions[castSignedInUser.OrgID][ac.ActionTeamsRead], fmt.Sprintf("teams:id:%d", team.ID))
				}
			}
		})
	}
}

// TestSQLStore_GetTeamMembers_ACFilter tests the accesscontrol filtering of
// team members based on the signed in user permissions
func TestIntegrationSQLStore_GetTeamMembers_ACFilter(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	// Seed 2 teams with 2 members
	setup := func(ctx *TestContext) (int64, []int64) {
		orgID := int64(2)
		userIDs := make([]int64, 4)

		team1, errCreateTeam := ctx.TeamSvc.CreateTeam(ctx, "group1 name", "test1@example.org", orgID)
		require.NoError(t, errCreateTeam, "creating team 1")
		team2, errCreateTeam := ctx.TeamSvc.CreateTeam(ctx, "group2 name", "test2@example.org", orgID)
		require.NoError(t, errCreateTeam, "creating team 2")

		for i := 0; i < 4; i++ {
			userCmd := user.CreateUserCommand{
				Email: fmt.Sprint("user", i, "@example.org"),
				Name:  fmt.Sprint("user", i),
				Login: fmt.Sprint("loginuser", i),
			}
			user, errCreateUser := ctx.UserSvc.Create(ctx, &userCmd)
			require.NoError(t, errCreateUser, "seeding user %d", i)
			userIDs[i] = user.ID
		}

		errAddMembers := ctx.Store.WithDbSession(ctx, func(sess *db.Session) error {
			err := AddOrUpdateTeamMemberHook(sess, userIDs[0], orgID, team1.ID, false, 0)
			if err != nil {
				return err
			}
			err = AddOrUpdateTeamMemberHook(sess, userIDs[1], orgID, team1.ID, false, 0)
			if err != nil {
				return err
			}
			err = AddOrUpdateTeamMemberHook(sess, userIDs[2], orgID, team2.ID, false, 0)
			if err != nil {
				return err
			}
			return AddOrUpdateTeamMemberHook(sess, userIDs[3], orgID, team2.ID, false, 0)
		})
		require.NoError(t, errAddMembers)

		return orgID, userIDs
	}

	type getTeamMembersTestCase struct {
		desc             string
		query            func(orgID int64, userIDs []int64) *team.GetTeamMembersQuery
		expectedNumUsers int
	}

	tests := []getTeamMembersTestCase{
		{
			desc: "should return all team members",
			query: func(orgID int64, userIDs []int64) *team.GetTeamMembersQuery {
				return &team.GetTeamMembersQuery{
					OrgID: orgID,
					SignedInUser: &user.SignedInUser{
						OrgID:       orgID,
						Permissions: map[int64]map[string][]string{orgID: {ac.ActionOrgUsersRead: {ac.ScopeUsersAll}}},
					},
				}
			},
			expectedNumUsers: 4,
		},
		{
			desc: "should return no team members",
			query: func(orgID int64, userIDs []int64) *team.GetTeamMembersQuery {
				return &team.GetTeamMembersQuery{
					OrgID: orgID,
					SignedInUser: &user.SignedInUser{
						OrgID:       orgID,
						Permissions: map[int64]map[string][]string{orgID: {ac.ActionOrgUsersRead: {""}}},
					},
				}
			},
			expectedNumUsers: 0,
		},
		{
			desc: "should return some team members",
			query: func(orgID int64, userIDs []int64) *team.GetTeamMembersQuery {
				return &team.GetTeamMembersQuery{
					OrgID: orgID,
					SignedInUser: &user.SignedInUser{
						OrgID: orgID,
						Permissions: map[int64]map[string][]string{orgID: {ac.ActionOrgUsersRead: {
							ac.Scope("users", "id", fmt.Sprintf("%d", userIDs[0])),
							ac.Scope("users", "id", fmt.Sprintf("%d", userIDs[2])),
							ac.Scope("users", "id", fmt.Sprintf("%d", userIDs[3])),
						}}},
					},
				}
			},
			expectedNumUsers: 3,
		},
	}
	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			ctx := NewTestContext(t)
			orgID, userIDs := setup(ctx)

			query := tt.query(orgID, userIDs)
			queryResult, err := ctx.TeamSvc.GetTeamMembers(ctx, query)
			require.NoError(t, err)
			assert.Len(t, queryResult, tt.expectedNumUsers)

			if !hasWildcardScope(query.SignedInUser, ac.ActionOrgUsersRead) {
				for _, member := range queryResult {
					assert.Contains(t,
						query.SignedInUser.GetPermissions()[ac.ActionOrgUsersRead],
						ac.Scope("users", "id", fmt.Sprintf("%d", member.UserID)),
					)
				}
			}
		})
	}
}

func hasWildcardScope(user identity.Requester, action string) bool {
	for _, scope := range user.GetPermissions()[action] {
		if strings.HasSuffix(scope, ":*") {
			return true
		}
	}
	return false
}
