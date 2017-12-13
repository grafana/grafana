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
				err := SetDashboardAcl(&m.SetDashboardAclCommand{
					OrgId:       1,
					DashboardId: savedFolder.Id,
					Permission:  m.PERMISSION_EDIT,
				})
				So(err, ShouldEqual, m.ErrDashboardAclInfoMissing)
			})

			Convey("Given dashboard folder with default permissions", func() {
				Convey("When reading dashboard acl should include acl for parent folder", func() {
					query := m.GetDashboardAclInfoListQuery{DashboardId: childDash.Id, OrgId: 1}

					err := GetDashboardAclInfoList(&query)
					So(err, ShouldBeNil)

					So(len(query.Result), ShouldEqual, 2)
					defaultPermissionsId := -1
					So(query.Result[0].DashboardId, ShouldEqual, defaultPermissionsId)
					So(*query.Result[0].Role, ShouldEqual, m.ROLE_VIEWER)
					So(query.Result[1].DashboardId, ShouldEqual, defaultPermissionsId)
					So(*query.Result[1].Role, ShouldEqual, m.ROLE_EDITOR)
				})
			})

			Convey("Given dashboard folder permission", func() {
				err := SetDashboardAcl(&m.SetDashboardAclCommand{
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
					err := SetDashboardAcl(&m.SetDashboardAclCommand{
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
						So(query.Result[1].DashboardId, ShouldEqual, childDash.Id)
					})
				})
			})

			Convey("Given child dashboard permission in folder with no permissions", func() {
				err := SetDashboardAcl(&m.SetDashboardAclCommand{
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
					So(query.Result[1].DashboardId, ShouldEqual, defaultPermissionsId)
					So(*query.Result[1].Role, ShouldEqual, m.ROLE_EDITOR)
					So(query.Result[2].DashboardId, ShouldEqual, childDash.Id)
				})
			})

			Convey("Should be able to add dashboard permission", func() {
				setDashAclCmd := m.SetDashboardAclCommand{
					OrgId:       1,
					UserId:      currentUser.Id,
					DashboardId: savedFolder.Id,
					Permission:  m.PERMISSION_EDIT,
				}

				err := SetDashboardAcl(&setDashAclCmd)
				So(err, ShouldBeNil)

				So(setDashAclCmd.Result.Id, ShouldEqual, 3)

				q1 := &m.GetDashboardAclInfoListQuery{DashboardId: savedFolder.Id, OrgId: 1}
				err = GetDashboardAclInfoList(q1)
				So(err, ShouldBeNil)

				So(q1.Result[0].DashboardId, ShouldEqual, savedFolder.Id)
				So(q1.Result[0].Permission, ShouldEqual, m.PERMISSION_EDIT)
				So(q1.Result[0].PermissionName, ShouldEqual, "Edit")
				So(q1.Result[0].UserId, ShouldEqual, currentUser.Id)
				So(q1.Result[0].UserLogin, ShouldEqual, currentUser.Login)
				So(q1.Result[0].UserEmail, ShouldEqual, currentUser.Email)
				So(q1.Result[0].Id, ShouldEqual, setDashAclCmd.Result.Id)

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
						Permission:  m.PERMISSION_ADMIN,
					})

					So(err, ShouldBeNil)

					q3 := &m.GetDashboardAclInfoListQuery{DashboardId: savedFolder.Id, OrgId: 1}
					err = GetDashboardAclInfoList(q3)
					So(err, ShouldBeNil)
					So(len(q3.Result), ShouldEqual, 1)
					So(q3.Result[0].DashboardId, ShouldEqual, savedFolder.Id)
					So(q3.Result[0].Permission, ShouldEqual, m.PERMISSION_ADMIN)
					So(q3.Result[0].UserId, ShouldEqual, 1)

				})

				Convey("Should be able to delete an existing permission", func() {
					err := RemoveDashboardAcl(&m.RemoveDashboardAclCommand{
						OrgId: 1,
						AclId: setDashAclCmd.Result.Id,
					})

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
					setDashAclCmd := m.SetDashboardAclCommand{
						OrgId:       1,
						TeamId:      group1.Result.Id,
						DashboardId: savedFolder.Id,
						Permission:  m.PERMISSION_EDIT,
					}

					err := SetDashboardAcl(&setDashAclCmd)
					So(err, ShouldBeNil)

					q1 := &m.GetDashboardAclInfoListQuery{DashboardId: savedFolder.Id, OrgId: 1}
					err = GetDashboardAclInfoList(q1)
					So(err, ShouldBeNil)
					So(q1.Result[0].DashboardId, ShouldEqual, savedFolder.Id)
					So(q1.Result[0].Permission, ShouldEqual, m.PERMISSION_EDIT)
					So(q1.Result[0].TeamId, ShouldEqual, group1.Result.Id)

					Convey("Should be able to delete an existing permission for a team", func() {
						err := RemoveDashboardAcl(&m.RemoveDashboardAclCommand{
							OrgId: 1,
							AclId: setDashAclCmd.Result.Id,
						})

						So(err, ShouldBeNil)
						q3 := &m.GetDashboardAclInfoListQuery{DashboardId: savedFolder.Id, OrgId: 1}
						err = GetDashboardAclInfoList(q3)
						So(err, ShouldBeNil)
						So(len(q3.Result), ShouldEqual, 0)
					})
				})

				Convey("Should be able to update an existing permission for a team", func() {
					err := SetDashboardAcl(&m.SetDashboardAclCommand{
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
	})
}
