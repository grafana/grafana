//go:build integration
// +build integration

package sqlstore

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/require"
)

func TestTeamCommandsAndQueries(t *testing.T) {
	t.Run("Testing Team commands & queries", func(t *testing.T) {
		sqlStore := InitTestDB(t)

		t.Run("Given saved users and two teams", func(t *testing.T) {
			var userIds []int64
			const testOrgID int64 = 1
			var team1, team2 models.Team
			var user *models.User
			var userCmd models.CreateUserCommand
			var err error

			setup := func() {
				for i := 0; i < 5; i++ {
					userCmd = models.CreateUserCommand{
						Email: fmt.Sprint("user", i, "@test.com"),
						Name:  fmt.Sprint("user", i),
						Login: fmt.Sprint("loginuser", i),
					}
					user, err = sqlStore.CreateUser(context.Background(), userCmd)
					require.NoError(t, err)
					userIds = append(userIds, user.Id)
				}
				team1, err = sqlStore.CreateTeam("group1 name", "test1@test.com", testOrgID)
				require.NoError(t, err)
				team2, err = sqlStore.CreateTeam("group2 name", "test2@test.com", testOrgID)
				require.NoError(t, err)
			}
			setup()

			t.Run("Should be able to create teams and add users", func(t *testing.T) {
				query := &models.SearchTeamsQuery{OrgId: testOrgID, Name: "group1 name", Page: 1, Limit: 10}
				err = SearchTeams(context.Background(), query)
				require.NoError(t, err)
				require.Equal(t, query.Page, 1)

				team1 := query.Result.Teams[0]
				require.Equal(t, team1.Name, "group1 name")
				require.Equal(t, team1.Email, "test1@test.com")
				require.Equal(t, team1.OrgId, testOrgID)
				require.EqualValues(t, team1.MemberCount, 0)

				err = sqlStore.AddTeamMember(userIds[0], testOrgID, team1.Id, false, 0)
				require.NoError(t, err)
				err = sqlStore.AddTeamMember(userIds[1], testOrgID, team1.Id, true, 0)
				require.NoError(t, err)

				q1 := &models.GetTeamMembersQuery{OrgId: testOrgID, TeamId: team1.Id}
				err = GetTeamMembers(context.Background(), q1)
				require.NoError(t, err)
				require.Equal(t, len(q1.Result), 2)
				require.Equal(t, q1.Result[0].TeamId, team1.Id)
				require.Equal(t, q1.Result[0].Login, "loginuser0")
				require.Equal(t, q1.Result[0].OrgId, testOrgID)
				require.Equal(t, q1.Result[1].TeamId, team1.Id)
				require.Equal(t, q1.Result[1].Login, "loginuser1")
				require.Equal(t, q1.Result[1].OrgId, testOrgID)
				require.Equal(t, q1.Result[1].External, true)

				q2 := &models.GetTeamMembersQuery{OrgId: testOrgID, TeamId: team1.Id, External: true}
				err = GetTeamMembers(context.Background(), q2)
				require.NoError(t, err)
				require.Equal(t, len(q2.Result), 1)
				require.Equal(t, q2.Result[0].TeamId, team1.Id)
				require.Equal(t, q2.Result[0].Login, "loginuser1")
				require.Equal(t, q2.Result[0].OrgId, testOrgID)
				require.Equal(t, q2.Result[0].External, true)

				err = SearchTeams(context.Background(), query)
				require.NoError(t, err)
				team1 = query.Result.Teams[0]
				require.EqualValues(t, team1.MemberCount, 2)

				getTeamQuery := &models.GetTeamByIdQuery{OrgId: testOrgID, Id: team1.Id}
				err = GetTeamById(context.Background(), getTeamQuery)
				require.NoError(t, err)
				team1 = getTeamQuery.Result
				require.Equal(t, team1.Name, "group1 name")
				require.Equal(t, team1.Email, "test1@test.com")
				require.Equal(t, team1.OrgId, testOrgID)
				require.EqualValues(t, team1.MemberCount, 2)
			})

			t.Run("Should return latest auth module for users when getting team members", func(t *testing.T) {
				sqlStore = InitTestDB(t)
				setup()
				userId := userIds[1]

				teamQuery := &models.SearchTeamsQuery{OrgId: testOrgID, Name: "group1 name", Page: 1, Limit: 10}
				err = SearchTeams(context.Background(), teamQuery)
				require.NoError(t, err)
				require.Equal(t, teamQuery.Page, 1)

				team1 := teamQuery.Result.Teams[0]

				err = sqlStore.AddTeamMember(userId, testOrgID, team1.Id, true, 0)
				require.NoError(t, err)

				memberQuery := &models.GetTeamMembersQuery{OrgId: testOrgID, TeamId: team1.Id, External: true}
				err = GetTeamMembers(context.Background(), memberQuery)
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
				err = sqlStore.AddTeamMember(userId, testOrgID, team.Id, false, 0)
				require.NoError(t, err)

				qBeforeUpdate := &models.GetTeamMembersQuery{OrgId: testOrgID, TeamId: team.Id}
				err = GetTeamMembers(context.Background(), qBeforeUpdate)
				require.NoError(t, err)
				require.EqualValues(t, qBeforeUpdate.Result[0].Permission, 0)

				err = UpdateTeamMember(context.Background(), &models.UpdateTeamMemberCommand{
					UserId:     userId,
					OrgId:      testOrgID,
					TeamId:     team.Id,
					Permission: models.PERMISSION_ADMIN,
				})

				require.NoError(t, err)

				qAfterUpdate := &models.GetTeamMembersQuery{OrgId: testOrgID, TeamId: team.Id}
				err = GetTeamMembers(context.Background(), qAfterUpdate)
				require.NoError(t, err)
				require.Equal(t, qAfterUpdate.Result[0].Permission, models.PERMISSION_ADMIN)
			})

			t.Run("Should default to member permission level when updating a user with invalid permission level", func(t *testing.T) {
				sqlStore = InitTestDB(t)
				setup()
				userID := userIds[0]
				team := team1
				err = sqlStore.AddTeamMember(userID, testOrgID, team.Id, false, 0)
				require.NoError(t, err)

				qBeforeUpdate := &models.GetTeamMembersQuery{OrgId: testOrgID, TeamId: team.Id}
				err = GetTeamMembers(context.Background(), qBeforeUpdate)
				require.NoError(t, err)
				require.EqualValues(t, qBeforeUpdate.Result[0].Permission, 0)

				invalidPermissionLevel := models.PERMISSION_EDIT
				err = UpdateTeamMember(context.Background(), &models.UpdateTeamMemberCommand{
					UserId:     userID,
					OrgId:      testOrgID,
					TeamId:     team.Id,
					Permission: invalidPermissionLevel,
				})

				require.NoError(t, err)

				qAfterUpdate := &models.GetTeamMembersQuery{OrgId: testOrgID, TeamId: team.Id}
				err = GetTeamMembers(context.Background(), qAfterUpdate)
				require.NoError(t, err)
				require.EqualValues(t, qAfterUpdate.Result[0].Permission, 0)
			})

			t.Run("Shouldn't be able to update a user not in the team.", func(t *testing.T) {
				sqlStore = InitTestDB(t)
				setup()
				err = UpdateTeamMember(context.Background(), &models.UpdateTeamMemberCommand{
					UserId:     1,
					OrgId:      testOrgID,
					TeamId:     team1.Id,
					Permission: models.PERMISSION_ADMIN,
				})

				require.Error(t, err, models.ErrTeamMemberNotFound)
			})

			t.Run("Should be able to search for teams", func(t *testing.T) {
				query := &models.SearchTeamsQuery{OrgId: testOrgID, Query: "group", Page: 1}
				err = SearchTeams(context.Background(), query)
				require.NoError(t, err)
				require.Equal(t, len(query.Result.Teams), 2)
				require.EqualValues(t, query.Result.TotalCount, 2)

				query2 := &models.SearchTeamsQuery{OrgId: testOrgID, Query: ""}
				err = SearchTeams(context.Background(), query2)
				require.NoError(t, err)
				require.Equal(t, len(query2.Result.Teams), 2)
			})

			t.Run("Should be able to return all teams a user is member of", func(t *testing.T) {
				sqlStore = InitTestDB(t)
				setup()
				groupId := team2.Id
				err := sqlStore.AddTeamMember(userIds[0], testOrgID, groupId, false, 0)
				require.NoError(t, err)

				query := &models.GetTeamsByUserQuery{OrgId: testOrgID, UserId: userIds[0]}
				err = GetTeamsByUser(context.Background(), query)
				require.NoError(t, err)
				require.Equal(t, len(query.Result), 1)
				require.Equal(t, query.Result[0].Name, "group2 name")
				require.Equal(t, query.Result[0].Email, "test2@test.com")
			})

			t.Run("Should be able to remove users from a group", func(t *testing.T) {
				err = sqlStore.AddTeamMember(userIds[0], testOrgID, team1.Id, false, 0)
				require.NoError(t, err)

				err = RemoveTeamMember(context.Background(), &models.RemoveTeamMemberCommand{OrgId: testOrgID, TeamId: team1.Id, UserId: userIds[0]})
				require.NoError(t, err)

				q2 := &models.GetTeamMembersQuery{OrgId: testOrgID, TeamId: team1.Id}
				err = GetTeamMembers(context.Background(), q2)
				require.NoError(t, err)
				require.Equal(t, len(q2.Result), 0)
			})

			t.Run("When ProtectLastAdmin is set to true", func(t *testing.T) {
				err = sqlStore.AddTeamMember(userIds[0], testOrgID, team1.Id, false, models.PERMISSION_ADMIN)
				require.NoError(t, err)

				t.Run("A user should not be able to remove the last admin", func(t *testing.T) {
					err = RemoveTeamMember(context.Background(), &models.RemoveTeamMemberCommand{OrgId: testOrgID, TeamId: team1.Id, UserId: userIds[0], ProtectLastAdmin: true})
					require.Equal(t, err, models.ErrLastTeamAdmin)
				})

				t.Run("A user should be able to remove an admin if there are other admins", func(t *testing.T) {
					err = sqlStore.AddTeamMember(userIds[1], testOrgID, team1.Id, false, models.PERMISSION_ADMIN)
					require.NoError(t, err)
					err = RemoveTeamMember(context.Background(), &models.RemoveTeamMemberCommand{OrgId: testOrgID, TeamId: team1.Id, UserId: userIds[0], ProtectLastAdmin: true})
					require.NoError(t, err)
				})

				t.Run("A user should not be able to remove the admin permission for the last admin", func(t *testing.T) {
					err = UpdateTeamMember(context.Background(), &models.UpdateTeamMemberCommand{OrgId: testOrgID, TeamId: team1.Id, UserId: userIds[0], Permission: 0, ProtectLastAdmin: true})
					require.Error(t, err, models.ErrLastTeamAdmin)
				})

				t.Run("A user should be able to remove the admin permission if there are other admins", func(t *testing.T) {
					sqlStore = InitTestDB(t)
					setup()

					err = sqlStore.AddTeamMember(userIds[0], testOrgID, team1.Id, false, models.PERMISSION_ADMIN)
					require.NoError(t, err)

					err = sqlStore.AddTeamMember(userIds[1], testOrgID, team1.Id, false, models.PERMISSION_ADMIN)
					require.NoError(t, err)
					err = UpdateTeamMember(context.Background(), &models.UpdateTeamMemberCommand{OrgId: testOrgID, TeamId: team1.Id, UserId: userIds[0], Permission: 0, ProtectLastAdmin: true})
					require.NoError(t, err)
				})
			})

			t.Run("Should be able to remove a group with users and permissions", func(t *testing.T) {
				groupId := team2.Id
				err := sqlStore.AddTeamMember(userIds[1], testOrgID, groupId, false, 0)
				require.NoError(t, err)
				err = sqlStore.AddTeamMember(userIds[2], testOrgID, groupId, false, 0)
				require.NoError(t, err)
				err = testHelperUpdateDashboardAcl(t, sqlStore, 1, models.DashboardAcl{
					DashboardID: 1, OrgID: testOrgID, Permission: models.PERMISSION_EDIT, TeamID: groupId,
				})
				require.NoError(t, err)
				err = DeleteTeam(context.Background(), &models.DeleteTeamCommand{OrgId: testOrgID, Id: groupId})
				require.NoError(t, err)

				query := &models.GetTeamByIdQuery{OrgId: testOrgID, Id: groupId}
				err = GetTeamById(context.Background(), query)
				require.Equal(t, err, models.ErrTeamNotFound)

				permQuery := &models.GetDashboardAclInfoListQuery{DashboardID: 1, OrgID: testOrgID}
				err = sqlStore.GetDashboardAclInfoList(context.Background(), permQuery)
				require.NoError(t, err)

				require.Equal(t, len(permQuery.Result), 0)
			})

			t.Run("Should be able to return if user is admin of teams or not", func(t *testing.T) {
				sqlStore = InitTestDB(t)
				setup()
				groupId := team2.Id
				err := sqlStore.AddTeamMember(userIds[0], testOrgID, groupId, false, 0)
				require.NoError(t, err)
				err = sqlStore.AddTeamMember(userIds[1], testOrgID, groupId, false, models.PERMISSION_ADMIN)
				require.NoError(t, err)

				query := &models.IsAdminOfTeamsQuery{SignedInUser: &models.SignedInUser{OrgId: testOrgID, UserId: userIds[0]}}
				err = IsAdminOfTeams(context.Background(), query)
				require.NoError(t, err)
				require.False(t, query.Result)

				query = &models.IsAdminOfTeamsQuery{SignedInUser: &models.SignedInUser{OrgId: testOrgID, UserId: userIds[1]}}
				err = IsAdminOfTeams(context.Background(), query)
				require.NoError(t, err)
				require.True(t, query.Result)
			})

			t.Run("Should not return hidden users in team member count", func(t *testing.T) {
				sqlStore = InitTestDB(t)
				setup()
				signedInUser := &models.SignedInUser{Login: "loginuser0"}
				hiddenUsers := map[string]struct{}{"loginuser0": {}, "loginuser1": {}}

				teamId := team1.Id
				err = sqlStore.AddTeamMember(userIds[0], testOrgID, teamId, false, 0)
				require.NoError(t, err)
				err = sqlStore.AddTeamMember(userIds[1], testOrgID, teamId, false, 0)
				require.NoError(t, err)
				err = sqlStore.AddTeamMember(userIds[2], testOrgID, teamId, false, 0)
				require.NoError(t, err)

				searchQuery := &models.SearchTeamsQuery{OrgId: testOrgID, Page: 1, Limit: 10, SignedInUser: signedInUser, HiddenUsers: hiddenUsers}
				err = SearchTeams(context.Background(), searchQuery)
				require.NoError(t, err)
				require.Equal(t, len(searchQuery.Result.Teams), 2)
				team1 := searchQuery.Result.Teams[0]
				require.EqualValues(t, team1.MemberCount, 2)

				searchQueryFilteredByUser := &models.SearchTeamsQuery{OrgId: testOrgID, Page: 1, Limit: 10, UserIdFilter: userIds[0], SignedInUser: signedInUser, HiddenUsers: hiddenUsers}
				err = SearchTeams(context.Background(), searchQueryFilteredByUser)
				require.NoError(t, err)
				require.Equal(t, len(searchQueryFilteredByUser.Result.Teams), 1)
				team1 = searchQuery.Result.Teams[0]
				require.EqualValues(t, team1.MemberCount, 2)

				getTeamQuery := &models.GetTeamByIdQuery{OrgId: testOrgID, Id: teamId, SignedInUser: signedInUser, HiddenUsers: hiddenUsers}
				err = GetTeamById(context.Background(), getTeamQuery)
				require.NoError(t, err)
				require.EqualValues(t, getTeamQuery.Result.MemberCount, 2)
			})
		})
	})
}
