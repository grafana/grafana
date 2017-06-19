package sqlstore

import (
	"fmt"
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	m "github.com/grafana/grafana/pkg/models"
)

func TestUserGroupCommandsAndQueries(t *testing.T) {

	Convey("Testing User Group commands & queries", t, func() {
		InitTestDB(t)

		Convey("Given saved users and two user groups", func() {
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

			group1 := m.CreateUserGroupCommand{Name: "group1 name"}
			group2 := m.CreateUserGroupCommand{Name: "group2 name"}

			err := CreateUserGroup(&group1)
			So(err, ShouldBeNil)
			err = CreateUserGroup(&group2)
			So(err, ShouldBeNil)

			Convey("Should be able to create user groups and add users", func() {
				query := &m.SearchUserGroupsQuery{Name: "group1 name", Page: 1, Limit: 10}
				err = SearchUserGroups(query)
				So(err, ShouldBeNil)
				So(query.Page, ShouldEqual, 1)

				userGroup1 := query.Result.UserGroups[0]
				So(userGroup1.Name, ShouldEqual, "group1 name")

				err = AddUserGroupMember(&m.AddUserGroupMemberCommand{OrgId: 1, UserGroupId: userGroup1.Id, UserId: userIds[0]})
				So(err, ShouldBeNil)

				q1 := &m.GetUserGroupMembersQuery{UserGroupId: userGroup1.Id}
				err = GetUserGroupMembers(q1)
				So(err, ShouldBeNil)
				So(q1.Result[0].UserGroupId, ShouldEqual, userGroup1.Id)
				So(q1.Result[0].Login, ShouldEqual, "loginuser0")
			})

			Convey("Should be able to search for user groups", func() {
				query := &m.SearchUserGroupsQuery{Query: "group", Page: 1}
				err = SearchUserGroups(query)
				So(err, ShouldBeNil)
				So(len(query.Result.UserGroups), ShouldEqual, 2)
				So(query.Result.TotalCount, ShouldEqual, 2)

				query2 := &m.SearchUserGroupsQuery{Query: ""}
				err = SearchUserGroups(query2)
				So(err, ShouldBeNil)
				So(len(query2.Result.UserGroups), ShouldEqual, 2)
			})

			Convey("Should be able to return all user groups a user is member of", func() {
				groupId := group2.Result.Id
				err := AddUserGroupMember(&m.AddUserGroupMemberCommand{OrgId: 1, UserGroupId: groupId, UserId: userIds[0]})

				query := &m.GetUserGroupsByUserQuery{UserId: userIds[0]}
				err = GetUserGroupsByUser(query)
				So(err, ShouldBeNil)
				So(len(query.Result), ShouldEqual, 1)
				So(query.Result[0].Name, ShouldEqual, "group2 name")
			})

			Convey("Should be able to remove users from a group", func() {
				err = RemoveUserGroupMember(&m.RemoveUserGroupMemberCommand{UserGroupId: group1.Result.Id, UserId: userIds[0]})
				So(err, ShouldBeNil)

				q1 := &m.GetUserGroupMembersQuery{UserGroupId: group1.Result.Id}
				err = GetUserGroupMembers(q1)
				So(err, ShouldBeNil)
				So(len(q1.Result), ShouldEqual, 0)
			})

			Convey("Should be able to remove a group with users and permissions", func() {
				groupId := group2.Result.Id
				err := AddUserGroupMember(&m.AddUserGroupMemberCommand{OrgId: 1, UserGroupId: groupId, UserId: userIds[1]})
				So(err, ShouldBeNil)
				err = AddUserGroupMember(&m.AddUserGroupMemberCommand{OrgId: 1, UserGroupId: groupId, UserId: userIds[2]})
				So(err, ShouldBeNil)
				err = SetDashboardAcl(&m.SetDashboardAclCommand{DashboardId: 1, OrgId: 1, Permissions: m.PERMISSION_EDIT, UserGroupId: groupId})

				err = DeleteUserGroup(&m.DeleteUserGroupCommand{Id: groupId})
				So(err, ShouldBeNil)

				query := &m.GetUserGroupByIdQuery{Id: groupId}
				err = GetUserGroupById(query)
				So(err, ShouldEqual, m.ErrUserGroupNotFound)

				permQuery := &m.GetDashboardAclInfoListQuery{DashboardId: 1}
				err = GetDashboardAclInfoList(permQuery)
				So(err, ShouldBeNil)

				So(len(permQuery.Result), ShouldEqual, 0)
			})
		})
	})
}
