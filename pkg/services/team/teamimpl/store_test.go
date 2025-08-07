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
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/sortopts"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationTeamCommandsAndQueries(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	t.Run("Testing Team commands and queries", func(t *testing.T) {
		sqlStore, cfg := db.InitTestDBWithCfg(t)
		teamSvc, err := ProvideService(sqlStore, cfg, tracing.InitializeTracerForTest())
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
		quotaService := quotaimpl.ProvideService(sqlStore, configprovider.ProvideService(cfg))
		orgSvc, err := orgimpl.ProvideService(sqlStore, cfg, quotaService)
		require.NoError(t, err)
		userSvc, err := userimpl.ProvideService(
			sqlStore, orgSvc, cfg, teamSvc, nil, tracing.InitializeTracerForTest(),
			quotaService, supportbundlestest.NewFakeBundleService(),
		)
		require.NoError(t, err)

		t.Run("Given saved users and two teams", func(t *testing.T) {
			var userIds []int64
			var userUIDs []string
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
					userUIDs = append(userUIDs, usr.UID)
				}

				team1Cmd := team.CreateTeamCommand{
					Name:  "group1 name",
					Email: "test1@test.com",
					OrgID: testOrgID,
				}
				team1, err = teamSvc.CreateTeam(context.Background(), &team1Cmd)
				require.NoError(t, err)

				team2Cmd := team.CreateTeamCommand{
					Name:  "group2 name",
					Email: "test2@test.com",
					OrgID: testOrgID,
				}
				team2, err = teamSvc.CreateTeam(context.Background(), &team2Cmd)
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

				err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
					err := AddOrUpdateTeamMemberHook(sess, userIds[0], testOrgID, team1.ID, false, 0)
					if err != nil {
						return err
					}
					return AddOrUpdateTeamMemberHook(sess, userIds[1], testOrgID, team1.ID, true, 0)
				})
				require.NoError(t, err)

				q1 := &team.GetTeamMembersQuery{OrgID: testOrgID, TeamID: team1.ID, SignedInUser: testUser}
				q1Result, err := teamSvc.GetTeamMembers(context.Background(), q1)
				require.NoError(t, err)
				require.Equal(t, 2, len(q1Result))
				require.Equal(t, q1Result[0].TeamID, team1.ID)
				require.Contains(t, userIds[:2], q1Result[0].UserID)
				require.Contains(t, userUIDs[:2], q1Result[0].UserUID)
				require.Equal(t, q1Result[0].Login, "loginuser0")
				require.Equal(t, q1Result[0].OrgID, testOrgID)
				require.Equal(t, q1Result[1].TeamID, team1.ID)
				require.Contains(t, userIds[:2], q1Result[1].UserID)
				require.Contains(t, userUIDs[:2], q1Result[1].UserUID)
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

				getIDsQuery := &team.GetTeamIDsByUserQuery{OrgID: testOrgID, UserID: userIds[0]}
				getIDResult, err := teamSvc.GetTeamIDsByUser(context.Background(), getIDsQuery)
				require.NoError(t, err)

				require.Equal(t, len(getIDResult), 1)
				require.Equal(t, getIDResult[0], team1.ID)
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

				err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
					return AddOrUpdateTeamMemberHook(sess, userId, testOrgID, team1.ID, true, 0)
				})
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

				err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
					return AddOrUpdateTeamMemberHook(sess, userId, testOrgID, team1.ID, false, 0)
				})
				require.NoError(t, err)

				qBeforeUpdate := &team.GetTeamMembersQuery{OrgID: testOrgID, TeamID: team1.ID, SignedInUser: testUser}
				qBeforeUpdateResult, err := teamSvc.GetTeamMembers(context.Background(), qBeforeUpdate)
				require.NoError(t, err)
				require.EqualValues(t, qBeforeUpdateResult[0].Permission, 0)

				err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
					return AddOrUpdateTeamMemberHook(sess, userId, testOrgID, team1.ID, false, team.PermissionTypeAdmin)
				})
				require.NoError(t, err)

				qAfterUpdate := &team.GetTeamMembersQuery{OrgID: testOrgID, TeamID: team1.ID, SignedInUser: testUser}
				qAfterUpdateResult, err := teamSvc.GetTeamMembers(context.Background(), qAfterUpdate)
				require.NoError(t, err)
				require.Equal(t, qAfterUpdateResult[0].Permission, team.PermissionTypeAdmin)
			})

			t.Run("Should default to member permission level when updating a user with invalid permission level", func(t *testing.T) {
				sqlStore = db.InitTestDB(t)
				setup()
				userID := userIds[0]

				err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
					return AddOrUpdateTeamMemberHook(sess, userID, testOrgID, team1.ID, false, 0)
				})
				require.NoError(t, err)

				qBeforeUpdate := &team.GetTeamMembersQuery{OrgID: testOrgID, TeamID: team1.ID, SignedInUser: testUser}
				qBeforeUpdateResult, err := teamSvc.GetTeamMembers(context.Background(), qBeforeUpdate)
				require.NoError(t, err)
				require.EqualValues(t, qBeforeUpdateResult[0].Permission, 0)

				invalidPermissionLevel := 2
				err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
					return AddOrUpdateTeamMemberHook(sess, userID, testOrgID, team1.ID, false, team.PermissionType(invalidPermissionLevel))
				})
				require.NoError(t, err)

				qAfterUpdate := &team.GetTeamMembersQuery{OrgID: testOrgID, TeamID: team1.ID, SignedInUser: testUser}
				qAfterUpdateResult, err := teamSvc.GetTeamMembers(context.Background(), qAfterUpdate)
				require.NoError(t, err)
				require.EqualValues(t, qAfterUpdateResult[0].Permission, 0)
			})

			t.Run("Should be able to search for teams", func(t *testing.T) {
				// Use mixed-case to test case-insensitive search.
				query := &team.SearchTeamsQuery{OrgID: testOrgID, Query: "GrOuP", Page: 1, SignedInUser: testUser}
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

			t.Run("Should be able to sort teams by descending member count order", func(t *testing.T) {
				sortOpts, err := sortopts.ParseSortQueryParam("memberCount-desc")
				require.NoError(t, err)

				// Add a team member
				err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
					err := AddOrUpdateTeamMemberHook(sess, userIds[2], testOrgID, team1.ID, false, 0)
					if err != nil {
						return err
					}
					err = AddOrUpdateTeamMemberHook(sess, userIds[3], testOrgID, team1.ID, false, 0)
					if err != nil {
						return err
					}
					return AddOrUpdateTeamMemberHook(sess, userIds[2], testOrgID, team2.ID, false, 0)
				})
				require.NoError(t, err)
				defer func() {
					err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
						err := RemoveTeamMemberHook(sess, &team.RemoveTeamMemberCommand{OrgID: testOrgID, UserID: userIds[2], TeamID: team1.ID})
						if err != nil {
							return err
						}
						err = RemoveTeamMemberHook(sess, &team.RemoveTeamMemberCommand{OrgID: testOrgID, UserID: userIds[3], TeamID: team1.ID})
						if err != nil {
							return err
						}
						return RemoveTeamMemberHook(sess, &team.RemoveTeamMemberCommand{OrgID: testOrgID, UserID: userIds[2], TeamID: team2.ID})
					})
					require.NoError(t, err)
				}()

				query := &team.SearchTeamsQuery{OrgID: testOrgID, SortOpts: sortOpts, SignedInUser: testUser}
				queryResult, err := teamSvc.SearchTeams(context.Background(), query)
				require.NoError(t, err)
				require.Equal(t, len(queryResult.Teams), 2)
				require.EqualValues(t, queryResult.TotalCount, 2)
				require.Greater(t, queryResult.Teams[0].MemberCount, queryResult.Teams[1].MemberCount)
			})

			t.Run("Should be able to sort teams by descending name order", func(t *testing.T) {
				sortOpts, err := sortopts.ParseSortQueryParam("name-desc")
				require.NoError(t, err)

				query := &team.SearchTeamsQuery{OrgID: testOrgID, SortOpts: sortOpts, SignedInUser: testUser}
				queryResult, err := teamSvc.SearchTeams(context.Background(), query)
				require.NoError(t, err)
				require.Equal(t, len(queryResult.Teams), 2)
				require.EqualValues(t, queryResult.TotalCount, 2)
				require.Equal(t, queryResult.Teams[0].Name, team2.Name)
				require.Equal(t, queryResult.Teams[1].Name, team1.Name)
			})

			t.Run("Should be able to query teams by ids", func(t *testing.T) {
				allTeamsQuery := &team.SearchTeamsQuery{OrgID: testOrgID, Query: "", SignedInUser: testUser}
				allTeamsQueryResult, err := teamSvc.SearchTeams(context.Background(), allTeamsQuery)
				require.NoError(t, err)
				require.Equal(t, len(allTeamsQueryResult.Teams), 2)

				teamIds := make([]int64, 0)
				for _, team := range allTeamsQueryResult.Teams {
					teamIds = append(teamIds, team.ID)
				}

				query := &team.SearchTeamsQuery{OrgID: testOrgID, SignedInUser: testUser, TeamIds: teamIds}
				queryResult, err := teamSvc.SearchTeams(context.Background(), query)
				require.NoError(t, err)
				require.Equal(t, len(queryResult.Teams), 2)
				require.EqualValues(t, queryResult.TotalCount, 2)
				require.Equal(t, queryResult.Teams[0].ID, teamIds[0])
				require.Equal(t, queryResult.Teams[1].ID, teamIds[1])
			})

			t.Run("Should be able to return all teams a user is member of", func(t *testing.T) {
				sqlStore = db.InitTestDB(t)
				setup()
				groupId := team2.ID
				err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
					return AddOrUpdateTeamMemberHook(sess, userIds[0], testOrgID, groupId, false, 0)
				})
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
				err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
					return AddOrUpdateTeamMemberHook(sess, userIds[0], testOrgID, team1.ID, false, 0)
				})
				require.NoError(t, err)

				err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
					return RemoveTeamMemberHook(sess, &team.RemoveTeamMemberCommand{OrgID: testOrgID, TeamID: team1.ID, UserID: userIds[0]})
				})
				require.NoError(t, err)

				q2 := &team.GetTeamMembersQuery{OrgID: testOrgID, TeamID: team1.ID, SignedInUser: testUser}
				q2Result, err := teamSvc.GetTeamMembers(context.Background(), q2)
				require.NoError(t, err)
				require.Equal(t, len(q2Result), 0)
			})

			t.Run("Should have empty teams", func(t *testing.T) {
				err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
					return AddOrUpdateTeamMemberHook(sess, userIds[0], testOrgID, team1.ID, false, team.PermissionTypeAdmin)
				})
				require.NoError(t, err)

				t.Run("A user should be able to remove the admin permission for the last admin", func(t *testing.T) {
					err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
						return AddOrUpdateTeamMemberHook(sess, userIds[0], testOrgID, team1.ID, false, 0)
					})
					require.NoError(t, err)
				})

				t.Run("A user should be able to remove the last member", func(t *testing.T) {
					err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
						return RemoveTeamMemberHook(sess, &team.RemoveTeamMemberCommand{OrgID: testOrgID, TeamID: team1.ID, UserID: userIds[0]})
					})
					require.NoError(t, err)
				})

				t.Run("A user should be able to remove the admin permission if there are other admins", func(t *testing.T) {
					sqlStore = db.InitTestDB(t)
					setup()

					err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
						err := AddOrUpdateTeamMemberHook(sess, userIds[0], testOrgID, team1.ID, false, team.PermissionTypeAdmin)
						if err != nil {
							return err
						}
						return AddOrUpdateTeamMemberHook(sess, userIds[1], testOrgID, team1.ID, false, team.PermissionTypeAdmin)
					})
					require.NoError(t, err)
					err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
						return AddOrUpdateTeamMemberHook(sess, userIds[0], testOrgID, team1.ID, false, 0)
					})
					require.NoError(t, err)
				})
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
				err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
					err := AddOrUpdateTeamMemberHook(sess, userIds[0], testOrgID, teamId, false, 0)
					if err != nil {
						return err
					}
					err = AddOrUpdateTeamMemberHook(sess, userIds[1], testOrgID, teamId, false, 0)
					if err != nil {
						return err
					}
					return AddOrUpdateTeamMemberHook(sess, userIds[2], testOrgID, teamId, false, 0)
				})

				searchQuery := &team.SearchTeamsQuery{OrgID: testOrgID, Page: 1, Limit: 10, SignedInUser: signedInUser, HiddenUsers: hiddenUsers}
				searchQueryResult, err := teamSvc.SearchTeams(context.Background(), searchQuery)
				require.NoError(t, err)
				require.Equal(t, len(searchQueryResult.Teams), 2)
				team1 := searchQueryResult.Teams[0]
				require.EqualValues(t, team1.MemberCount, 2)

				getTeamQuery := &team.GetTeamByIDQuery{OrgID: testOrgID, ID: teamId, SignedInUser: signedInUser, HiddenUsers: hiddenUsers}
				getTeamQueryResult, err := teamSvc.GetTeamByID(context.Background(), getTeamQuery)
				require.NoError(t, err)
				require.EqualValues(t, getTeamQueryResult.MemberCount, 2)
			})

			t.Run("Should be able to exclude service accounts from teamembers", func(t *testing.T) {
				sqlStore = db.InitTestDB(t)
				quotaService := quotaimpl.ProvideService(sqlStore, configprovider.ProvideService(cfg))
				orgSvc, err := orgimpl.ProvideService(sqlStore, cfg, quotaService)
				require.NoError(t, err)
				userSvc, err := userimpl.ProvideService(
					sqlStore, orgSvc, cfg, teamSvc, nil, tracing.InitializeTracerForTest(),
					quotaService, supportbundlestest.NewFakeBundleService(),
				)
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
				dbErr := sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
					// add service account to team
					err := AddOrUpdateTeamMemberHook(sess, serviceAccount.ID, testOrgID, groupId, false, 0)
					if err != nil {
						return err
					}
					// add user to team
					return AddOrUpdateTeamMemberHook(sess, userIds[0], testOrgID, groupId, false, 0)
				})
				require.NoError(t, dbErr)

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

	store, cfg := db.InitTestDBWithCfg(t, db.InitTestDBOpt{})
	teamSvc, err := ProvideService(store, cfg, tracing.InitializeTracerForTest())
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
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	testOrgID := int64(2)
	userIds := make([]int64, 4)

	// Seed 2 teams with 2 members
	setup := func(store db.DB, cfg *setting.Cfg) {
		teamSvc, err := ProvideService(store, cfg, tracing.InitializeTracerForTest())
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

		quotaService := quotaimpl.ProvideService(store, configprovider.ProvideService(cfg))
		orgSvc, err := orgimpl.ProvideService(store, cfg, quotaService)
		require.NoError(t, err)
		userSvc, err := userimpl.ProvideService(
			store, orgSvc, cfg, teamSvc, nil, tracing.InitializeTracerForTest(),
			quotaService, supportbundlestest.NewFakeBundleService(),
		)
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

	store, cfg := db.InitTestDBWithCfg(t, db.InitTestDBOpt{})
	setup(store, cfg)
	teamSvc, err := ProvideService(store, cfg, tracing.InitializeTracerForTest())
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
