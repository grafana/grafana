package teamimpl

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotaimpl"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
)

func TestIntegrationTeamCommandsAndQueries(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	t.Run("Testing Team commands and queries", func(t *testing.T) {
		sqlStore := db.InitTestDB(t)
		teamSvc := ProvideService(sqlStore, sqlStore.Cfg)
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
		quotaService := quotaimpl.ProvideService(sqlStore, sqlStore.Cfg)
		orgSvc, err := orgimpl.ProvideService(sqlStore, sqlStore.Cfg, quotaService)
		require.NoError(t, err)
		userSvc, err := userimpl.ProvideService(sqlStore, orgSvc, sqlStore.Cfg, teamSvc, nil, quotaService,
			supportbundlestest.NewFakeBundleService())
		require.NoError(t, err)

		t.Run("Given saved users and two teams", func(t *testing.T) {
			var userIds []int64
			const testOrgID int64 = 1
			var team1, team2 team.Team
			var usr *user.User
			var userCmd user.CreateUserCommand
			var err error

			setup := func() {
				for i := 0; i < 5; i++ {
					userCmd = user.CreateUserCommand{
						Email: fmt.Sprint("user", i, "@test.com"),
						Name:  fmt.Sprint("user", i),
						Login: fmt.Sprint("loginuser", i),
					}
					usr, err = userSvc.Create(context.Background(), &userCmd)
					require.NoError(t, err)
					userIds = append(userIds, usr.ID)
				}
				team1, err = teamSvc.CreateTeam("group1 name", "test1@test.com", testOrgID)
				require.NoError(t, err)
				team2, err = teamSvc.CreateTeam("group2 name", "test2@test.com", testOrgID)
				require.NoError(t, err)
			}
			setup()

			t.Run("Should be able to create teams and add users", func(t *testing.T) {
				query := &team.SearchTeamsQuery{OrgID: testOrgID, Name: "group1 name", Page: 1, Limit: 10, SignedInUser: testUser}
				queryResult, err := teamSvc.SearchTeams(context.Background(), query)
				require.NoError(t, err)
				require.Equal(t, query.Page, 1)

				team1 := queryResult.Teams[0]
				require.Equal(t, team1.Name, "group1 name")
				require.Equal(t, team1.Email, "test1@test.com")
				require.Equal(t, team1.OrgID, testOrgID)
				require.EqualValues(t, team1.MemberCount, 0)

				err = teamSvc.AddTeamMember(userIds[0], testOrgID, team1.ID, false, 0)
				require.NoError(t, err)
				err = teamSvc.AddTeamMember(userIds[1], testOrgID, team1.ID, true, 0)
				require.NoError(t, err)

				q1 := &team.GetTeamMembersQuery{OrgID: testOrgID, TeamID: team1.ID, SignedInUser: testUser}
				q1Result, err := teamSvc.GetTeamMembers(context.Background(), q1)
				require.NoError(t, err)
				require.Equal(t, 2, len(q1Result))
				require.Equal(t, q1Result[0].TeamID, team1.ID)
				require.Equal(t, q1Result[0].Login, "loginuser0")
				require.Equal(t, q1Result[0].OrgID, testOrgID)
				require.Equal(t, q1Result[1].TeamID, team1.ID)
				require.Equal(t, q1Result[1].Login, "loginuser1")
				require.Equal(t, q1Result[1].OrgID, testOrgID)
				require.Equal(t, q1Result[1].External, true)

				q2 := &team.GetTeamMembersQuery{OrgID: testOrgID, TeamID: team1.ID, External: true, SignedInUser: testUser}
				q2Result, err := teamSvc.GetTeamMembers(context.Background(), q2)
				require.NoError(t, err)
				require.Equal(t, len(q2Result), 1)
				require.Equal(t, q2Result[0].TeamID, team1.ID)
				require.Equal(t, q2Result[0].Login, "loginuser1")
				require.Equal(t, q2Result[0].OrgID, testOrgID)
				require.Equal(t, q2Result[0].External, true)

				queryResult, err = teamSvc.SearchTeams(context.Background(), query)
				require.NoError(t, err)
				team1 = queryResult.Teams[0]
				require.EqualValues(t, team1.MemberCount, 2)

				getTeamQuery := &team.GetTeamByIDQuery{OrgID: testOrgID, ID: team1.ID, SignedInUser: testUser}
				getTeamQueryResult, err := teamSvc.GetTeamByID(context.Background(), getTeamQuery)
				require.NoError(t, err)
				team1 = getTeamQueryResult
				require.Equal(t, team1.Name, "group1 name")
				require.Equal(t, team1.Email, "test1@test.com")
				require.Equal(t, team1.OrgID, testOrgID)
				require.EqualValues(t, team1.MemberCount, 2)
			})

			t.Run("Should return latest auth module for users when getting team members", func(t *testing.T) {
				sqlStore = db.InitTestDB(t)
				setup()
				userId := userIds[1]

				teamQuery := &team.SearchTeamsQuery{OrgID: testOrgID, Name: "group1 name", Page: 1, Limit: 10, SignedInUser: testUser}
				teamQueryResult, err := teamSvc.SearchTeams(context.Background(), teamQuery)
				require.NoError(t, err)
				require.Equal(t, teamQuery.Page, 1)

				team1 := teamQueryResult.Teams[0]

				err = teamSvc.AddTeamMember(userId, testOrgID, team1.ID, true, 0)
				require.NoError(t, err)

				memberQuery := &team.GetTeamMembersQuery{OrgID: testOrgID, TeamID: team1.ID, External: true, SignedInUser: testUser}
				memberQueryResult, err := teamSvc.GetTeamMembers(context.Background(), memberQuery)
				require.NoError(t, err)
				require.Equal(t, len(memberQueryResult), 1)
				require.Equal(t, memberQueryResult[0].TeamID, team1.ID)
				require.Equal(t, memberQueryResult[0].Login, "loginuser1")
				require.Equal(t, memberQueryResult[0].OrgID, testOrgID)
				require.Equal(t, memberQueryResult[0].External, true)
			})

			t.Run("Should be able to update users in a team", func(t *testing.T) {
				userId := userIds[0]

				err = teamSvc.AddTeamMember(userId, testOrgID, team1.ID, false, 0)
				require.NoError(t, err)

				qBeforeUpdate := &team.GetTeamMembersQuery{OrgID: testOrgID, TeamID: team1.ID, SignedInUser: testUser}
				qBeforeUpdateResult, err := teamSvc.GetTeamMembers(context.Background(), qBeforeUpdate)
				require.NoError(t, err)
				require.EqualValues(t, qBeforeUpdateResult[0].Permission, 0)

				err = teamSvc.UpdateTeamMember(context.Background(), &team.UpdateTeamMemberCommand{
					UserID:     userId,
					OrgID:      testOrgID,
					TeamID:     team1.ID,
					Permission: dashboards.PERMISSION_ADMIN,
				})

				require.NoError(t, err)

				qAfterUpdate := &team.GetTeamMembersQuery{OrgID: testOrgID, TeamID: team1.ID, SignedInUser: testUser}
				qAfterUpdateResult, err := teamSvc.GetTeamMembers(context.Background(), qAfterUpdate)
				require.NoError(t, err)
				require.Equal(t, qAfterUpdateResult[0].Permission, dashboards.PERMISSION_ADMIN)
			})

			t.Run("Should default to member permission level when updating a user with invalid permission level", func(t *testing.T) {
				sqlStore = db.InitTestDB(t)
				setup()
				userID := userIds[0]
				err = teamSvc.AddTeamMember(userID, testOrgID, team1.ID, false, 0)
				require.NoError(t, err)

				qBeforeUpdate := &team.GetTeamMembersQuery{OrgID: testOrgID, TeamID: team1.ID, SignedInUser: testUser}
				qBeforeUpdateResult, err := teamSvc.GetTeamMembers(context.Background(), qBeforeUpdate)
				require.NoError(t, err)
				require.EqualValues(t, qBeforeUpdateResult[0].Permission, 0)

				invalidPermissionLevel := dashboards.PERMISSION_EDIT
				err = teamSvc.UpdateTeamMember(context.Background(), &team.UpdateTeamMemberCommand{
					UserID:     userID,
					OrgID:      testOrgID,
					TeamID:     team1.ID,
					Permission: invalidPermissionLevel,
				})

				require.NoError(t, err)

				qAfterUpdate := &team.GetTeamMembersQuery{OrgID: testOrgID, TeamID: team1.ID, SignedInUser: testUser}
				qAfterUpdateResult, err := teamSvc.GetTeamMembers(context.Background(), qAfterUpdate)
				require.NoError(t, err)
				require.EqualValues(t, qAfterUpdateResult[0].Permission, 0)
			})

			t.Run("Shouldn't be able to update a user not in the team.", func(t *testing.T) {
				sqlStore = db.InitTestDB(t)
				setup()
				err = teamSvc.UpdateTeamMember(context.Background(), &team.UpdateTeamMemberCommand{
					UserID:     1,
					OrgID:      testOrgID,
					TeamID:     team1.ID,
					Permission: dashboards.PERMISSION_ADMIN,
				})

				require.Error(t, err, team.ErrTeamMemberNotFound)
			})

			t.Run("Should be able to search for teams", func(t *testing.T) {
				query := &team.SearchTeamsQuery{OrgID: testOrgID, Query: "group", Page: 1, SignedInUser: testUser}
				queryResult, err := teamSvc.SearchTeams(context.Background(), query)
				require.NoError(t, err)
				require.Equal(t, len(queryResult.Teams), 2)
				require.EqualValues(t, queryResult.TotalCount, 2)

				query2 := &team.SearchTeamsQuery{OrgID: testOrgID, Query: "", SignedInUser: testUser}
				require.Equal(t, len(queryResult.Teams), 2)
				query2Result, err := teamSvc.SearchTeams(context.Background(), query2)
				require.NoError(t, err)
				require.Equal(t, len(query2Result.Teams), 2)
			})

			t.Run("Should be able to return all teams a user is member of", func(t *testing.T) {
				sqlStore = db.InitTestDB(t)
				setup()
				groupId := team2.ID
				err := teamSvc.AddTeamMember(userIds[0], testOrgID, groupId, false, 0)
				require.NoError(t, err)

				query := &team.GetTeamsByUserQuery{
					OrgID:  testOrgID,
					UserID: userIds[0],
					SignedInUser: &user.SignedInUser{
						OrgID:       testOrgID,
						Permissions: map[int64]map[string][]string{testOrgID: {ac.ActionOrgUsersRead: {ac.ScopeUsersAll}, ac.ActionTeamsRead: {ac.ScopeTeamsAll}}},
					},
				}
				queryResult, err := teamSvc.GetTeamsByUser(context.Background(), query)
				require.NoError(t, err)
				require.Equal(t, len(queryResult), 1)
				require.Equal(t, queryResult[0].Name, "group2 name")
				require.Equal(t, queryResult[0].Email, "test2@test.com")
			})

			t.Run("Should be able to remove users from a group", func(t *testing.T) {
				err = teamSvc.AddTeamMember(userIds[0], testOrgID, team1.ID, false, 0)
				require.NoError(t, err)

				err = teamSvc.RemoveTeamMember(context.Background(), &team.RemoveTeamMemberCommand{OrgID: testOrgID, TeamID: team1.ID, UserID: userIds[0]})
				require.NoError(t, err)

				q2 := &team.GetTeamMembersQuery{OrgID: testOrgID, TeamID: team1.ID, SignedInUser: testUser}
				q2Result, err := teamSvc.GetTeamMembers(context.Background(), q2)
				require.NoError(t, err)
				require.Equal(t, len(q2Result), 0)
			})

			t.Run("Should have empty teams", func(t *testing.T) {
				err = teamSvc.AddTeamMember(userIds[0], testOrgID, team1.ID, false, dashboards.PERMISSION_ADMIN)
				require.NoError(t, err)

				t.Run("A user should be able to remove the admin permission for the last admin", func(t *testing.T) {
					err = teamSvc.UpdateTeamMember(context.Background(), &team.UpdateTeamMemberCommand{OrgID: testOrgID, TeamID: team1.ID, UserID: userIds[0], Permission: 0})
					require.NoError(t, err)
				})

				t.Run("A user should be able to remove the last member", func(t *testing.T) {
					err = teamSvc.RemoveTeamMember(context.Background(), &team.RemoveTeamMemberCommand{OrgID: testOrgID, TeamID: team1.ID, UserID: userIds[0]})
					require.NoError(t, err)
				})

				t.Run("A user should be able to remove the admin permission if there are other admins", func(t *testing.T) {
					sqlStore = db.InitTestDB(t)
					setup()

					err = teamSvc.AddTeamMember(userIds[0], testOrgID, team1.ID, false, dashboards.PERMISSION_ADMIN)
					require.NoError(t, err)

					err = teamSvc.AddTeamMember(userIds[1], testOrgID, team1.ID, false, dashboards.PERMISSION_ADMIN)
					require.NoError(t, err)
					err = teamSvc.UpdateTeamMember(context.Background(), &team.UpdateTeamMemberCommand{OrgID: testOrgID, TeamID: team1.ID, UserID: userIds[0], Permission: 0})
					require.NoError(t, err)
				})
			})

			t.Run("Should be able to remove a group with users and permissions", func(t *testing.T) {
				groupID := team2.ID
				err := teamSvc.AddTeamMember(userIds[1], testOrgID, groupID, false, 0)
				require.NoError(t, err)
				err = teamSvc.AddTeamMember(userIds[2], testOrgID, groupID, false, 0)
				require.NoError(t, err)
				err = updateDashboardACL(t, sqlStore, 1, &dashboards.DashboardACL{
					DashboardID: 1, OrgID: testOrgID, Permission: dashboards.PERMISSION_EDIT, TeamID: groupID,
				})
				require.NoError(t, err)
				err = teamSvc.DeleteTeam(context.Background(), &team.DeleteTeamCommand{OrgID: testOrgID, ID: groupID})
				require.NoError(t, err)

				query := &team.GetTeamByIDQuery{OrgID: testOrgID, ID: groupID}
				_, err = teamSvc.GetTeamByID(context.Background(), query)
				require.Equal(t, err, team.ErrTeamNotFound)

				permQuery := &dashboards.GetDashboardACLInfoListQuery{DashboardID: 1, OrgID: testOrgID}
				permQueryResult, err := getDashboardACLInfoList(sqlStore, permQuery)
				require.NoError(t, err)

				require.Equal(t, len(permQueryResult), 0)
			})

			t.Run("Should be able to return if user is admin of teams or not", func(t *testing.T) {
				sqlStore = db.InitTestDB(t)
				setup()
				groupId := team2.ID
				err := teamSvc.AddTeamMember(userIds[0], testOrgID, groupId, false, 0)
				require.NoError(t, err)
				err = teamSvc.AddTeamMember(userIds[1], testOrgID, groupId, false, dashboards.PERMISSION_ADMIN)
				require.NoError(t, err)

				query := &team.IsAdminOfTeamsQuery{SignedInUser: &user.SignedInUser{OrgID: testOrgID, UserID: userIds[0]}}
				queryResult, err := teamSvc.IsAdminOfTeams(context.Background(), query)
				require.NoError(t, err)
				require.False(t, queryResult)

				query = &team.IsAdminOfTeamsQuery{SignedInUser: &user.SignedInUser{OrgID: testOrgID, UserID: userIds[1]}}
				queryResult, err = teamSvc.IsAdminOfTeams(context.Background(), query)
				require.NoError(t, err)
				require.True(t, queryResult)
			})

			t.Run("Should not return hidden users in team member count", func(t *testing.T) {
				sqlStore = db.InitTestDB(t)
				setup()
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

				teamId := team1.ID
				err = teamSvc.AddTeamMember(userIds[0], testOrgID, teamId, false, 0)
				require.NoError(t, err)
				err = teamSvc.AddTeamMember(userIds[1], testOrgID, teamId, false, 0)
				require.NoError(t, err)
				err = teamSvc.AddTeamMember(userIds[2], testOrgID, teamId, false, 0)
				require.NoError(t, err)

				searchQuery := &team.SearchTeamsQuery{OrgID: testOrgID, Page: 1, Limit: 10, SignedInUser: signedInUser, HiddenUsers: hiddenUsers}
				searchQueryResult, err := teamSvc.SearchTeams(context.Background(), searchQuery)
				require.NoError(t, err)
				require.Equal(t, len(searchQueryResult.Teams), 2)
				team1 := searchQueryResult.Teams[0]
				require.EqualValues(t, team1.MemberCount, 2)

				searchQueryFilteredByUser := &team.SearchTeamsQuery{OrgID: testOrgID, Page: 1, Limit: 10, UserIDFilter: userIds[0], SignedInUser: signedInUser, HiddenUsers: hiddenUsers}
				searchQueryFilteredByUserResult, err := teamSvc.SearchTeams(context.Background(), searchQueryFilteredByUser)
				require.NoError(t, err)
				require.Equal(t, len(searchQueryFilteredByUserResult.Teams), 1)
				team1 = searchQueryResult.Teams[0]
				require.EqualValues(t, team1.MemberCount, 2)

				getTeamQuery := &team.GetTeamByIDQuery{OrgID: testOrgID, ID: teamId, SignedInUser: signedInUser, HiddenUsers: hiddenUsers}
				getTeamQueryResult, err := teamSvc.GetTeamByID(context.Background(), getTeamQuery)
				require.NoError(t, err)
				require.EqualValues(t, getTeamQueryResult.MemberCount, 2)
			})

			t.Run("Should be able to exclude service accounts from teamembers", func(t *testing.T) {
				sqlStore = db.InitTestDB(t)
				quotaService := quotaimpl.ProvideService(sqlStore, sqlStore.Cfg)
				orgSvc, err := orgimpl.ProvideService(sqlStore, sqlStore.Cfg, quotaService)
				require.NoError(t, err)
				userSvc, err := userimpl.ProvideService(sqlStore, orgSvc, sqlStore.Cfg, teamSvc, nil, quotaService, supportbundlestest.NewFakeBundleService())
				require.NoError(t, err)
				setup()
				userCmd = user.CreateUserCommand{
					Email:            fmt.Sprint("sa", 1, "@test.com"),
					Name:             fmt.Sprint("sa", 1),
					Login:            fmt.Sprint("login-sa", 1),
					IsServiceAccount: true,
				}
				serviceAccount, err := userSvc.Create(context.Background(), &userCmd)
				require.NoError(t, err)

				groupId := team2.ID
				// add service account to team
				err = teamSvc.AddTeamMember(serviceAccount.ID, testOrgID, groupId, false, 0)
				require.NoError(t, err)

				// add user to team
				err = teamSvc.AddTeamMember(userIds[0], testOrgID, groupId, false, 0)
				require.NoError(t, err)

				teamMembersQuery := &team.GetTeamMembersQuery{
					OrgID:        testOrgID,
					SignedInUser: testUser,
					TeamID:       groupId,
				}
				teamMembersQueryResult, err := teamSvc.GetTeamMembers(context.Background(), teamMembersQuery)
				require.NoError(t, err)
				// should not receive service account from query
				require.Equal(t, len(teamMembersQueryResult), 1)
			})
		})
	})
}

func TestIntegrationSQLStore_SearchTeams(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	type searchTeamsTestCase struct {
		desc             string
		query            *team.SearchTeamsQuery
		expectedNumUsers int
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
			expectedNumUsers: 10,
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
			expectedNumUsers: 0,
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
			expectedNumUsers: 3,
		},
	}

	store := db.InitTestDB(t, db.InitTestDBOpt{})
	teamSvc := ProvideService(store, store.Cfg)

	// Seed 10 teams
	for i := 1; i <= 10; i++ {
		_, err := teamSvc.CreateTeam(fmt.Sprintf("team-%d", i), fmt.Sprintf("team-%d@example.org", i), 1)
		require.NoError(t, err)
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			queryResult, err := teamSvc.SearchTeams(context.Background(), tt.query)
			require.NoError(t, err)
			assert.Len(t, queryResult.Teams, tt.expectedNumUsers)
			assert.Equal(t, queryResult.TotalCount, int64(tt.expectedNumUsers))

			if !hasWildcardScope(tt.query.SignedInUser, ac.ActionTeamsRead) {
				for _, team := range queryResult.Teams {
					assert.Contains(t, tt.query.SignedInUser.Permissions[tt.query.SignedInUser.OrgID][ac.ActionTeamsRead], fmt.Sprintf("teams:id:%d", team.ID))
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
	testOrgID := int64(2)
	userIds := make([]int64, 4)

	// Seed 2 teams with 2 members
	setup := func(store *sqlstore.SQLStore) {
		teamSvc := ProvideService(store, store.Cfg)
		team1, errCreateTeam := teamSvc.CreateTeam("group1 name", "test1@example.org", testOrgID)
		require.NoError(t, errCreateTeam)
		team2, errCreateTeam := teamSvc.CreateTeam("group2 name", "test2@example.org", testOrgID)
		require.NoError(t, errCreateTeam)
		quotaService := quotaimpl.ProvideService(store, store.Cfg)
		orgSvc, err := orgimpl.ProvideService(store, store.Cfg, quotaService)
		require.NoError(t, err)
		userSvc, err := userimpl.ProvideService(store, orgSvc, store.Cfg, teamSvc, nil, quotaService, supportbundlestest.NewFakeBundleService())
		require.NoError(t, err)

		for i := 0; i < 4; i++ {
			userCmd := user.CreateUserCommand{
				Email: fmt.Sprint("user", i, "@example.org"),
				Name:  fmt.Sprint("user", i),
				Login: fmt.Sprint("loginuser", i),
			}
			user, errCreateUser := userSvc.Create(context.Background(), &userCmd)
			require.NoError(t, errCreateUser)
			userIds[i] = user.ID
		}

		errAddMember := teamSvc.AddTeamMember(userIds[0], testOrgID, team1.ID, false, 0)
		require.NoError(t, errAddMember)
		errAddMember = teamSvc.AddTeamMember(userIds[1], testOrgID, team1.ID, false, 0)
		require.NoError(t, errAddMember)
		errAddMember = teamSvc.AddTeamMember(userIds[2], testOrgID, team2.ID, false, 0)
		require.NoError(t, errAddMember)
		errAddMember = teamSvc.AddTeamMember(userIds[3], testOrgID, team2.ID, false, 0)
		require.NoError(t, errAddMember)
	}

	store := db.InitTestDB(t, db.InitTestDBOpt{})
	setup(store)
	teamSvc := ProvideService(store, store.Cfg)

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
						tt.query.SignedInUser.Permissions[tt.query.SignedInUser.OrgID][ac.ActionOrgUsersRead],
						ac.Scope("users", "id", fmt.Sprintf("%d", member.UserID)),
					)
				}
			}
		})
	}
}

func hasWildcardScope(user *user.SignedInUser, action string) bool {
	for _, scope := range user.Permissions[user.OrgID][action] {
		if strings.HasSuffix(scope, ":*") {
			return true
		}
	}
	return false
}

// TODO: Use FakeDashboardStore when org has its own service
func updateDashboardACL(t *testing.T, sqlStore *sqlstore.SQLStore, dashboardID int64, items ...*dashboards.DashboardACL) error {
	t.Helper()

	err := sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		_, err := sess.Exec("DELETE FROM dashboard_acl WHERE dashboard_id=?", dashboardID)
		if err != nil {
			return fmt.Errorf("deleting from dashboard_acl failed: %w", err)
		}

		for _, item := range items {
			item.Created = time.Now()
			item.Updated = time.Now()
			if item.UserID == 0 && item.TeamID == 0 && (item.Role == nil || !item.Role.IsValid()) {
				return dashboards.ErrDashboardACLInfoMissing
			}

			if item.DashboardID == 0 {
				return dashboards.ErrDashboardPermissionDashboardEmpty
			}

			sess.Nullable("user_id", "team_id")
			if _, err := sess.Insert(item); err != nil {
				return err
			}
		}

		// Update dashboard HasACL flag
		dashboard := dashboards.Dashboard{HasACL: true}
		_, err = sess.Cols("has_acl").Where("id=?", dashboardID).Update(&dashboard)
		return err
	})
	return err
}

// This function was copied from pkg/services/dashboards/database to circumvent
// import cycles. When this org-related code is refactored into a service the
// tests can the real GetDashboardACLInfoList functions
func getDashboardACLInfoList(s *sqlstore.SQLStore, query *dashboards.GetDashboardACLInfoListQuery) ([]*dashboards.DashboardACLInfoDTO, error) {
	queryResult := make([]*dashboards.DashboardACLInfoDTO, 0)
	outerErr := s.WithDbSession(context.Background(), func(dbSession *db.Session) error {
		falseStr := s.GetDialect().BooleanStr(false)

		if query.DashboardID == 0 {
			sql := `SELECT
		da.id,
		da.org_id,
		da.dashboard_id,
		da.user_id,
		da.team_id,
		da.permission,
		da.role,
		da.created,
		da.updated,
		'' as user_login,
		'' as user_email,
		'' as team,
		'' as title,
		'' as slug,
		'' as uid,` +
				falseStr + ` AS is_folder,` +
				falseStr + ` AS inherited
		FROM dashboard_acl as da
		WHERE da.dashboard_id = -1`
			return dbSession.SQL(sql).Find(&queryResult)
		}

		rawSQL := `
			-- get permissions for the dashboard and its parent folder
			SELECT
				da.id,
				da.org_id,
				da.dashboard_id,
				da.user_id,
				da.team_id,
				da.permission,
				da.role,
				da.created,
				da.updated,
				u.login AS user_login,
				u.email AS user_email,
				ug.name AS team,
				ug.email AS team_email,
				d.title,
				d.slug,
				d.uid,
				d.is_folder,
				CASE WHEN (da.dashboard_id = -1 AND d.folder_id > 0) OR da.dashboard_id = d.folder_id THEN ` + s.GetDialect().BooleanStr(true) + ` ELSE ` + falseStr + ` END AS inherited
			FROM dashboard as d
				LEFT JOIN dashboard folder on folder.id = d.folder_id
				LEFT JOIN dashboard_acl AS da ON
				da.dashboard_id = d.id OR
				da.dashboard_id = d.folder_id OR
				(
					-- include default permissions -->
					da.org_id = -1 AND (
					  (folder.id IS NOT NULL AND folder.has_acl = ` + falseStr + `) OR
					  (folder.id IS NULL AND d.has_acl = ` + falseStr + `)
					)
				)
				LEFT JOIN ` + s.GetDialect().Quote("user") + ` AS u ON u.id = da.user_id
				LEFT JOIN team ug on ug.id = da.team_id
			WHERE d.org_id = ? AND d.id = ? AND da.id IS NOT NULL
			ORDER BY da.id ASC
			`

		return dbSession.SQL(rawSQL, query.OrgID, query.DashboardID).Find(&queryResult)
	})

	if outerErr != nil {
		return nil, outerErr
	}

	for _, p := range queryResult {
		p.PermissionName = p.Permission.String()
	}

	return queryResult, nil
}
