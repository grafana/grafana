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

			Convey("When adding dashboard permission with userId and teamId set to 0", func() {
				err := testHelperUpdateDashboardAcl(savedFolder.Id, m.DashboardAcl{
					OrgId:       1,
					DashboardId: savedFolder.Id,
					Permission:  m.PERMISSION_EDIT,
				})
				So(err, ShouldEqual, m.ErrDashboardAclInfoMissing)
			})

			Convey("Given dashboard folder with default permissions", func() {
				Convey("When reading folder acl should include default acl", func() {
					query := m.GetDashboardAclInfoListQuery{DashboardId: savedFolder.Id, OrgId: 1}

					err := GetDashboardAclInfoList(&query)
					So(err, ShouldBeNil)

					So(len(query.Result), ShouldEqual, 2)
					defaultPermissionsId := -1
					So(query.Result[0].DashboardId, ShouldEqual, defaultPermissionsId)
					So(*query.Result[0].Role, ShouldEqual, m.ROLE_VIEWER)
					So(query.Result[0].Inherited, ShouldBeFalse)
					So(query.Result[1].DashboardId, ShouldEqual, defaultPermissionsId)
					So(*query.Result[1].Role, ShouldEqual, m.ROLE_EDITOR)
					So(query.Result[1].Inherited, ShouldBeFalse)
				})

				Convey("When reading dashboard acl should include acl for parent folder", func() {
					query := m.GetDashboardAclInfoListQuery{DashboardId: childDash.Id, OrgId: 1}

					err := GetDashboardAclInfoList(&query)
					So(err, ShouldBeNil)

					So(len(query.Result), ShouldEqual, 2)
					defaultPermissionsId := -1
					So(query.Result[0].DashboardId, ShouldEqual, defaultPermissionsId)
					So(*query.Result[0].Role, ShouldEqual, m.ROLE_VIEWER)
					So(query.Result[0].Inherited, ShouldBeTrue)
					So(query.Result[1].DashboardId, ShouldEqual, defaultPermissionsId)
					So(*query.Result[1].Role, ShouldEqual, m.ROLE_EDITOR)
					So(query.Result[1].Inherited, ShouldBeTrue)
				})
			})

			Convey("Given dashboard folder with removed default permissions", func() {
				err := UpdateDashboardAcl(&m.UpdateDashboardAclCommand{
					DashboardId: savedFolder.Id,
					Items:       []*m.DashboardAcl{},
				})
				So(err, ShouldBeNil)

				Convey("When reading dashboard acl should return no acl items", func() {
					query := m.GetDashboardAclInfoListQuery{DashboardId: childDash.Id, OrgId: 1}

					err := GetDashboardAclInfoList(&query)
					So(err, ShouldBeNil)

					So(len(query.Result), ShouldEqual, 0)
				})
			})

			Convey("Given dashboard folder permission", func() {
				err := testHelperUpdateDashboardAcl(savedFolder.Id, m.DashboardAcl{
					OrgId:       1,
					UserId:      currentUser.Id,
					DashboardId: savedFolder.Id,
					Permission:  m.PERMISSION_EDIT,
				})
				So(err, ShouldBeNil)

				Convey("When reading dashboard acl should include acl for parent folder", func() {
					query := m.GetDashboardAclInfoListQuery{DashboardId: childDash.Id, OrgId: 1}

					err := GetDashboardAclInfoList(&query)
					So(err, ShouldBeNil)

					So(len(query.Result), ShouldEqual, 1)
					So(query.Result[0].DashboardId, ShouldEqual, savedFolder.Id)
				})

				Convey("Given child dashboard permission", func() {
					err := testHelperUpdateDashboardAcl(childDash.Id, m.DashboardAcl{
						OrgId:       1,
						UserId:      currentUser.Id,
						DashboardId: childDash.Id,
						Permission:  m.PERMISSION_EDIT,
					})
					So(err, ShouldBeNil)

					Convey("When reading dashboard acl should include acl for parent folder and child", func() {
						query := m.GetDashboardAclInfoListQuery{OrgId: 1, DashboardId: childDash.Id}

						err := GetDashboardAclInfoList(&query)
						So(err, ShouldBeNil)

						So(len(query.Result), ShouldEqual, 2)
						So(query.Result[0].DashboardId, ShouldEqual, savedFolder.Id)
						So(query.Result[0].Inherited, ShouldBeTrue)
						So(query.Result[1].DashboardId, ShouldEqual, childDash.Id)
						So(query.Result[1].Inherited, ShouldBeFalse)
					})
				})
			})

			Convey("Given child dashboard permission in folder with no permissions", func() {
				err := testHelperUpdateDashboardAcl(childDash.Id, m.DashboardAcl{
					OrgId:       1,
					UserId:      currentUser.Id,
					DashboardId: childDash.Id,
					Permission:  m.PERMISSION_EDIT,
				})
				So(err, ShouldBeNil)

				Convey("When reading dashboard acl should include default acl for parent folder and the child acl", func() {
					query := m.GetDashboardAclInfoListQuery{OrgId: 1, DashboardId: childDash.Id}

					err := GetDashboardAclInfoList(&query)
					So(err, ShouldBeNil)

					defaultPermissionsId := -1
					So(len(query.Result), ShouldEqual, 3)
					So(query.Result[0].DashboardId, ShouldEqual, defaultPermissionsId)
					So(*query.Result[0].Role, ShouldEqual, m.ROLE_VIEWER)
					So(query.Result[0].Inherited, ShouldBeTrue)
					So(query.Result[1].DashboardId, ShouldEqual, defaultPermissionsId)
					So(*query.Result[1].Role, ShouldEqual, m.ROLE_EDITOR)
					So(query.Result[1].Inherited, ShouldBeTrue)
					So(query.Result[2].DashboardId, ShouldEqual, childDash.Id)
					So(query.Result[2].Inherited, ShouldBeFalse)
				})
			})

			Convey("Should be able to add dashboard permission", func() {
				err := testHelperUpdateDashboardAcl(savedFolder.Id, m.DashboardAcl{
					OrgId:       1,
					UserId:      currentUser.Id,
					DashboardId: savedFolder.Id,
					Permission:  m.PERMISSION_EDIT,
				})
				So(err, ShouldBeNil)

				q1 := &m.GetDashboardAclInfoListQuery{DashboardId: savedFolder.Id, OrgId: 1}
				err = GetDashboardAclInfoList(q1)
				So(err, ShouldBeNil)

				So(q1.Result[0].DashboardId, ShouldEqual, savedFolder.Id)
				So(q1.Result[0].Permission, ShouldEqual, m.PERMISSION_EDIT)
				So(q1.Result[0].PermissionName, ShouldEqual, "Edit")
				So(q1.Result[0].UserId, ShouldEqual, currentUser.Id)
				So(q1.Result[0].UserLogin, ShouldEqual, currentUser.Login)
				So(q1.Result[0].UserEmail, ShouldEqual, currentUser.Email)

				Convey("Should be able to delete an existing permission", func() {
					err := testHelperUpdateDashboardAcl(savedFolder.Id)
					So(err, ShouldBeNil)

					q3 := &m.GetDashboardAclInfoListQuery{DashboardId: savedFolder.Id, OrgId: 1}
					err = GetDashboardAclInfoList(q3)
					So(err, ShouldBeNil)
					So(len(q3.Result), ShouldEqual, 0)
				})
			})

			Convey("Given a team", func() {
				group1 := m.CreateTeamCommand{Name: "group1 name", OrgId: 1}
				err := CreateTeam(&group1)
				So(err, ShouldBeNil)

				Convey("Should be able to add a user permission for a team", func() {
					err := testHelperUpdateDashboardAcl(savedFolder.Id, m.DashboardAcl{
						OrgId:       1,
						TeamId:      group1.Result.Id,
						DashboardId: savedFolder.Id,
						Permission:  m.PERMISSION_EDIT,
					})
					So(err, ShouldBeNil)

					q1 := &m.GetDashboardAclInfoListQuery{DashboardId: savedFolder.Id, OrgId: 1}
					err = GetDashboardAclInfoList(q1)
					So(err, ShouldBeNil)
					So(q1.Result[0].DashboardId, ShouldEqual, savedFolder.Id)
					So(q1.Result[0].Permission, ShouldEqual, m.PERMISSION_EDIT)
					So(q1.Result[0].TeamId, ShouldEqual, group1.Result.Id)
				})

				Convey("Should be able to update an existing permission for a team", func() {
					err := testHelperUpdateDashboardAcl(savedFolder.Id, m.DashboardAcl{
						OrgId:       1,
						TeamId:      group1.Result.Id,
						DashboardId: savedFolder.Id,
						Permission:  m.PERMISSION_ADMIN,
					})
					So(err, ShouldBeNil)

					q3 := &m.GetDashboardAclInfoListQuery{DashboardId: savedFolder.Id, OrgId: 1}
					err = GetDashboardAclInfoList(q3)
					So(err, ShouldBeNil)
					So(len(q3.Result), ShouldEqual, 1)
					So(q3.Result[0].DashboardId, ShouldEqual, savedFolder.Id)
					So(q3.Result[0].Permission, ShouldEqual, m.PERMISSION_ADMIN)
					So(q3.Result[0].TeamId, ShouldEqual, group1.Result.Id)
				})
			})
		})

		Convey("Given a root folder", func() {
			var rootFolderId int64 = 0

			Convey("When reading dashboard acl should return default permissions", func() {
				query := m.GetDashboardAclInfoListQuery{DashboardId: rootFolderId, OrgId: 1}

				err := GetDashboardAclInfoList(&query)
				So(err, ShouldBeNil)

				So(len(query.Result), ShouldEqual, 2)
				defaultPermissionsId := -1
				So(query.Result[0].DashboardId, ShouldEqual, defaultPermissionsId)
				So(*query.Result[0].Role, ShouldEqual, m.ROLE_VIEWER)
				So(query.Result[0].Inherited, ShouldBeFalse)
				So(query.Result[1].DashboardId, ShouldEqual, defaultPermissionsId)
				So(*query.Result[1].Role, ShouldEqual, m.ROLE_EDITOR)
				So(query.Result[1].Inherited, ShouldBeFalse)
			})
		})
	})
}
