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
	"github.com/grafana/grafana/pkg/models"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestIntegrationTeamCommandsAndQueries(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	t.Run("Testing Team commands & queries", func(t *testing.T) {
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

		t.Run("Given saved users and two teams", func(t *testing.T) {
			var userIds []int64
			const testOrgID int64 = 1
			var team1, team2 models.Team
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
					usr, err = sqlStore.CreateUser(context.Background(), userCmd)
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
				query := &models.SearchTeamsQuery{OrgId: testOrgID, Name: "group1 name", Page: 1, Limit: 10, SignedInUser: testUser}
				err = teamSvc.SearchTeams(context.Background(), query)
				require.NoError(t, err)
				require.Equal(t, query.Page, 1)

				team1 := query.Result.Teams[0]
				require.Equal(t, team1.Name, "group1 name")
				require.Equal(t, team1.Email, "test1@test.com")
				require.Equal(t, team1.OrgId, testOrgID)
				require.EqualValues(t, team1.MemberCount, 0)

				err = teamSvc.AddTeamMember(userIds[0], testOrgID, team1.Id, false, 0)
				require.NoError(t, err)
				err = teamSvc.AddTeamMember(userIds[1], testOrgID, team1.Id, true, 0)
				require.NoError(t, err)

				q1 := &models.GetTeamMembersQuery{OrgId: testOrgID, TeamId: team1.Id, SignedInUser: testUser}
				err = teamSvc.GetTeamMembers(context.Background(), q1)
				require.NoError(t, err)
				require.Equal(t, len(q1.Result), 2)
				require.Equal(t, q1.Result[0].TeamId, team1.Id)
				require.Equal(t, q1.Result[0].Login, "loginuser0")
				require.Equal(t, q1.Result[0].OrgId, testOrgID)
				require.Equal(t, q1.Result[1].TeamId, team1.Id)
				require.Equal(t, q1.Result[1].Login, "loginuser1")
				require.Equal(t, q1.Result[1].OrgId, testOrgID)
				require.Equal(t, q1.Result[1].External, true)

				q2 := &models.GetTeamMembersQuery{OrgId: testOrgID, TeamId: team1.Id, External: true, SignedInUser: testUser}
				err = teamSvc.GetTeamMembers(context.Background(), q2)
				require.NoError(t, err)
				require.Equal(t, len(q2.Result), 1)
				require.Equal(t, q2.Result[0].TeamId, team1.Id)
				require.Equal(t, q2.Result[0].Login, "loginuser1")
				require.Equal(t, q2.Result[0].OrgId, testOrgID)
				require.Equal(t, q2.Result[0].External, true)

				err = teamSvc.SearchTeams(context.Background(), query)
				require.NoError(t, err)
				team1 = query.Result.Teams[0]
				require.EqualValues(t, team1.MemberCount, 2)

				getTeamQuery := &models.GetTeamByIdQuery{OrgId: testOrgID, Id: team1.Id, SignedInUser: testUser}
				err = teamSvc.GetTeamById(context.Background(), getTeamQuery)
				require.NoError(t, err)
				team1 = getTeamQuery.Result
				require.Equal(t, team1.Name, "group1 name")
				require.Equal(t, team1.Email, "test1@test.com")
				require.Equal(t, team1.OrgId, testOrgID)
				require.EqualValues(t, team1.MemberCount, 2)
			})

			t.Run("Should return latest auth module for users when getting team members", func(t *testing.T) {
				sqlStore = db.InitTestDB(t)
				setup()
				userId := userIds[1]

				teamQuery := &models.SearchTeamsQuery{OrgId: testOrgID, Name: "group1 name", Page: 1, Limit: 10, SignedInUser: testUser}
				err = teamSvc.SearchTeams(context.Background(), teamQuery)
				require.NoError(t, err)
				require.Equal(t, teamQuery.Page, 1)

				team1 := teamQuery.Result.Teams[0]

				err = teamSvc.AddTeamMember(userId, testOrgID, team1.Id, true, 0)
				require.NoError(t, err)

				memberQuery := &models.GetTeamMembersQuery{OrgId: testOrgID, TeamId: team1.Id, External: true, SignedInUser: testUser}
				err = teamSvc.GetTeamMembers(context.Background(), memberQuery)
				require.NoError(t, err)
				require.Equal(t, len(memberQuery.Result), 1)
				require.Equal(t, memberQuery.Result[0].TeamId, team1.Id)
				require.Equal(t, memberQuery.Result[0].Login, "loginuser1")
				require.Equal(t, memberQuery.Result[0].OrgId, testOrgID)
				require.Equal(t, memberQuery.Result[0].External, true)
			})

			t.Run("Should be able to update users in a team", func(t *testing.T) {
				userId := userIds[0]
				team := team1
				err = teamSvc.AddTeamMember(userId, testOrgID, team.Id, false, 0)
				require.NoError(t, err)

				qBeforeUpdate := &models.GetTeamMembersQuery{OrgId: testOrgID, TeamId: team.Id, SignedInUser: testUser}
				err = teamSvc.GetTeamMembers(context.Background(), qBeforeUpdate)
				require.NoError(t, err)
				require.EqualValues(t, qBeforeUpdate.Result[0].Permission, 0)

				err = teamSvc.UpdateTeamMember(context.Background(), &models.UpdateTeamMemberCommand{
					UserId:     userId,
					OrgId:      testOrgID,
					TeamId:     team.Id,
					Permission: models.PERMISSION_ADMIN,
				})

				require.NoError(t, err)

				qAfterUpdate := &models.GetTeamMembersQuery{OrgId: testOrgID, TeamId: team.Id, SignedInUser: testUser}
				err = teamSvc.GetTeamMembers(context.Background(), qAfterUpdate)
				require.NoError(t, err)
				require.Equal(t, qAfterUpdate.Result[0].Permission, models.PERMISSION_ADMIN)
			})

			t.Run("Should default to member permission level when updating a user with invalid permission level", func(t *testing.T) {
				sqlStore = db.InitTestDB(t)
				setup()
				userID := userIds[0]
				team := team1
				err = teamSvc.AddTeamMember(userID, testOrgID, team.Id, false, 0)
				require.NoError(t, err)

				qBeforeUpdate := &models.GetTeamMembersQuery{OrgId: testOrgID, TeamId: team.Id, SignedInUser: testUser}
				err = teamSvc.GetTeamMembers(context.Background(), qBeforeUpdate)
				require.NoError(t, err)
				require.EqualValues(t, qBeforeUpdate.Result[0].Permission, 0)

				invalidPermissionLevel := models.PERMISSION_EDIT
				err = teamSvc.UpdateTeamMember(context.Background(), &models.UpdateTeamMemberCommand{
					UserId:     userID,
					OrgId:      testOrgID,
					TeamId:     team.Id,
					Permission: invalidPermissionLevel,
				})

				require.NoError(t, err)

				qAfterUpdate := &models.GetTeamMembersQuery{OrgId: testOrgID, TeamId: team.Id, SignedInUser: testUser}
				err = teamSvc.GetTeamMembers(context.Background(), qAfterUpdate)
				require.NoError(t, err)
				require.EqualValues(t, qAfterUpdate.Result[0].Permission, 0)
			})

			t.Run("Shouldn't be able to update a user not in the team.", func(t *testing.T) {
				sqlStore = db.InitTestDB(t)
				setup()
				err = teamSvc.UpdateTeamMember(context.Background(), &models.UpdateTeamMemberCommand{
					UserId:     1,
					OrgId:      testOrgID,
					TeamId:     team1.Id,
					Permission: models.PERMISSION_ADMIN,
				})

				require.Error(t, err, models.ErrTeamMemberNotFound)
			})

			t.Run("Should be able to search for teams", func(t *testing.T) {
				query := &models.SearchTeamsQuery{OrgId: testOrgID, Query: "group", Page: 1, SignedInUser: testUser}
				err = teamSvc.SearchTeams(context.Background(), query)
				require.NoError(t, err)
				require.Equal(t, len(query.Result.Teams), 2)
				require.EqualValues(t, query.Result.TotalCount, 2)

				query2 := &models.SearchTeamsQuery{OrgId: testOrgID, Query: "", SignedInUser: testUser}
				err = teamSvc.SearchTeams(context.Background(), query2)
				require.NoError(t, err)
				require.Equal(t, len(query2.Result.Teams), 2)
			})

			t.Run("Should be able to return all teams a user is member of", func(t *testing.T) {
				sqlStore = db.InitTestDB(t)
				setup()
				groupId := team2.Id
				err := teamSvc.AddTeamMember(userIds[0], testOrgID, groupId, false, 0)
				require.NoError(t, err)

				query := &models.GetTeamsByUserQuery{
					OrgId:  testOrgID,
					UserId: userIds[0],
					SignedInUser: &user.SignedInUser{
						OrgID:       testOrgID,
						Permissions: map[int64]map[string][]string{testOrgID: {ac.ActionOrgUsersRead: {ac.ScopeUsersAll}, ac.ActionTeamsRead: {ac.ScopeTeamsAll}}},
					},
				}
				err = sqlStore.GetTeamsByUser(context.Background(), query)
				require.NoError(t, err)
				require.Equal(t, len(query.Result), 1)
				require.Equal(t, query.Result[0].Name, "group2 name")
				require.Equal(t, query.Result[0].Email, "test2@test.com")
			})

			t.Run("Should be able to remove users from a group", func(t *testing.T) {
				err = teamSvc.AddTeamMember(userIds[0], testOrgID, team1.Id, false, 0)
				require.NoError(t, err)

				err = teamSvc.RemoveTeamMember(context.Background(), &models.RemoveTeamMemberCommand{OrgId: testOrgID, TeamId: team1.Id, UserId: userIds[0]})
				require.NoError(t, err)

				q2 := &models.GetTeamMembersQuery{OrgId: testOrgID, TeamId: team1.Id, SignedInUser: testUser}
				err = teamSvc.GetTeamMembers(context.Background(), q2)
				require.NoError(t, err)
				require.Equal(t, len(q2.Result), 0)
			})

			t.Run("Should have empty teams", func(t *testing.T) {
				err = teamSvc.AddTeamMember(userIds[0], testOrgID, team1.Id, false, models.PERMISSION_ADMIN)
				require.NoError(t, err)

				t.Run("A user should be able to remove the admin permission for the last admin", func(t *testing.T) {
					err = teamSvc.UpdateTeamMember(context.Background(), &models.UpdateTeamMemberCommand{OrgId: testOrgID, TeamId: team1.Id, UserId: userIds[0], Permission: 0})
					require.NoError(t, err)
				})

				t.Run("A user should be able to remove the last member", func(t *testing.T) {
					err = teamSvc.RemoveTeamMember(context.Background(), &models.RemoveTeamMemberCommand{OrgId: testOrgID, TeamId: team1.Id, UserId: userIds[0]})
					require.NoError(t, err)
				})

				t.Run("A user should be able to remove the admin permission if there are other admins", func(t *testing.T) {
					sqlStore = db.InitTestDB(t)
					setup()

					err = teamSvc.AddTeamMember(userIds[0], testOrgID, team1.Id, false, models.PERMISSION_ADMIN)
					require.NoError(t, err)

					err = teamSvc.AddTeamMember(userIds[1], testOrgID, team1.Id, false, models.PERMISSION_ADMIN)
					require.NoError(t, err)
					err = teamSvc.UpdateTeamMember(context.Background(), &models.UpdateTeamMemberCommand{OrgId: testOrgID, TeamId: team1.Id, UserId: userIds[0], Permission: 0})
					require.NoError(t, err)
				})
			})

			t.Run("Should be able to remove a group with users and permissions", func(t *testing.T) {
				groupId := team2.Id
				err := teamSvc.AddTeamMember(userIds[1], testOrgID, groupId, false, 0)
				require.NoError(t, err)
				err = teamSvc.AddTeamMember(userIds[2], testOrgID, groupId, false, 0)
				require.NoError(t, err)
				err = updateDashboardACL(t, sqlStore, 1, &models.DashboardACL{
					DashboardID: 1, OrgID: testOrgID, Permission: models.PERMISSION_EDIT, TeamID: groupId,
				})
				require.NoError(t, err)
				err = teamSvc.DeleteTeam(context.Background(), &models.DeleteTeamCommand{OrgId: testOrgID, Id: groupId})
				require.NoError(t, err)

				query := &models.GetTeamByIdQuery{OrgId: testOrgID, Id: groupId}
				err = teamSvc.GetTeamById(context.Background(), query)
				require.Equal(t, err, models.ErrTeamNotFound)

				permQuery := &models.GetDashboardACLInfoListQuery{DashboardID: 1, OrgID: testOrgID}
				err = getDashboardACLInfoList(sqlStore, permQuery)
				require.NoError(t, err)

				require.Equal(t, len(permQuery.Result), 0)
			})

			t.Run("Should be able to return if user is admin of teams or not", func(t *testing.T) {
				sqlStore = db.InitTestDB(t)
				setup()
				groupId := team2.Id
				err := teamSvc.AddTeamMember(userIds[0], testOrgID, groupId, false, 0)
				require.NoError(t, err)
				err = teamSvc.AddTeamMember(userIds[1], testOrgID, groupId, false, models.PERMISSION_ADMIN)
				require.NoError(t, err)

				query := &models.IsAdminOfTeamsQuery{SignedInUser: &user.SignedInUser{OrgID: testOrgID, UserID: userIds[0]}}
				err = teamSvc.IsAdminOfTeams(context.Background(), query)
				require.NoError(t, err)
				require.False(t, query.Result)

				query = &models.IsAdminOfTeamsQuery{SignedInUser: &user.SignedInUser{OrgID: testOrgID, UserID: userIds[1]}}
				err = teamSvc.IsAdminOfTeams(context.Background(), query)
				require.NoError(t, err)
				require.True(t, query.Result)
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

				teamId := team1.Id
				err = teamSvc.AddTeamMember(userIds[0], testOrgID, teamId, false, 0)
				require.NoError(t, err)
				err = teamSvc.AddTeamMember(userIds[1], testOrgID, teamId, false, 0)
				require.NoError(t, err)
				err = teamSvc.AddTeamMember(userIds[2], testOrgID, teamId, false, 0)
				require.NoError(t, err)

				searchQuery := &models.SearchTeamsQuery{OrgId: testOrgID, Page: 1, Limit: 10, SignedInUser: signedInUser, HiddenUsers: hiddenUsers}
				err = teamSvc.SearchTeams(context.Background(), searchQuery)
				require.NoError(t, err)
				require.Equal(t, len(searchQuery.Result.Teams), 2)
				team1 := searchQuery.Result.Teams[0]
				require.EqualValues(t, team1.MemberCount, 2)

				searchQueryFilteredByUser := &models.SearchTeamsQuery{OrgId: testOrgID, Page: 1, Limit: 10, UserIdFilter: userIds[0], SignedInUser: signedInUser, HiddenUsers: hiddenUsers}
				err = teamSvc.SearchTeams(context.Background(), searchQueryFilteredByUser)
				require.NoError(t, err)
				require.Equal(t, len(searchQueryFilteredByUser.Result.Teams), 1)
				team1 = searchQuery.Result.Teams[0]
				require.EqualValues(t, team1.MemberCount, 2)

				getTeamQuery := &models.GetTeamByIdQuery{OrgId: testOrgID, Id: teamId, SignedInUser: signedInUser, HiddenUsers: hiddenUsers}
				err = teamSvc.GetTeamById(context.Background(), getTeamQuery)
				require.NoError(t, err)
				require.EqualValues(t, getTeamQuery.Result.MemberCount, 2)
			})

			t.Run("Should be able to exclude service accounts from teamembers", func(t *testing.T) {
				sqlStore = db.InitTestDB(t)
				setup()
				userCmd = user.CreateUserCommand{
					Email:            fmt.Sprint("sa", 1, "@test.com"),
					Name:             fmt.Sprint("sa", 1),
					Login:            fmt.Sprint("login-sa", 1),
					IsServiceAccount: true,
				}
				serviceAccount, err := sqlStore.CreateUser(context.Background(), userCmd)
				require.NoError(t, err)

				groupId := team2.Id
				// add service account to team
				err = teamSvc.AddTeamMember(serviceAccount.ID, testOrgID, groupId, false, 0)
				require.NoError(t, err)

				// add user to team
				err = teamSvc.AddTeamMember(userIds[0], testOrgID, groupId, false, 0)
				require.NoError(t, err)

				teamMembersQuery := &models.GetTeamMembersQuery{
					OrgId:        testOrgID,
					SignedInUser: testUser,
					TeamId:       groupId,
				}
				err = teamSvc.GetTeamMembers(context.Background(), teamMembersQuery)
				require.NoError(t, err)
				// should not receive service account from query
				require.Equal(t, len(teamMembersQuery.Result), 1)
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
		query            *models.SearchTeamsQuery
		expectedNumUsers int
	}

	tests := []searchTeamsTestCase{
		{
			desc: "should return all teams",
			query: &models.SearchTeamsQuery{
				OrgId: 1,
				SignedInUser: &user.SignedInUser{
					OrgID:       1,
					Permissions: map[int64]map[string][]string{1: {ac.ActionTeamsRead: {ac.ScopeTeamsAll}}},
				},
			},
			expectedNumUsers: 10,
		},
		{
			desc: "should return no teams",
			query: &models.SearchTeamsQuery{
				OrgId: 1,
				SignedInUser: &user.SignedInUser{
					OrgID:       1,
					Permissions: map[int64]map[string][]string{1: {ac.ActionTeamsRead: {""}}},
				},
			},
			expectedNumUsers: 0,
		},
		{
			desc: "should return some teams",
			query: &models.SearchTeamsQuery{
				OrgId: 1,
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
			err := teamSvc.SearchTeams(context.Background(), tt.query)
			require.NoError(t, err)
			assert.Len(t, tt.query.Result.Teams, tt.expectedNumUsers)
			assert.Equal(t, tt.query.Result.TotalCount, int64(tt.expectedNumUsers))

			if !hasWildcardScope(tt.query.SignedInUser, ac.ActionTeamsRead) {
				for _, team := range tt.query.Result.Teams {
					assert.Contains(t, tt.query.SignedInUser.Permissions[tt.query.SignedInUser.OrgID][ac.ActionTeamsRead], fmt.Sprintf("teams:id:%d", team.Id))
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

		for i := 0; i < 4; i++ {
			userCmd := user.CreateUserCommand{
				Email: fmt.Sprint("user", i, "@example.org"),
				Name:  fmt.Sprint("user", i),
				Login: fmt.Sprint("loginuser", i),
			}
			user, errCreateUser := store.CreateUser(context.Background(), userCmd)
			require.NoError(t, errCreateUser)
			userIds[i] = user.ID
		}

		errAddMember := teamSvc.AddTeamMember(userIds[0], testOrgID, team1.Id, false, 0)
		require.NoError(t, errAddMember)
		errAddMember = teamSvc.AddTeamMember(userIds[1], testOrgID, team1.Id, false, 0)
		require.NoError(t, errAddMember)
		errAddMember = teamSvc.AddTeamMember(userIds[2], testOrgID, team2.Id, false, 0)
		require.NoError(t, errAddMember)
		errAddMember = teamSvc.AddTeamMember(userIds[3], testOrgID, team2.Id, false, 0)
		require.NoError(t, errAddMember)
	}

	store := db.InitTestDB(t, db.InitTestDBOpt{})
	setup(store)
	teamSvc := ProvideService(store, store.Cfg)

	type getTeamMembersTestCase struct {
		desc             string
		query            *models.GetTeamMembersQuery
		expectedNumUsers int
	}

	tests := []getTeamMembersTestCase{
		{
			desc: "should return all team members",
			query: &models.GetTeamMembersQuery{
				OrgId: testOrgID,
				SignedInUser: &user.SignedInUser{
					OrgID:       testOrgID,
					Permissions: map[int64]map[string][]string{testOrgID: {ac.ActionOrgUsersRead: {ac.ScopeUsersAll}}},
				},
			},
			expectedNumUsers: 4,
		},
		{
			desc: "should return no team members",
			query: &models.GetTeamMembersQuery{
				OrgId: testOrgID,
				SignedInUser: &user.SignedInUser{
					OrgID:       testOrgID,
					Permissions: map[int64]map[string][]string{testOrgID: {ac.ActionOrgUsersRead: {""}}},
				},
			},
			expectedNumUsers: 0,
		},
		{

			desc: "should return some team members",
			query: &models.GetTeamMembersQuery{
				OrgId: testOrgID,
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
			err := teamSvc.GetTeamMembers(context.Background(), tt.query)
			require.NoError(t, err)
			assert.Len(t, tt.query.Result, tt.expectedNumUsers)

			if !hasWildcardScope(tt.query.SignedInUser, ac.ActionOrgUsersRead) {
				for _, member := range tt.query.Result {
					assert.Contains(t,
						tt.query.SignedInUser.Permissions[tt.query.SignedInUser.OrgID][ac.ActionOrgUsersRead],
						ac.Scope("users", "id", fmt.Sprintf("%d", member.UserId)),
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
func updateDashboardACL(t *testing.T, sqlStore *sqlstore.SQLStore, dashboardID int64, items ...*models.DashboardACL) error {
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
				return models.ErrDashboardACLInfoMissing
			}

			if item.DashboardID == 0 {
				return models.ErrDashboardPermissionDashboardEmpty
			}

			sess.Nullable("user_id", "team_id")
			if _, err := sess.Insert(item); err != nil {
				return err
			}
		}

		// Update dashboard HasACL flag
		dashboard := models.Dashboard{HasACL: true}
		_, err = sess.Cols("has_acl").Where("id=?", dashboardID).Update(&dashboard)
		return err
	})
	return err
}

// This function was copied from pkg/services/dashboards/database to circumvent
// import cycles. When this org-related code is refactored into a service the
// tests can the real GetDashboardACLInfoList functions
func getDashboardACLInfoList(s *sqlstore.SQLStore, query *models.GetDashboardACLInfoListQuery) error {
	outerErr := s.WithDbSession(context.Background(), func(dbSession *db.Session) error {
		query.Result = make([]*models.DashboardACLInfoDTO, 0)
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
			return dbSession.SQL(sql).Find(&query.Result)
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

		return dbSession.SQL(rawSQL, query.OrgID, query.DashboardID).Find(&query.Result)
	})

	if outerErr != nil {
		return outerErr
	}

	for _, p := range query.Result {
		p.PermissionName = p.Permission.String()
	}

	return nil
}
