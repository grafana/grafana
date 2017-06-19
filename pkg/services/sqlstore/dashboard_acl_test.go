package sqlstore

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	m "github.com/grafana/grafana/pkg/models"
)

func TestDashboardAclDataAccess(t *testing.T) {
	Convey("Testing DB", t, func() {
		InitTestDB(t)
		Convey("Given a dashboard folder and a user", func() {
			currentUser := createUser("viewer", "Viewer", false)
			savedFolder := insertTestDashboard("1 test dash folder", 1, 0, true, "prod", "webapp")
			childDash := insertTestDashboard("2 test dash", 1, savedFolder.Id, false, "prod", "webapp")

			Convey("When adding dashboard permission with userId and userGroupId set to 0", func() {
				err := SetDashboardAcl(&m.SetDashboardAclCommand{
					OrgId:       1,
					DashboardId: savedFolder.Id,
					Permissions: m.PERMISSION_EDIT,
				})
				So(err, ShouldEqual, m.ErrDashboardPermissionUserOrUserGroupEmpty)
			})

			Convey("Given dashboard folder permission", func() {
				err := SetDashboardAcl(&m.SetDashboardAclCommand{
					OrgId:       1,
					UserId:      currentUser.Id,
					DashboardId: savedFolder.Id,
					Permissions: m.PERMISSION_EDIT,
				})
				So(err, ShouldBeNil)

				Convey("When reading dashboard acl should include acl for parent folder", func() {
					query := m.GetInheritedDashboardAclQuery{OrgId: 1, DashboardId: childDash.Id}

					err := GetInheritedDashboardAcl(&query)
					So(err, ShouldBeNil)

					So(len(query.Result), ShouldEqual, 1)
					So(query.Result[0].DashboardId, ShouldEqual, savedFolder.Id)
				})

				Convey("Given child dashboard permission", func() {
					err := SetDashboardAcl(&m.SetDashboardAclCommand{
						OrgId:       1,
						UserId:      currentUser.Id,
						DashboardId: childDash.Id,
						Permissions: m.PERMISSION_EDIT,
					})
					So(err, ShouldBeNil)

					Convey("When reading dashboard acl should include acl for parent folder and child", func() {
						query := m.GetInheritedDashboardAclQuery{OrgId: 1, DashboardId: childDash.Id}

						err := GetInheritedDashboardAcl(&query)
						So(err, ShouldBeNil)

						So(len(query.Result), ShouldEqual, 2)
						So(query.Result[0].DashboardId, ShouldEqual, savedFolder.Id)
						So(query.Result[1].DashboardId, ShouldEqual, childDash.Id)
					})
				})
			})

			Convey("Should be able to add dashboard permission", func() {
				err := SetDashboardAcl(&m.SetDashboardAclCommand{
					OrgId:       1,
					UserId:      currentUser.Id,
					DashboardId: savedFolder.Id,
					Permissions: m.PERMISSION_EDIT,
				})
				So(err, ShouldBeNil)

				q1 := &m.GetDashboardPermissionsQuery{DashboardId: savedFolder.Id}
				err = GetDashboardPermissions(q1)
				So(err, ShouldBeNil)
				So(q1.Result[0].DashboardId, ShouldEqual, savedFolder.Id)
				So(q1.Result[0].Permissions, ShouldEqual, m.PERMISSION_EDIT)
				So(q1.Result[0].PermissionName, ShouldEqual, "Edit")
				So(q1.Result[0].UserId, ShouldEqual, currentUser.Id)
				So(q1.Result[0].UserLogin, ShouldEqual, currentUser.Login)
				So(q1.Result[0].UserEmail, ShouldEqual, currentUser.Email)

				Convey("Should update hasAcl field to true for dashboard folder and its children", func() {
					q2 := &m.GetDashboardsQuery{DashboardIds: []int64{savedFolder.Id, childDash.Id}}
					err := GetDashboards(q2)
					So(err, ShouldBeNil)
					So(q2.Result[0].HasAcl, ShouldBeTrue)
					So(q2.Result[1].HasAcl, ShouldBeTrue)
				})

				Convey("Should be able to update an existing permission", func() {
					err := SetDashboardAcl(&m.SetDashboardAclCommand{
						OrgId:       1,
						UserId:      1,
						DashboardId: savedFolder.Id,
						Permissions: m.PERMISSION_READ_ONLY_EDIT,
					})
					So(err, ShouldBeNil)

					q3 := &m.GetDashboardPermissionsQuery{DashboardId: savedFolder.Id}
					err = GetDashboardPermissions(q3)
					So(err, ShouldBeNil)
					So(len(q3.Result), ShouldEqual, 1)
					So(q3.Result[0].DashboardId, ShouldEqual, savedFolder.Id)
					So(q3.Result[0].Permissions, ShouldEqual, m.PERMISSION_READ_ONLY_EDIT)
					So(q3.Result[0].UserId, ShouldEqual, 1)

				})

				Convey("Should be able to delete an existing permission", func() {
					err := RemoveDashboardAcl(&m.RemoveDashboardAclCommand{
						OrgId:       1,
						UserId:      1,
						DashboardId: savedFolder.Id,
					})
					So(err, ShouldBeNil)

					q3 := &m.GetDashboardPermissionsQuery{DashboardId: savedFolder.Id}
					err = GetDashboardPermissions(q3)
					So(err, ShouldBeNil)
					So(len(q3.Result), ShouldEqual, 0)
				})
			})

			Convey("Given a user group", func() {
				group1 := m.CreateUserGroupCommand{Name: "group1 name", OrgId: 1}
				err := CreateUserGroup(&group1)
				So(err, ShouldBeNil)

				Convey("Should be able to add a user permission for a user group", func() {
					err := SetDashboardAcl(&m.SetDashboardAclCommand{
						OrgId:       1,
						UserGroupId: group1.Result.Id,
						DashboardId: savedFolder.Id,
						Permissions: m.PERMISSION_EDIT,
					})
					So(err, ShouldBeNil)

					q1 := &m.GetDashboardPermissionsQuery{DashboardId: savedFolder.Id}
					err = GetDashboardPermissions(q1)
					So(err, ShouldBeNil)
					So(q1.Result[0].DashboardId, ShouldEqual, savedFolder.Id)
					So(q1.Result[0].Permissions, ShouldEqual, m.PERMISSION_EDIT)
					So(q1.Result[0].UserGroupId, ShouldEqual, group1.Result.Id)
				})

				Convey("Should be able to update an existing permission for a user group", func() {
					err := SetDashboardAcl(&m.SetDashboardAclCommand{
						OrgId:       1,
						UserGroupId: group1.Result.Id,
						DashboardId: savedFolder.Id,
						Permissions: m.PERMISSION_READ_ONLY_EDIT,
					})
					So(err, ShouldBeNil)

					q3 := &m.GetDashboardPermissionsQuery{DashboardId: savedFolder.Id}
					err = GetDashboardPermissions(q3)
					So(err, ShouldBeNil)
					So(len(q3.Result), ShouldEqual, 1)
					So(q3.Result[0].DashboardId, ShouldEqual, savedFolder.Id)
					So(q3.Result[0].Permissions, ShouldEqual, m.PERMISSION_READ_ONLY_EDIT)
					So(q3.Result[0].UserGroupId, ShouldEqual, group1.Result.Id)

				})

				Convey("Should be able to delete an existing permission for a user group", func() {
					err := RemoveDashboardAcl(&m.RemoveDashboardAclCommand{
						OrgId:       1,
						UserGroupId: group1.Result.Id,
						DashboardId: savedFolder.Id,
					})
					So(err, ShouldBeNil)

					q3 := &m.GetDashboardPermissionsQuery{DashboardId: savedFolder.Id}
					err = GetDashboardPermissions(q3)
					So(err, ShouldBeNil)
					So(len(q3.Result), ShouldEqual, 0)
				})
			})
		})
	})
}
