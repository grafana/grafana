package sqlstore

import (
	"context"
	"fmt"
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	"github.com/grafana/grafana/pkg/models"
)

func TestTeamCommandsAndQueries(t *testing.T) {
	Convey("Testing Team commands & queries", t, func() {
		InitTestDB(t)

		Convey("Given saved users and two teams", func() {
			var userIds []int64
			for i := 0; i < 5; i++ {
				userCmd := &models.CreateUserCommand{
					Email: fmt.Sprint("user", i, "@test.com"),
					Name:  fmt.Sprint("user", i),
					Login: fmt.Sprint("loginuser", i),
				}
				err := CreateUser(context.Background(), userCmd)
				So(err, ShouldBeNil)
				userIds = append(userIds, userCmd.Result.Id)
			}

			var testOrgId int64 = 1
			group1 := models.CreateTeamCommand{OrgId: testOrgId, Name: "group1 name", Email: "test1@test.com"}
			group2 := models.CreateTeamCommand{OrgId: testOrgId, Name: "group2 name", Email: "test2@test.com"}

			err := CreateTeam(&group1)
			So(err, ShouldBeNil)
			err = CreateTeam(&group2)
			So(err, ShouldBeNil)

			Convey("Should be able to create teams and add users", func() {
				query := &models.SearchTeamsQuery{OrgId: testOrgId, Name: "group1 name", Page: 1, Limit: 10}
				err = SearchTeams(query)
				So(err, ShouldBeNil)
				So(query.Page, ShouldEqual, 1)

				team1 := query.Result.Teams[0]
				So(team1.Name, ShouldEqual, "group1 name")
				So(team1.Email, ShouldEqual, "test1@test.com")
				So(team1.OrgId, ShouldEqual, testOrgId)

				err = AddTeamMember(&models.AddTeamMemberCommand{OrgId: testOrgId, TeamId: team1.Id, UserId: userIds[0]})
				So(err, ShouldBeNil)
				err = AddTeamMember(&models.AddTeamMemberCommand{OrgId: testOrgId, TeamId: team1.Id, UserId: userIds[1], External: true})
				So(err, ShouldBeNil)

				q1 := &models.GetTeamMembersQuery{OrgId: testOrgId, TeamId: team1.Id}
				err = GetTeamMembers(q1)
				So(err, ShouldBeNil)
				So(q1.Result, ShouldHaveLength, 2)
				So(q1.Result[0].TeamId, ShouldEqual, team1.Id)
				So(q1.Result[0].Login, ShouldEqual, "loginuser0")
				So(q1.Result[0].OrgId, ShouldEqual, testOrgId)
				So(q1.Result[1].TeamId, ShouldEqual, team1.Id)
				So(q1.Result[1].Login, ShouldEqual, "loginuser1")
				So(q1.Result[1].OrgId, ShouldEqual, testOrgId)
				So(q1.Result[1].External, ShouldEqual, true)

				q2 := &models.GetTeamMembersQuery{OrgId: testOrgId, TeamId: team1.Id, External: true}
				err = GetTeamMembers(q2)
				So(err, ShouldBeNil)
				So(q2.Result, ShouldHaveLength, 1)
				So(q2.Result[0].TeamId, ShouldEqual, team1.Id)
				So(q2.Result[0].Login, ShouldEqual, "loginuser1")
				So(q2.Result[0].OrgId, ShouldEqual, testOrgId)
				So(q2.Result[0].External, ShouldEqual, true)
			})

			Convey("Should return latest auth module for users when getting team members", func() {
				userId := userIds[1]
				err := SetAuthInfo(&models.SetAuthInfoCommand{UserId: userId, AuthModule: "oauth_github", AuthId: "1234567"})
				So(err, ShouldBeNil)

				teamQuery := &models.SearchTeamsQuery{OrgId: testOrgId, Name: "group1 name", Page: 1, Limit: 10}
				err = SearchTeams(teamQuery)
				So(err, ShouldBeNil)
				So(teamQuery.Page, ShouldEqual, 1)

				team1 := teamQuery.Result.Teams[0]

				err = AddTeamMember(&models.AddTeamMemberCommand{OrgId: testOrgId, TeamId: team1.Id, UserId: userId, External: true})
				So(err, ShouldBeNil)

				memberQuery := &models.GetTeamMembersQuery{OrgId: testOrgId, TeamId: team1.Id, External: true}
				err = GetTeamMembers(memberQuery)
				So(err, ShouldBeNil)
				So(memberQuery.Result, ShouldHaveLength, 1)
				So(memberQuery.Result[0].TeamId, ShouldEqual, team1.Id)
				So(memberQuery.Result[0].Login, ShouldEqual, "loginuser1")
				So(memberQuery.Result[0].OrgId, ShouldEqual, testOrgId)
				So(memberQuery.Result[0].External, ShouldEqual, true)
				So(memberQuery.Result[0].AuthModule, ShouldEqual, "oauth_github")
			})

			Convey("Should be able to update users in a team", func() {
				userId := userIds[0]
				team := group1.Result
				addMemberCmd := models.AddTeamMemberCommand{OrgId: testOrgId, TeamId: team.Id, UserId: userId}
				err = AddTeamMember(&addMemberCmd)
				So(err, ShouldBeNil)

				qBeforeUpdate := &models.GetTeamMembersQuery{OrgId: testOrgId, TeamId: team.Id}
				err = GetTeamMembers(qBeforeUpdate)
				So(err, ShouldBeNil)
				So(qBeforeUpdate.Result[0].Permission, ShouldEqual, 0)

				err = UpdateTeamMember(&models.UpdateTeamMemberCommand{
					UserId:     userId,
					OrgId:      testOrgId,
					TeamId:     team.Id,
					Permission: models.PERMISSION_ADMIN,
				})

				So(err, ShouldBeNil)

				qAfterUpdate := &models.GetTeamMembersQuery{OrgId: testOrgId, TeamId: team.Id}
				err = GetTeamMembers(qAfterUpdate)
				So(err, ShouldBeNil)
				So(qAfterUpdate.Result[0].Permission, ShouldEqual, models.PERMISSION_ADMIN)
			})

			Convey("Should default to member permission level when updating a user with invalid permission level", func() {
				userID := userIds[0]
				team := group1.Result
				addMemberCmd := models.AddTeamMemberCommand{OrgId: testOrgId, TeamId: team.Id, UserId: userID}
				err = AddTeamMember(&addMemberCmd)
				So(err, ShouldBeNil)

				qBeforeUpdate := &models.GetTeamMembersQuery{OrgId: testOrgId, TeamId: team.Id}
				err = GetTeamMembers(qBeforeUpdate)
				So(err, ShouldBeNil)
				So(qBeforeUpdate.Result[0].Permission, ShouldEqual, 0)

				invalidPermissionLevel := models.PERMISSION_EDIT
				err = UpdateTeamMember(&models.UpdateTeamMemberCommand{
					UserId:     userID,
					OrgId:      testOrgId,
					TeamId:     team.Id,
					Permission: invalidPermissionLevel,
				})

				So(err, ShouldBeNil)

				qAfterUpdate := &models.GetTeamMembersQuery{OrgId: testOrgId, TeamId: team.Id}
				err = GetTeamMembers(qAfterUpdate)
				So(err, ShouldBeNil)
				So(qAfterUpdate.Result[0].Permission, ShouldEqual, 0)
			})

			Convey("Shouldn't be able to update a user not in the team.", func() {
				err = UpdateTeamMember(&models.UpdateTeamMemberCommand{
					UserId:     1,
					OrgId:      testOrgId,
					TeamId:     group1.Result.Id,
					Permission: models.PERMISSION_ADMIN,
				})

				So(err, ShouldEqual, models.ErrTeamMemberNotFound)
			})

			Convey("Should be able to search for teams", func() {
				query := &models.SearchTeamsQuery{OrgId: testOrgId, Query: "group", Page: 1}
				err = SearchTeams(query)
				So(err, ShouldBeNil)
				So(len(query.Result.Teams), ShouldEqual, 2)
				So(query.Result.TotalCount, ShouldEqual, 2)

				query2 := &models.SearchTeamsQuery{OrgId: testOrgId, Query: ""}
				err = SearchTeams(query2)
				So(err, ShouldBeNil)
				So(len(query2.Result.Teams), ShouldEqual, 2)
			})

			Convey("Should be able to return all teams a user is member of", func() {
				groupId := group2.Result.Id
				err := AddTeamMember(&models.AddTeamMemberCommand{OrgId: testOrgId, TeamId: groupId, UserId: userIds[0]})
				So(err, ShouldBeNil)

				query := &models.GetTeamsByUserQuery{OrgId: testOrgId, UserId: userIds[0]}
				err = GetTeamsByUser(query)
				So(err, ShouldBeNil)
				So(len(query.Result), ShouldEqual, 1)
				So(query.Result[0].Name, ShouldEqual, "group2 name")
				So(query.Result[0].Email, ShouldEqual, "test2@test.com")
			})

			Convey("Should be able to remove users from a group", func() {
				err = AddTeamMember(&models.AddTeamMemberCommand{OrgId: testOrgId, TeamId: group1.Result.Id, UserId: userIds[0]})
				So(err, ShouldBeNil)

				err = RemoveTeamMember(&models.RemoveTeamMemberCommand{OrgId: testOrgId, TeamId: group1.Result.Id, UserId: userIds[0]})
				So(err, ShouldBeNil)

				q2 := &models.GetTeamMembersQuery{OrgId: testOrgId, TeamId: group1.Result.Id}
				err = GetTeamMembers(q2)
				So(err, ShouldBeNil)
				So(len(q2.Result), ShouldEqual, 0)
			})

			Convey("When ProtectLastAdmin is set to true", func() {
				err = AddTeamMember(&models.AddTeamMemberCommand{OrgId: testOrgId, TeamId: group1.Result.Id, UserId: userIds[0], Permission: models.PERMISSION_ADMIN})
				So(err, ShouldBeNil)

				Convey("A user should not be able to remove the last admin", func() {
					err = RemoveTeamMember(&models.RemoveTeamMemberCommand{OrgId: testOrgId, TeamId: group1.Result.Id, UserId: userIds[0], ProtectLastAdmin: true})
					So(err, ShouldEqual, models.ErrLastTeamAdmin)
				})

				Convey("A user should be able to remove an admin if there are other admins", func() {
					err = AddTeamMember(&models.AddTeamMemberCommand{OrgId: testOrgId, TeamId: group1.Result.Id, UserId: userIds[1], Permission: models.PERMISSION_ADMIN})
					So(err, ShouldBeNil)
					err = RemoveTeamMember(&models.RemoveTeamMemberCommand{OrgId: testOrgId, TeamId: group1.Result.Id, UserId: userIds[0], ProtectLastAdmin: true})
					So(err, ShouldBeNil)
				})

				Convey("A user should not be able to remove the admin permission for the last admin", func() {
					err = UpdateTeamMember(&models.UpdateTeamMemberCommand{OrgId: testOrgId, TeamId: group1.Result.Id, UserId: userIds[0], Permission: 0, ProtectLastAdmin: true})
					So(err, ShouldBeError, models.ErrLastTeamAdmin)
				})

				Convey("A user should be able to remove the admin permission if there are other admins", func() {
					err = AddTeamMember(&models.AddTeamMemberCommand{OrgId: testOrgId, TeamId: group1.Result.Id, UserId: userIds[1], Permission: models.PERMISSION_ADMIN})
					So(err, ShouldBeNil)
					err = UpdateTeamMember(&models.UpdateTeamMemberCommand{OrgId: testOrgId, TeamId: group1.Result.Id, UserId: userIds[0], Permission: 0, ProtectLastAdmin: true})
					So(err, ShouldBeNil)
				})
			})

			Convey("Should be able to remove a group with users and permissions", func() {
				groupId := group2.Result.Id
				err := AddTeamMember(&models.AddTeamMemberCommand{OrgId: testOrgId, TeamId: groupId, UserId: userIds[1]})
				So(err, ShouldBeNil)
				err = AddTeamMember(&models.AddTeamMemberCommand{OrgId: testOrgId, TeamId: groupId, UserId: userIds[2]})
				So(err, ShouldBeNil)
				err = testHelperUpdateDashboardAcl(1, models.DashboardAcl{DashboardId: 1, OrgId: testOrgId, Permission: models.PERMISSION_EDIT, TeamId: groupId})
				So(err, ShouldBeNil)
				err = DeleteTeam(&models.DeleteTeamCommand{OrgId: testOrgId, Id: groupId})
				So(err, ShouldBeNil)

				query := &models.GetTeamByIdQuery{OrgId: testOrgId, Id: groupId}
				err = GetTeamById(query)
				So(err, ShouldEqual, models.ErrTeamNotFound)

				permQuery := &models.GetDashboardAclInfoListQuery{DashboardId: 1, OrgId: testOrgId}
				err = GetDashboardAclInfoList(permQuery)
				So(err, ShouldBeNil)

				So(len(permQuery.Result), ShouldEqual, 0)
			})

			Convey("Should be able to return if user is admin of teams or not", func() {
				groupId := group2.Result.Id
				err := AddTeamMember(&models.AddTeamMemberCommand{OrgId: testOrgId, TeamId: groupId, UserId: userIds[0]})
				So(err, ShouldBeNil)
				err = AddTeamMember(&models.AddTeamMemberCommand{OrgId: testOrgId, TeamId: groupId, UserId: userIds[1], Permission: models.PERMISSION_ADMIN})
				So(err, ShouldBeNil)

				query := &models.IsAdminOfTeamsQuery{SignedInUser: &models.SignedInUser{OrgId: testOrgId, UserId: userIds[0]}}
				err = IsAdminOfTeams(query)
				So(err, ShouldBeNil)
				So(query.Result, ShouldBeFalse)

				query = &models.IsAdminOfTeamsQuery{SignedInUser: &models.SignedInUser{OrgId: testOrgId, UserId: userIds[1]}}
				err = IsAdminOfTeams(query)
				So(err, ShouldBeNil)
				So(query.Result, ShouldBeTrue)
			})
		})
	})
}
