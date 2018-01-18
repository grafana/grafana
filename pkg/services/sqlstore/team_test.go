package sqlstore

import (
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
				err := CreateUser(userCmd)
				So(err, ShouldBeNil)
				userIds = append(userIds, userCmd.Result.Id)
			}

			group1 := m.CreateTeamCommand{Name: "group1 name", Email: "test1@test.com"}
			group2 := m.CreateTeamCommand{Name: "group2 name", Email: "test2@test.com"}

			err := CreateTeam(&group1)
			So(err, ShouldBeNil)
			err = CreateTeam(&group2)
			So(err, ShouldBeNil)

			Convey("Should be able to create teams and add users", func() {
				query := &m.SearchTeamsQuery{Name: "group1 name", Page: 1, Limit: 10}
				err = SearchTeams(query)
				So(err, ShouldBeNil)
				So(query.Page, ShouldEqual, 1)

				team1 := query.Result.Teams[0]
				So(team1.Name, ShouldEqual, "group1 name")
				So(team1.Email, ShouldEqual, "test1@test.com")

				err = AddTeamMember(&m.AddTeamMemberCommand{OrgId: 1, TeamId: team1.Id, UserId: userIds[0]})
				So(err, ShouldBeNil)

				q1 := &m.GetTeamMembersQuery{TeamId: team1.Id}
				err = GetTeamMembers(q1)
				So(err, ShouldBeNil)
				So(q1.Result[0].TeamId, ShouldEqual, team1.Id)
				So(q1.Result[0].Login, ShouldEqual, "loginuser0")
			})

			Convey("Should be able to search for teams", func() {
				query := &m.SearchTeamsQuery{Query: "group", Page: 1}
				err = SearchTeams(query)
				So(err, ShouldBeNil)
				So(len(query.Result.Teams), ShouldEqual, 2)
				So(query.Result.TotalCount, ShouldEqual, 2)

				query2 := &m.SearchTeamsQuery{Query: ""}
				err = SearchTeams(query2)
				So(err, ShouldBeNil)
				So(len(query2.Result.Teams), ShouldEqual, 2)
			})

			Convey("Should be able to return all teams a user is member of", func() {
				groupId := group2.Result.Id
				err := AddTeamMember(&m.AddTeamMemberCommand{OrgId: 1, TeamId: groupId, UserId: userIds[0]})

				query := &m.GetTeamsByUserQuery{UserId: userIds[0]}
				err = GetTeamsByUser(query)
				So(err, ShouldBeNil)
				So(len(query.Result), ShouldEqual, 1)
				So(query.Result[0].Name, ShouldEqual, "group2 name")
				So(query.Result[0].Email, ShouldEqual, "test2@test.com")
			})

			Convey("Should be able to remove users from a group", func() {
				err = RemoveTeamMember(&m.RemoveTeamMemberCommand{TeamId: group1.Result.Id, UserId: userIds[0]})
				So(err, ShouldBeNil)

				q1 := &m.GetTeamMembersQuery{TeamId: group1.Result.Id}
				err = GetTeamMembers(q1)
				So(err, ShouldBeNil)
				So(len(q1.Result), ShouldEqual, 0)
			})

			Convey("Should be able to remove a group with users and permissions", func() {
				groupId := group2.Result.Id
				err := AddTeamMember(&m.AddTeamMemberCommand{OrgId: 1, TeamId: groupId, UserId: userIds[1]})
				So(err, ShouldBeNil)
				err = AddTeamMember(&m.AddTeamMemberCommand{OrgId: 1, TeamId: groupId, UserId: userIds[2]})
				So(err, ShouldBeNil)
				err = SetDashboardAcl(&m.SetDashboardAclCommand{DashboardId: 1, OrgId: 1, Permission: m.PERMISSION_EDIT, TeamId: groupId})

				err = DeleteTeam(&m.DeleteTeamCommand{Id: groupId})
				So(err, ShouldBeNil)

				query := &m.GetTeamByIdQuery{Id: groupId}
				err = GetTeamById(query)
				So(err, ShouldEqual, m.ErrTeamNotFound)

				permQuery := &m.GetDashboardAclInfoListQuery{DashboardId: 1, OrgId: 1}
				err = GetDashboardAclInfoList(permQuery)
				So(err, ShouldBeNil)

				So(len(permQuery.Result), ShouldEqual, 0)
			})
		})
	})
}
