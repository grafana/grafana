package sqlstore

import (
	"context"
	"fmt"
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	m "github.com/grafana/grafana/pkg/models"
)

func TestTeamCommandsAndQueries(t *testing.T) {

	Convey("Testing Team commands & queries", t, func() {
		InitTestDB(t)

		Convey("Given saved users and two teams", func() {
			var userIds []int64
			for i := 0; i < 5; i++ {
				userCmd := &m.CreateUserCommand{
					Email: fmt.Sprint("user", i, "@test.com"),
					Name:  fmt.Sprint("user", i),
					Login: fmt.Sprint("loginuser", i),
				}
				err := CreateUser(context.Background(), userCmd)
				So(err, ShouldBeNil)
				userIds = append(userIds, userCmd.Result.Id)
			}

			var testOrgId int64 = 1
			group1 := m.CreateTeamCommand{OrgId: testOrgId, Name: "group1 name", Email: "test1@test.com"}
			group2 := m.CreateTeamCommand{OrgId: testOrgId, Name: "group2 name", Email: "test2@test.com"}

			err := CreateTeam(&group1)
			So(err, ShouldBeNil)
			err = CreateTeam(&group2)
			So(err, ShouldBeNil)

			Convey("Should be able to create teams and add users", func() {
				query := &m.SearchTeamsQuery{OrgId: testOrgId, Name: "group1 name", Page: 1, Limit: 10}
				err = SearchTeams(query)
				So(err, ShouldBeNil)
				So(query.Page, ShouldEqual, 1)

				team1 := query.Result.Teams[0]
				So(team1.Name, ShouldEqual, "group1 name")
				So(team1.Email, ShouldEqual, "test1@test.com")
				So(team1.OrgId, ShouldEqual, testOrgId)

				err = AddTeamMember(&m.AddTeamMemberCommand{OrgId: testOrgId, TeamId: team1.Id, UserId: userIds[0]})
				So(err, ShouldBeNil)

				q1 := &m.GetTeamMembersQuery{OrgId: testOrgId, TeamId: team1.Id}
				err = GetTeamMembers(q1)
				So(err, ShouldBeNil)
				So(q1.Result[0].TeamId, ShouldEqual, team1.Id)
				So(q1.Result[0].Login, ShouldEqual, "loginuser0")
				So(q1.Result[0].OrgId, ShouldEqual, testOrgId)
			})

			Convey("Should be able to search for teams", func() {
				query := &m.SearchTeamsQuery{OrgId: testOrgId, Query: "group", Page: 1}
				err = SearchTeams(query)
				So(err, ShouldBeNil)
				So(len(query.Result.Teams), ShouldEqual, 2)
				So(query.Result.TotalCount, ShouldEqual, 2)

				query2 := &m.SearchTeamsQuery{OrgId: testOrgId, Query: ""}
				err = SearchTeams(query2)
				So(err, ShouldBeNil)
				So(len(query2.Result.Teams), ShouldEqual, 2)
			})

			Convey("Should be able to return all teams a user is member of", func() {
				groupId := group2.Result.Id
				err := AddTeamMember(&m.AddTeamMemberCommand{OrgId: testOrgId, TeamId: groupId, UserId: userIds[0]})
				So(err, ShouldBeNil)

				query := &m.GetTeamsByUserQuery{OrgId: testOrgId, UserId: userIds[0]}
				err = GetTeamsByUser(query)
				So(err, ShouldBeNil)
				So(len(query.Result), ShouldEqual, 1)
				So(query.Result[0].Name, ShouldEqual, "group2 name")
				So(query.Result[0].Email, ShouldEqual, "test2@test.com")
			})

			Convey("Should be able to remove users from a group", func() {
				err = AddTeamMember(&m.AddTeamMemberCommand{OrgId: testOrgId, TeamId: group1.Result.Id, UserId: userIds[0]})
				So(err, ShouldBeNil)

				err = RemoveTeamMember(&m.RemoveTeamMemberCommand{OrgId: testOrgId, TeamId: group1.Result.Id, UserId: userIds[0]})
				So(err, ShouldBeNil)

				q2 := &m.GetTeamMembersQuery{OrgId: testOrgId, TeamId: group1.Result.Id}
				err = GetTeamMembers(q2)
				So(err, ShouldBeNil)
				So(len(q2.Result), ShouldEqual, 0)
			})

			Convey("Should be able to remove a group with users and permissions", func() {
				groupId := group2.Result.Id
				err := AddTeamMember(&m.AddTeamMemberCommand{OrgId: testOrgId, TeamId: groupId, UserId: userIds[1]})
				So(err, ShouldBeNil)
				err = AddTeamMember(&m.AddTeamMemberCommand{OrgId: testOrgId, TeamId: groupId, UserId: userIds[2]})
				So(err, ShouldBeNil)
				err = testHelperUpdateDashboardAcl(1, m.DashboardAcl{DashboardId: 1, OrgId: testOrgId, Permission: m.PERMISSION_EDIT, TeamId: groupId})
				So(err, ShouldBeNil)
				err = DeleteTeam(&m.DeleteTeamCommand{OrgId: testOrgId, Id: groupId})
				So(err, ShouldBeNil)

				query := &m.GetTeamByIdQuery{OrgId: testOrgId, Id: groupId}
				err = GetTeamById(query)
				So(err, ShouldEqual, m.ErrTeamNotFound)

				permQuery := &m.GetDashboardAclInfoListQuery{DashboardId: 1, OrgId: testOrgId}
				err = GetDashboardAclInfoList(permQuery)
				So(err, ShouldBeNil)

				So(len(permQuery.Result), ShouldEqual, 0)
			})
		})
	})
}
