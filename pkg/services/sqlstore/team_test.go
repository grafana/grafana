// +build integration

package sqlstore

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/models"
)

func TestTeamCommandsAndQueries(t *testing.T) {
	t.Run("Testing Team commands & queries", func(t *testing.T) {
		sqlStore := InitTestDB(t)

		t.Run("Given saved users and two teams", func(t *testing.T) {
			var userIds []int64
			for i := 0; i < 5; i++ {
				userCmd := models.CreateUserCommand{
					Email: fmt.Sprint("user", i, "@test.com"),
					Name:  fmt.Sprint("user", i),
					Login: fmt.Sprint("loginuser", i),
				}
				user, err := sqlStore.CreateUser(context.Background(), userCmd)
				require.NoError(t, err)
				userIds = append(userIds, user.Id)
			}

			const testOrgID int64 = 1
			team1, err := sqlStore.CreateTeam("group1 name", "test1@test.com", testOrgID)
			require.NoError(t, err)
			team2, err := sqlStore.CreateTeam("group2 name", "test2@test.com", testOrgID)
			require.NoError(t, err)

			t.Run("Should be able to create teams and add users", func(t *testing.T) {
				query := &models.SearchTeamsQuery{OrgId: testOrgID, Name: "group1 name", Page: 1, Limit: 10}
				err = SearchTeams(query)
				require.NoError(t, err)
				require.Equal(t, 1, query.Page)

				team1 := query.Result.Teams[0]
				require.Equal(t, "group1 name", team1.Name)
				require.Equal(t, "test1@test.com", team1.Email)
				require.Equal(t, testOrgID, team1.OrgId)
				require.Equal(t, 0, team1.MemberCount)

				err = sqlStore.AddTeamMember(userIds[0], testOrgID, team1.Id, false, 0)
				require.NoError(t, err)
				err = sqlStore.AddTeamMember(userIds[1], testOrgID, team1.Id, true, 0)
				require.NoError(t, err)

				q1 := &models.GetTeamMembersQuery{OrgId: testOrgID, TeamId: team1.Id}
				err = GetTeamMembers(q1)
				require.NoError(t, err)
				require.Equal(t, 2, len(q1.Result))
				require.Equal(t, team1.Id, q1.Result[0].TeamId)
				require.Equal(t, "loginuser0", q1.Result[0].Login)
				require.Equal(t, testOrgID, q1.Result[0].OrgId)
				require.Equal(t, team1.Id, q1.Result[1].TeamId)
				require.Equal(t, "loginuser1", q1.Result[1].Login)
				require.Equal(t, testOrgID, q1.Result[1].OrgId)
				require.Equal(t, true, q1.Result[1].External)

				q2 := &models.GetTeamMembersQuery{OrgId: testOrgID, TeamId: team1.Id, External: true}
				err = GetTeamMembers(q2)
				require.NoError(t, err)
				require.Equal(t, 1, len(q2.Result))
				require.Equal(t, team1.Id, q2.Result[0].TeamId)
				require.Equal(t, "loginuser1", q2.Result[0].Login)
				require.Equal(t, testOrgID, q2.Result[0].OrgId)
				require.Equal(t, true, q2.Result[0].External)

				err = SearchTeams(query)
				require.NoError(t, err)
				team1 = query.Result.Teams[0]
				require.Equal(t, 2, team1.MemberCount)

				getTeamQuery := &models.GetTeamByIdQuery{OrgId: testOrgID, Id: team1.Id}
				err = GetTeamById(getTeamQuery)
				require.NoError(t, err)
				team1 = getTeamQuery.Result
				require.Equal(t, "group1 name", team1.Name)
				require.Equal(t, "test1@test.com", team1.Email)
				require.Equal(t, testOrgID, team1.OrgId)
				require.Equal(t, 2, team1.MemberCount)
			})

			t.Run("Should return latest auth module for users when getting team members", func(t *testing.T) {
				userId := userIds[1]
				err := SetAuthInfo(&models.SetAuthInfoCommand{UserId: userId, AuthModule: "oauth_github", AuthId: "1234567"})
				require.NoError(t, err)

				teamQuery := &models.SearchTeamsQuery{OrgId: testOrgID, Name: "group1 name", Page: 1, Limit: 10}
				err = SearchTeams(teamQuery)
				require.NoError(t, err)
				require.Equal(t, 1, teamQuery.Page)

				team1 := teamQuery.Result.Teams[0]

				err = sqlStore.AddTeamMember(userId, testOrgID, team1.Id, true, 0)
				require.NoError(t, err)

				memberQuery := &models.GetTeamMembersQuery{OrgId: testOrgID, TeamId: team1.Id, External: true}
				err = GetTeamMembers(memberQuery)
				require.NoError(t, err)
				require.Equal(t, 1, len(memberQuery.Result))
				require.Equal(t, team1.Id, memberQuery.Result[0].TeamId)
				require.Equal(t, "loginuser1", memberQuery.Result[0].Login)
				require.Equal(t, testOrgID, memberQuery.Result[0].OrgId)
				require.Equal(t, true, memberQuery.Result[0].External)
				require.Equal(t, "oauth_github", memberQuery.Result[0].AuthModule)
			})

			t.Run("Should be able to update users in a team", func(t *testing.T) {
				userId := userIds[0]
				team := team1
				err = sqlStore.AddTeamMember(userId, testOrgID, team.Id, false, 0)
				require.NoError(t, err)

				qBeforeUpdate := &models.GetTeamMembersQuery{OrgId: testOrgID, TeamId: team.Id}
				err = GetTeamMembers(qBeforeUpdate)
				require.NoError(t, err)
				require.Equal(t, 0, qBeforeUpdate.Result[0].Permission)

				err = UpdateTeamMember(&models.UpdateTeamMemberCommand{
					UserId:     userId,
					OrgId:      testOrgID,
					TeamId:     team.Id,
					Permission: models.PERMISSION_ADMIN,
				})

				require.NoError(t, err)

				qAfterUpdate := &models.GetTeamMembersQuery{OrgId: testOrgID, TeamId: team.Id}
				err = GetTeamMembers(qAfterUpdate)
				require.NoError(t, err)
				require.Equal(t, models.PERMISSION_ADMIN, qAfterUpdate.Result[0].Permission)
			})

			t.Run("Should default to member permission level when updating a user with invalid permission level", func(t *testing.T) {
				userID := userIds[0]
				team := team1
				err = sqlStore.AddTeamMember(userID, testOrgID, team.Id, false, 0)
				require.NoError(t, err)

				qBeforeUpdate := &models.GetTeamMembersQuery{OrgId: testOrgID, TeamId: team.Id}
				err = GetTeamMembers(qBeforeUpdate)
				require.NoError(t, err)
				require.Equal(t, 0, qBeforeUpdate.Result[0].Permission)

				invalidPermissionLevel := models.PERMISSION_EDIT
				err = UpdateTeamMember(&models.UpdateTeamMemberCommand{
					UserId:     userID,
					OrgId:      testOrgID,
					TeamId:     team.Id,
					Permission: invalidPermissionLevel,
				})

				require.NoError(t, err)

				qAfterUpdate := &models.GetTeamMembersQuery{OrgId: testOrgID, TeamId: team.Id}
				err = GetTeamMembers(qAfterUpdate)
				require.NoError(t, err)
				require.Equal(t, 0, qAfterUpdate.Result[0].Permission)
			})

			t.Run("Shouldn't be able to update a user not in the team.", func(t *testing.T) {
				err = UpdateTeamMember(&models.UpdateTeamMemberCommand{
					UserId:     1,
					OrgId:      testOrgID,
					TeamId:     team1.Id,
					Permission: models.PERMISSION_ADMIN,
				})

				require.Equal(t, models.ErrTeamMemberNotFound, err)
			})

			t.Run("Should be able to search for teams", func(t *testing.T) {
				query := &models.SearchTeamsQuery{OrgId: testOrgID, Query: "group", Page: 1}
				err = SearchTeams(query)
				require.NoError(t, err)
				require.Equal(t, 2, len(query.Result.Teams))
				require.Equal(t, 2, query.Result.TotalCount)

				query2 := &models.SearchTeamsQuery{OrgId: testOrgID, Query: ""}
				err = SearchTeams(query2)
				require.NoError(t, err)
				require.Equal(t, 2, len(query2.Result.Teams))
			})

			t.Run("Should be able to return all teams a user is member of", func(t *testing.T) {
				groupId := team2.Id
				err := sqlStore.AddTeamMember(userIds[0], testOrgID, groupId, false, 0)
				require.NoError(t, err)

				query := &models.GetTeamsByUserQuery{OrgId: testOrgID, UserId: userIds[0]}
				err = GetTeamsByUser(query)
				require.NoError(t, err)
				require.Equal(t, 1, len(query.Result))
				require.Equal(t, "group2 name", query.Result[0].Name)
				require.Equal(t, "test2@test.com", query.Result[0].Email)
			})

			t.Run("Should be able to remove users from a group", func(t *testing.T) {
				err = sqlStore.AddTeamMember(userIds[0], testOrgID, team1.Id, false, 0)
				require.NoError(t, err)

				err = RemoveTeamMember(&models.RemoveTeamMemberCommand{OrgId: testOrgID, TeamId: team1.Id, UserId: userIds[0]})
				require.NoError(t, err)

				q2 := &models.GetTeamMembersQuery{OrgId: testOrgID, TeamId: team1.Id}
				err = GetTeamMembers(q2)
				require.NoError(t, err)
				require.Equal(t, 0, len(q2.Result))
			})

			t.Run("When ProtectLastAdmin is set to true", func(t *testing.T) {
				err = sqlStore.AddTeamMember(userIds[0], testOrgID, team1.Id, false, models.PERMISSION_ADMIN)
				require.NoError(t, err)

				t.Run("A user should not be able to remove the last admin", func(t *testing.T) {
					err = RemoveTeamMember(&models.RemoveTeamMemberCommand{OrgId: testOrgID, TeamId: team1.Id, UserId: userIds[0], ProtectLastAdmin: true})
					require.Equal(t, models.ErrLastTeamAdmin, err)
				})

				t.Run("A user should be able to remove an admin if there are other admins", func(t *testing.T) {
					err = sqlStore.AddTeamMember(userIds[1], testOrgID, team1.Id, false, models.PERMISSION_ADMIN)
					require.NoError(t, err)
					err = RemoveTeamMember(&models.RemoveTeamMemberCommand{OrgId: testOrgID, TeamId: team1.Id, UserId: userIds[0], ProtectLastAdmin: true})
					require.NoError(t, err)
				})

				t.Run("A user should not be able to remove the admin permission for the last admin", func(t *testing.T) {
					err = UpdateTeamMember(&models.UpdateTeamMemberCommand{OrgId: testOrgID, TeamId: team1.Id, UserId: userIds[0], Permission: 0, ProtectLastAdmin: true})
					So(err, ShouldBeError, models.ErrLastTeamAdmin)
				})

				t.Run("A user should be able to remove the admin permission if there are other admins", func(t *testing.T) {
					err = sqlStore.AddTeamMember(userIds[1], testOrgID, team1.Id, false, models.PERMISSION_ADMIN)
					require.NoError(t, err)
					err = UpdateTeamMember(&models.UpdateTeamMemberCommand{OrgId: testOrgID, TeamId: team1.Id, UserId: userIds[0], Permission: 0, ProtectLastAdmin: true})
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
				err = DeleteTeam(&models.DeleteTeamCommand{OrgId: testOrgID, Id: groupId})
				require.NoError(t, err)

				query := &models.GetTeamByIdQuery{OrgId: testOrgID, Id: groupId}
				err = GetTeamById(query)
				require.Equal(t, models.ErrTeamNotFound, err)

				permQuery := &models.GetDashboardAclInfoListQuery{DashboardID: 1, OrgID: testOrgID}
				err = GetDashboardAclInfoList(permQuery)
				require.NoError(t, err)

				require.Equal(t, 0, len(permQuery.Result))
			})

			t.Run("Should be able to return if user is admin of teams or not", func(t *testing.T) {
				groupId := team2.Id
				err := sqlStore.AddTeamMember(userIds[0], testOrgID, groupId, false, 0)
				require.NoError(t, err)
				err = sqlStore.AddTeamMember(userIds[1], testOrgID, groupId, false, models.PERMISSION_ADMIN)
				require.NoError(t, err)

				query := &models.IsAdminOfTeamsQuery{SignedInUser: &models.SignedInUser{OrgId: testOrgID, UserId: userIds[0]}}
				err = IsAdminOfTeams(query)
				require.NoError(t, err)
				require.False(t, query.Result)

				query = &models.IsAdminOfTeamsQuery{SignedInUser: &models.SignedInUser{OrgId: testOrgID, UserId: userIds[1]}}
				err = IsAdminOfTeams(query)
				require.NoError(t, err)
				require.True(t, query.Result)
			})

			t.Run("Should not return hidden users in team member count", func(t *testing.T) {
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
				err = SearchTeams(searchQuery)
				require.NoError(t, err)
				require.Equal(t, 2, len(searchQuery.Result.Teams))
				team1 := searchQuery.Result.Teams[0]
				require.Equal(t, 2, team1.MemberCount)

				searchQueryFilteredByUser := &models.SearchTeamsQuery{OrgId: testOrgID, Page: 1, Limit: 10, UserIdFilter: userIds[0], SignedInUser: signedInUser, HiddenUsers: hiddenUsers}
				err = SearchTeams(searchQueryFilteredByUser)
				require.NoError(t, err)
				require.Equal(t, 1, len(searchQueryFilteredByUser.Result.Teams))
				team1 = searchQuery.Result.Teams[0]
				require.Equal(t, 2, team1.MemberCount)

				getTeamQuery := &models.GetTeamByIdQuery{OrgId: testOrgID, Id: teamId, SignedInUser: signedInUser, HiddenUsers: hiddenUsers}
				err = GetTeamById(getTeamQuery)
				require.NoError(t, err)
				require.Equal(t, 2, getTeamQuery.Result.MemberCount)
			})
		})
	})
}
