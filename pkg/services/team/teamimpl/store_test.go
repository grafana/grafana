package teamimpl

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotaimpl"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/sortopts"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/testutil"
)

type teamTestEnv struct {
	sqlStore *sqlstore.SQLStore
	cfg      *setting.Cfg
	teamSvc  team.Service
	userSvc  user.Service
	testUser *user.SignedInUser
}

func setupTeamTestEnv(t *testing.T) *teamTestEnv {
	t.Helper()
	cfg := setting.NewCfg()
	sqlStore := sqlstore.NewTestStore(t, sqlstore.WithCfg(cfg))
	teamSvc, err := ProvideService(sqlStore, cfg, tracing.InitializeTracerForTest(), nil)
	require.NoError(t, err)
	testUser := &user.SignedInUser{
		OrgID: 1,
		Permissions: map[int64]map[string][]string{
			1: {
				ac.ActionTeamsRead:         []string{ac.ScopeTeamsAll},
				ac.ActionOrgUsersRead:      []string{ac.ScopeUsersAll},
				serviceaccounts.ActionRead: []string{serviceaccounts.ScopeAll},
			},
		},
	}
	cfgProvider, err := configprovider.ProvideService(cfg)
	require.NoError(t, err)
	quotaService := quotaimpl.ProvideService(context.Background(), sqlStore, cfgProvider)
	orgSvc, err := orgimpl.ProvideService(sqlStore, cfg, quotaService)
	require.NoError(t, err)
	userSvc, err := userimpl.ProvideService(
		sqlStore, orgSvc, cfg, teamSvc, nil, tracing.InitializeTracerForTest(),
		quotaService, supportbundlestest.NewFakeBundleService(), nil,
	)
	require.NoError(t, err)

	return &teamTestEnv{
		sqlStore: sqlStore,
		cfg:      cfg,
		teamSvc:  teamSvc,
		userSvc:  userSvc,
		testUser: testUser,
	}
}

type usersAndTeams struct {
	userIDs  []int64
	userUIDs []string
	team1    team.Team
	team2    team.Team
}

func (env *teamTestEnv) createUsersAndTeams(t *testing.T) usersAndTeams {
	t.Helper()
	const testOrgID int64 = 1

	var userIDs []int64
	var userUIDs []string
	for i := range 5 {
		userCmd := user.CreateUserCommand{
			Email: fmt.Sprint("user", i, "@test.com"),
			Name:  fmt.Sprint("user", i),
			Login: fmt.Sprint("loginuser", i),
		}
		usr, err := env.userSvc.Create(context.Background(), &userCmd)
		require.NoError(t, err)
		userIDs = append(userIDs, usr.ID)
		userUIDs = append(userUIDs, usr.UID)
	}

	team1Cmd := team.CreateTeamCommand{
		Name:  "group1 name",
		Email: "test1@test.com",
		OrgID: testOrgID,
	}
	team1, err := env.teamSvc.CreateTeam(context.Background(), &team1Cmd)
	require.NoError(t, err)

	team2Cmd := team.CreateTeamCommand{
		Name:  "group2 name",
		Email: "test2@test.com",
		OrgID: testOrgID,
	}
	team2, err := env.teamSvc.CreateTeam(context.Background(), &team2Cmd)
	require.NoError(t, err)

	return usersAndTeams{
		userIDs:  userIDs,
		userUIDs: userUIDs,
		team1:    team1,
		team2:    team2,
	}
}

func TestIntegrationTeamCommandsAndQueries(t *testing.T) {
	t.Parallel()
	testutil.SkipIntegrationTestInShortMode(t)

	const testOrgID int64 = 1

	t.Run("Should be able to create teams and add users", func(t *testing.T) {
		t.Parallel()
		env := setupTeamTestEnv(t)
		data := env.createUsersAndTeams(t)

		query := &team.SearchTeamsQuery{OrgID: testOrgID, Name: "group1 name", Page: 1, Limit: 10, SignedInUser: env.testUser}
		queryResult, err := env.teamSvc.SearchTeams(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, query.Page, 1)

		team1 := queryResult.Teams[0]
		require.Equal(t, team1.Name, "group1 name")
		require.Equal(t, team1.Email, "test1@test.com")
		require.Equal(t, team1.OrgID, testOrgID)
		require.EqualValues(t, team1.MemberCount, 0)

		err = env.sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			err := AddOrUpdateTeamMemberHook(sess, data.userIDs[0], testOrgID, team1.ID, false, 0)
			if err != nil {
				return err
			}
			return AddOrUpdateTeamMemberHook(sess, data.userIDs[1], testOrgID, team1.ID, true, 0)
		})
		require.NoError(t, err)

		q1 := &team.GetTeamMembersQuery{OrgID: testOrgID, TeamID: team1.ID, SignedInUser: env.testUser}
		q1Result, err := env.teamSvc.GetTeamMembers(context.Background(), q1)
		require.NoError(t, err)
		require.Equal(t, 2, len(q1Result))
		require.Equal(t, q1Result[0].TeamID, team1.ID)
		require.Contains(t, data.userIDs[:2], q1Result[0].UserID)
		require.Contains(t, data.userUIDs[:2], q1Result[0].UserUID)
		require.Equal(t, q1Result[0].Login, "loginuser0")
		require.Equal(t, q1Result[0].OrgID, testOrgID)
		require.Equal(t, q1Result[1].TeamID, team1.ID)
		require.Contains(t, data.userIDs[:2], q1Result[1].UserID)
		require.Contains(t, data.userUIDs[:2], q1Result[1].UserUID)
		require.Equal(t, q1Result[1].Login, "loginuser1")
		require.Equal(t, q1Result[1].OrgID, testOrgID)
		require.Equal(t, q1Result[1].External, true)

		q2 := &team.GetTeamMembersQuery{OrgID: testOrgID, TeamID: team1.ID, External: true, SignedInUser: env.testUser}
		q2Result, err := env.teamSvc.GetTeamMembers(context.Background(), q2)
		require.NoError(t, err)
		require.Equal(t, len(q2Result), 1)
		require.Equal(t, q2Result[0].TeamID, team1.ID)
		require.Equal(t, q2Result[0].Login, "loginuser1")
		require.Equal(t, q2Result[0].OrgID, testOrgID)
		require.Equal(t, q2Result[0].External, true)

		queryResult, err = env.teamSvc.SearchTeams(context.Background(), query)
		require.NoError(t, err)
		team1 = queryResult.Teams[0]
		require.EqualValues(t, team1.MemberCount, 2)

		getTeamQuery := &team.GetTeamByIDQuery{OrgID: testOrgID, ID: team1.ID, SignedInUser: env.testUser}
		getTeamQueryResult, err := env.teamSvc.GetTeamByID(context.Background(), getTeamQuery)
		require.NoError(t, err)
		team1 = getTeamQueryResult
		require.Equal(t, team1.Name, "group1 name")
		require.Equal(t, team1.Email, "test1@test.com")
		require.Equal(t, team1.OrgID, testOrgID)
		require.EqualValues(t, team1.MemberCount, 2)

		getIDsQuery := &team.GetTeamIDsByUserQuery{OrgID: testOrgID, UserID: data.userIDs[0]}
		getIDResult, err := env.teamSvc.GetTeamIDsByUser(context.Background(), getIDsQuery)
		require.NoError(t, err)

		require.Equal(t, len(getIDResult), 1)
		require.Equal(t, getIDResult[0], team1.ID)
	})

	t.Run("Should return latest auth module for users when getting team members", func(t *testing.T) {
		t.Parallel()
		env := setupTeamTestEnv(t)
		data := env.createUsersAndTeams(t)
		userId := data.userIDs[1]

		teamQuery := &team.SearchTeamsQuery{OrgID: testOrgID, Name: "group1 name", Page: 1, Limit: 10, SignedInUser: env.testUser}
		teamQueryResult, err := env.teamSvc.SearchTeams(context.Background(), teamQuery)
		require.NoError(t, err)
		require.Equal(t, teamQuery.Page, 1)

		team1 := teamQueryResult.Teams[0]

		err = env.sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			return AddOrUpdateTeamMemberHook(sess, userId, testOrgID, team1.ID, true, 0)
		})
		require.NoError(t, err)

		memberQuery := &team.GetTeamMembersQuery{OrgID: testOrgID, TeamID: team1.ID, External: true, SignedInUser: env.testUser}
		memberQueryResult, err := env.teamSvc.GetTeamMembers(context.Background(), memberQuery)
		require.NoError(t, err)
		require.Equal(t, len(memberQueryResult), 1)
		require.Equal(t, memberQueryResult[0].TeamID, team1.ID)
		require.Equal(t, memberQueryResult[0].Login, "loginuser1")
		require.Equal(t, memberQueryResult[0].OrgID, testOrgID)
		require.Equal(t, memberQueryResult[0].External, true)
	})

	t.Run("Should be able to update users in a team", func(t *testing.T) {
		t.Parallel()
		env := setupTeamTestEnv(t)
		data := env.createUsersAndTeams(t)
		userId := data.userIDs[0]

		err := env.sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			return AddOrUpdateTeamMemberHook(sess, userId, testOrgID, data.team1.ID, false, 0)
		})
		require.NoError(t, err)

		qBeforeUpdate := &team.GetTeamMembersQuery{OrgID: testOrgID, TeamID: data.team1.ID, SignedInUser: env.testUser}
		qBeforeUpdateResult, err := env.teamSvc.GetTeamMembers(context.Background(), qBeforeUpdate)
		require.NoError(t, err)
		require.EqualValues(t, qBeforeUpdateResult[0].Permission, 0)

		err = env.sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			return AddOrUpdateTeamMemberHook(sess, userId, testOrgID, data.team1.ID, false, team.PermissionTypeAdmin)
		})
		require.NoError(t, err)

		qAfterUpdate := &team.GetTeamMembersQuery{OrgID: testOrgID, TeamID: data.team1.ID, SignedInUser: env.testUser}
		qAfterUpdateResult, err := env.teamSvc.GetTeamMembers(context.Background(), qAfterUpdate)
		require.NoError(t, err)
		require.Equal(t, qAfterUpdateResult[0].Permission, team.PermissionTypeAdmin)
	})

	t.Run("Should default to member permission level when updating a user with invalid permission level", func(t *testing.T) {
		t.Parallel()
		env := setupTeamTestEnv(t)
		data := env.createUsersAndTeams(t)
		userID := data.userIDs[0]

		err := env.sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			return AddOrUpdateTeamMemberHook(sess, userID, testOrgID, data.team1.ID, false, 0)
		})
		require.NoError(t, err)

		qBeforeUpdate := &team.GetTeamMembersQuery{OrgID: testOrgID, TeamID: data.team1.ID, SignedInUser: env.testUser}
		qBeforeUpdateResult, err := env.teamSvc.GetTeamMembers(context.Background(), qBeforeUpdate)
		require.NoError(t, err)
		require.EqualValues(t, qBeforeUpdateResult[0].Permission, 0)

		invalidPermissionLevel := 2
		err = env.sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			return AddOrUpdateTeamMemberHook(sess, userID, testOrgID, data.team1.ID, false, team.PermissionType(invalidPermissionLevel))
		})
		require.NoError(t, err)

		qAfterUpdate := &team.GetTeamMembersQuery{OrgID: testOrgID, TeamID: data.team1.ID, SignedInUser: env.testUser}
		qAfterUpdateResult, err := env.teamSvc.GetTeamMembers(context.Background(), qAfterUpdate)
		require.NoError(t, err)
		require.EqualValues(t, qAfterUpdateResult[0].Permission, 0)
	})

	t.Run("Should be able to search for teams", func(t *testing.T) {
		t.Parallel()
		env := setupTeamTestEnv(t)
		env.createUsersAndTeams(t)

		// Use mixed-case to test case-insensitive search.
		query := &team.SearchTeamsQuery{OrgID: testOrgID, Query: "GrOuP", Page: 1, SignedInUser: env.testUser}
		queryResult, err := env.teamSvc.SearchTeams(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, len(queryResult.Teams), 2)
		require.EqualValues(t, queryResult.TotalCount, 2)

		query2 := &team.SearchTeamsQuery{OrgID: testOrgID, Query: "", SignedInUser: env.testUser}
		require.Equal(t, len(queryResult.Teams), 2)
		query2Result, err := env.teamSvc.SearchTeams(context.Background(), query2)
		require.NoError(t, err)
		require.Equal(t, len(query2Result.Teams), 2)
	})

	t.Run("Should be able to sort teams by descending member count order", func(t *testing.T) {
		t.Parallel()
		env := setupTeamTestEnv(t)
		data := env.createUsersAndTeams(t)

		sortOpts, err := sortopts.ParseSortQueryParam("memberCount-desc")
		require.NoError(t, err)

		// Add team members
		err = env.sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			err := AddOrUpdateTeamMemberHook(sess, data.userIDs[2], testOrgID, data.team1.ID, false, 0)
			if err != nil {
				return err
			}
			err = AddOrUpdateTeamMemberHook(sess, data.userIDs[3], testOrgID, data.team1.ID, false, 0)
			if err != nil {
				return err
			}
			return AddOrUpdateTeamMemberHook(sess, data.userIDs[2], testOrgID, data.team2.ID, false, 0)
		})
		require.NoError(t, err)

		query := &team.SearchTeamsQuery{OrgID: testOrgID, SortOpts: sortOpts, SignedInUser: env.testUser}
		queryResult, err := env.teamSvc.SearchTeams(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, len(queryResult.Teams), 2)
		require.EqualValues(t, queryResult.TotalCount, 2)
		require.Greater(t, queryResult.Teams[0].MemberCount, queryResult.Teams[1].MemberCount)
	})

	t.Run("Should be able to sort teams by descending name order", func(t *testing.T) {
		t.Parallel()
		env := setupTeamTestEnv(t)
		data := env.createUsersAndTeams(t)

		sortOpts, err := sortopts.ParseSortQueryParam("name-desc")
		require.NoError(t, err)

		query := &team.SearchTeamsQuery{OrgID: testOrgID, SortOpts: sortOpts, SignedInUser: env.testUser}
		queryResult, err := env.teamSvc.SearchTeams(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, len(queryResult.Teams), 2)
		require.EqualValues(t, queryResult.TotalCount, 2)
		require.Equal(t, queryResult.Teams[0].Name, data.team2.Name)
		require.Equal(t, queryResult.Teams[1].Name, data.team1.Name)
	})

	t.Run("Should be able to query teams by ids", func(t *testing.T) {
		t.Parallel()
		env := setupTeamTestEnv(t)
		env.createUsersAndTeams(t)

		allTeamsQuery := &team.SearchTeamsQuery{OrgID: testOrgID, Query: "", SignedInUser: env.testUser}
		allTeamsQueryResult, err := env.teamSvc.SearchTeams(context.Background(), allTeamsQuery)
		require.NoError(t, err)
		require.Equal(t, len(allTeamsQueryResult.Teams), 2)

		teamIds := make([]int64, 0, len(allTeamsQueryResult.Teams))
		for _, team := range allTeamsQueryResult.Teams {
			teamIds = append(teamIds, team.ID)
		}

		query := &team.SearchTeamsQuery{OrgID: testOrgID, SignedInUser: env.testUser, TeamIds: teamIds}
		queryResult, err := env.teamSvc.SearchTeams(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, len(queryResult.Teams), 2)
		require.EqualValues(t, queryResult.TotalCount, 2)
		require.Equal(t, queryResult.Teams[0].ID, teamIds[0])
		require.Equal(t, queryResult.Teams[1].ID, teamIds[1])
	})

	t.Run("Should be able to query teams by UIDs", func(t *testing.T) {
		t.Parallel()
		env := setupTeamTestEnv(t)
		env.createUsersAndTeams(t)

		allTeamsQuery := &team.SearchTeamsQuery{OrgID: testOrgID, Query: "", SignedInUser: env.testUser}
		allTeamsQueryResult, err := env.teamSvc.SearchTeams(context.Background(), allTeamsQuery)
		require.NoError(t, err)
		require.Equal(t, len(allTeamsQueryResult.Teams), 2)

		teamUIDs := make([]string, 0, len(allTeamsQueryResult.Teams))
		for _, tm := range allTeamsQueryResult.Teams {
			teamUIDs = append(teamUIDs, tm.UID)
		}

		query := &team.SearchTeamsQuery{OrgID: testOrgID, SignedInUser: env.testUser, UIDs: teamUIDs}
		queryResult, err := env.teamSvc.SearchTeams(context.Background(), query)
		require.NoError(t, err)
		require.Len(t, queryResult.Teams, 2)
		require.EqualValues(t, queryResult.TotalCount, 2)
		assert.Contains(t, teamUIDs, queryResult.Teams[0].UID)
		assert.Contains(t, teamUIDs, queryResult.Teams[1].UID)
	})

	t.Run("Should be able to return all teams a user is member of", func(t *testing.T) {
		t.Parallel()
		env := setupTeamTestEnv(t)
		data := env.createUsersAndTeams(t)

		groupId := data.team2.ID
		err := env.sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			return AddOrUpdateTeamMemberHook(sess, data.userIDs[0], testOrgID, groupId, false, 0)
		})
		require.NoError(t, err)

		query := &team.GetTeamsByUserQuery{
			OrgID:  testOrgID,
			UserID: data.userIDs[0],
			SignedInUser: &user.SignedInUser{
				OrgID:       testOrgID,
				Permissions: map[int64]map[string][]string{testOrgID: {ac.ActionOrgUsersRead: {ac.ScopeUsersAll}, ac.ActionTeamsRead: {ac.ScopeTeamsAll}}},
			},
		}
		queryResult, err := env.teamSvc.GetTeamsByUser(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, len(queryResult), 1)
		require.Equal(t, queryResult[0].Name, "group2 name")
		require.Equal(t, queryResult[0].Email, "test2@test.com")
	})

	t.Run("Should be able to remove users from a group", func(t *testing.T) {
		t.Parallel()
		env := setupTeamTestEnv(t)
		data := env.createUsersAndTeams(t)

		err := env.sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			return AddOrUpdateTeamMemberHook(sess, data.userIDs[0], testOrgID, data.team1.ID, false, 0)
		})
		require.NoError(t, err)

		err = env.sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			return RemoveTeamMemberHook(sess, &team.RemoveTeamMemberCommand{OrgID: testOrgID, TeamID: data.team1.ID, UserID: data.userIDs[0]})
		})
		require.NoError(t, err)

		q2 := &team.GetTeamMembersQuery{OrgID: testOrgID, TeamID: data.team1.ID, SignedInUser: env.testUser}
		q2Result, err := env.teamSvc.GetTeamMembers(context.Background(), q2)
		require.NoError(t, err)
		require.Equal(t, len(q2Result), 0)
	})

	t.Run("Should have empty teams", func(t *testing.T) {
		t.Parallel()
		env := setupTeamTestEnv(t)
		data := env.createUsersAndTeams(t)

		err := env.sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			return AddOrUpdateTeamMemberHook(sess, data.userIDs[0], testOrgID, data.team1.ID, false, team.PermissionTypeAdmin)
		})
		require.NoError(t, err)

		t.Run("A user should be able to remove the admin permission for the last admin", func(t *testing.T) {
			err = env.sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
				return AddOrUpdateTeamMemberHook(sess, data.userIDs[0], testOrgID, data.team1.ID, false, 0)
			})
			require.NoError(t, err)
		})

		t.Run("A user should be able to remove the last member", func(t *testing.T) {
			err = env.sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
				return RemoveTeamMemberHook(sess, &team.RemoveTeamMemberCommand{OrgID: testOrgID, TeamID: data.team1.ID, UserID: data.userIDs[0]})
			})
			require.NoError(t, err)
		})
	})

	t.Run("A user should be able to remove the admin permission if there are other admins", func(t *testing.T) {
		t.Parallel()
		env := setupTeamTestEnv(t)
		data := env.createUsersAndTeams(t)

		err := env.sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			err := AddOrUpdateTeamMemberHook(sess, data.userIDs[0], testOrgID, data.team1.ID, false, team.PermissionTypeAdmin)
			if err != nil {
				return err
			}
			return AddOrUpdateTeamMemberHook(sess, data.userIDs[1], testOrgID, data.team1.ID, false, team.PermissionTypeAdmin)
		})
		require.NoError(t, err)
		err = env.sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			return AddOrUpdateTeamMemberHook(sess, data.userIDs[0], testOrgID, data.team1.ID, false, 0)
		})
		require.NoError(t, err)
	})

	t.Run("Should not return hidden users in team member count", func(t *testing.T) {
		t.Parallel()
		env := setupTeamTestEnv(t)
		data := env.createUsersAndTeams(t)

		signedInUser := &user.SignedInUser{
			Login: "loginuser0",
			OrgID: testOrgID,
			Permissions: map[int64]map[string][]string{
				testOrgID: {
					ac.ActionTeamsRead:    []string{ac.ScopeTeamsAll},
					ac.ActionOrgUsersRead: []string{ac.ScopeUsersAll},
				},
			},
		}
		hiddenUsers := map[string]struct{}{"loginuser0": {}, "loginuser1": {}}

		teamId := data.team1.ID
		err := env.sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			err := AddOrUpdateTeamMemberHook(sess, data.userIDs[0], testOrgID, teamId, false, 0)
			if err != nil {
				return err
			}
			err = AddOrUpdateTeamMemberHook(sess, data.userIDs[1], testOrgID, teamId, false, 0)
			if err != nil {
				return err
			}
			return AddOrUpdateTeamMemberHook(sess, data.userIDs[2], testOrgID, teamId, false, 0)
		})
		require.NoError(t, err)

		searchQuery := &team.SearchTeamsQuery{OrgID: testOrgID, Page: 1, Limit: 10, SignedInUser: signedInUser, HiddenUsers: hiddenUsers}
		searchQueryResult, err := env.teamSvc.SearchTeams(context.Background(), searchQuery)
		require.NoError(t, err)
		require.Equal(t, len(searchQueryResult.Teams), 2)
		team1 := searchQueryResult.Teams[0]
		require.EqualValues(t, team1.MemberCount, 2)

		getTeamQuery := &team.GetTeamByIDQuery{OrgID: testOrgID, ID: teamId, SignedInUser: signedInUser, HiddenUsers: hiddenUsers}
		getTeamQueryResult, err := env.teamSvc.GetTeamByID(context.Background(), getTeamQuery)
		require.NoError(t, err)
		require.EqualValues(t, getTeamQueryResult.MemberCount, 2)
	})

	t.Run("Should be able to exclude service accounts from teamembers", func(t *testing.T) {
		t.Parallel()
		env := setupTeamTestEnv(t)
		data := env.createUsersAndTeams(t)

		userCmd := user.CreateUserCommand{
			Email:            fmt.Sprint("sa", 1, "@test.com"),
			Name:             fmt.Sprint("sa", 1),
			Login:            fmt.Sprint("login-sa", 1),
			IsServiceAccount: true,
		}
		serviceAccount, err := env.userSvc.Create(context.Background(), &userCmd)
		require.NoError(t, err)

		groupId := data.team2.ID
		dbErr := env.sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			// add service account to team
			err := AddOrUpdateTeamMemberHook(sess, serviceAccount.ID, testOrgID, groupId, false, 0)
			if err != nil {
				return err
			}
			// add user to team
			return AddOrUpdateTeamMemberHook(sess, data.userIDs[0], testOrgID, groupId, false, 0)
		})
		require.NoError(t, dbErr)

		teamMembersQuery := &team.GetTeamMembersQuery{
			OrgID:        testOrgID,
			SignedInUser: env.testUser,
			TeamID:       groupId,
		}
		teamMembersQueryResult, err := env.teamSvc.GetTeamMembers(context.Background(), teamMembersQuery)
		require.NoError(t, err)
		// should not receive service account from query
		require.Equal(t, len(teamMembersQueryResult), 1)
	})
}

func TestIntegrationSQLStore_SearchTeams(t *testing.T) {
	t.Parallel()
	testutil.SkipIntegrationTestInShortMode(t)

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

	cfg := setting.NewCfg()
	store := sqlstore.NewTestStore(t, sqlstore.WithCfg(cfg))
	teamSvc, err := ProvideService(store, cfg, tracing.InitializeTracerForTest(), nil)
	require.NoError(t, err)

	// Seed 10 teams
	for i := 1; i <= 10; i++ {
		teamCmd := team.CreateTeamCommand{
			Name:  fmt.Sprintf("team-%d", i),
			Email: fmt.Sprintf("team-%d@example.org", i),
			OrgID: 1,
		}
		_, err := teamSvc.CreateTeam(context.Background(), &teamCmd)
		require.NoError(t, err)
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			queryResult, err := teamSvc.SearchTeams(context.Background(), tt.query)
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
	t.Parallel()
	testutil.SkipIntegrationTestInShortMode(t)

	testOrgID := int64(2)
	userIds := make([]int64, 4)

	// Seed 2 teams with 2 members
	setup := func(store db.DB, cfg *setting.Cfg) {
		teamSvc, err := ProvideService(store, cfg, tracing.InitializeTracerForTest(), nil)
		require.NoError(t, err)

		team1Cmd := team.CreateTeamCommand{
			Name:  "group1 name",
			Email: "test1@example.org",
			OrgID: testOrgID,
		}
		team1, errCreateTeam := teamSvc.CreateTeam(context.Background(), &team1Cmd)
		require.NoError(t, errCreateTeam)

		team2Cmd := team.CreateTeamCommand{
			Name:  "group2 name",
			Email: "test2@example.org",
			OrgID: testOrgID,
		}
		team2, errCreateTeam := teamSvc.CreateTeam(context.Background(), &team2Cmd)
		require.NoError(t, errCreateTeam)

		cfgProvider, err := configprovider.ProvideService(cfg)
		require.NoError(t, err)
		quotaService := quotaimpl.ProvideService(context.Background(), store, cfgProvider)
		orgSvc, err := orgimpl.ProvideService(store, cfg, quotaService)
		require.NoError(t, err)
		userSvc, err := userimpl.ProvideService(
			store, orgSvc, cfg, teamSvc, nil, tracing.InitializeTracerForTest(),
			quotaService, supportbundlestest.NewFakeBundleService(), nil,
		)
		require.NoError(t, err)

		for i := range 4 {
			userCmd := user.CreateUserCommand{
				Email: fmt.Sprint("user", i, "@example.org"),
				Name:  fmt.Sprint("user", i),
				Login: fmt.Sprint("loginuser", i),
			}
			user, errCreateUser := userSvc.Create(context.Background(), &userCmd)
			require.NoError(t, errCreateUser)
			userIds[i] = user.ID
		}

		errAddMembers := store.WithDbSession(context.Background(), func(sess *db.Session) error {
			err := AddOrUpdateTeamMemberHook(sess, userIds[0], testOrgID, team1.ID, false, 0)
			if err != nil {
				return err
			}
			err = AddOrUpdateTeamMemberHook(sess, userIds[1], testOrgID, team1.ID, false, 0)
			if err != nil {
				return err
			}
			err = AddOrUpdateTeamMemberHook(sess, userIds[2], testOrgID, team2.ID, false, 0)
			if err != nil {
				return err
			}
			return AddOrUpdateTeamMemberHook(sess, userIds[3], testOrgID, team2.ID, false, 0)
		})
		require.NoError(t, errAddMembers)
	}

	cfg := setting.NewCfg()
	store := sqlstore.NewTestStore(t, sqlstore.WithCfg(cfg))
	setup(store, cfg)
	teamSvc, err := ProvideService(store, cfg, tracing.InitializeTracerForTest(), nil)
	require.NoError(t, err)

	type getTeamMembersTestCase struct {
		desc             string
		query            *team.GetTeamMembersQuery
		expectedNumUsers int
	}

	tests := []getTeamMembersTestCase{
		{
			desc: "should return all team members",
			query: &team.GetTeamMembersQuery{
				OrgID: testOrgID,
				SignedInUser: &user.SignedInUser{
					OrgID:       testOrgID,
					Permissions: map[int64]map[string][]string{testOrgID: {ac.ActionOrgUsersRead: {ac.ScopeUsersAll}}},
				},
			},
			expectedNumUsers: 4,
		},
		{
			desc: "should return no team members",
			query: &team.GetTeamMembersQuery{
				OrgID: testOrgID,
				SignedInUser: &user.SignedInUser{
					OrgID:       testOrgID,
					Permissions: map[int64]map[string][]string{testOrgID: {ac.ActionOrgUsersRead: {""}}},
				},
			},
			expectedNumUsers: 0,
		},
		{
			desc: "should return some team members",
			query: &team.GetTeamMembersQuery{
				OrgID: testOrgID,
				SignedInUser: &user.SignedInUser{
					OrgID: testOrgID,
					Permissions: map[int64]map[string][]string{testOrgID: {ac.ActionOrgUsersRead: {
						ac.Scope("users", "id", fmt.Sprintf("%d", userIds[0])),
						ac.Scope("users", "id", fmt.Sprintf("%d", userIds[2])),
						ac.Scope("users", "id", fmt.Sprintf("%d", userIds[3])),
					}}},
				},
			},
			expectedNumUsers: 3,
		},
	}
	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			queryResult, err := teamSvc.GetTeamMembers(context.Background(), tt.query)
			require.NoError(t, err)
			assert.Len(t, queryResult, tt.expectedNumUsers)

			if !hasWildcardScope(tt.query.SignedInUser, ac.ActionOrgUsersRead) {
				for _, member := range queryResult {
					assert.Contains(t,
						tt.query.SignedInUser.GetPermissions()[ac.ActionOrgUsersRead],
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
