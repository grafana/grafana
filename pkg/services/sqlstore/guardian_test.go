package sqlstore

import (
	"testing"

	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestGuardianDataAccess(t *testing.T) {

	Convey("Testing DB", t, func() {
		InitTestDB(t)

		Convey("Given one dashboard folder with two dashboard and one dashboard in the root folder", func() {
			folder := insertTestDashboard("1 test dash folder", 1, 0, true, "prod", "webapp")
			// insertTestDashboard("test dash 23", 1, folder.Id, false, "prod", "webapp")
			// insertTestDashboard("test dash 45", 1, folder.Id, false, "prod")
			dashInRoot := insertTestDashboard("test dash 67", 1, 0, false, "prod", "webapp")

			currentUser := createUser("viewer")

			Convey("and no acls are set", func() {
				Convey("should return all dashboards", func() {
					query := &m.GetAllowedDashboardsQuery{UserId: currentUser.Id, OrgId: 1, DashList: []int64{folder.Id, dashInRoot.Id}}
					err := GetAllowedDashboards(query)
					So(err, ShouldBeNil)
					So(len(query.Result), ShouldEqual, 2)
					So(query.Result[0], ShouldEqual, folder.Id)
					So(query.Result[1], ShouldEqual, dashInRoot.Id)
				})
			})

			Convey("and acl is set for dashboard folder", func() {
				Convey("should not return folder", func() {
					var otherUser int64 = 999
					updateTestDashboardWithAcl(folder.Id, otherUser, m.PERMISSION_EDIT)

					query := &m.GetAllowedDashboardsQuery{UserId: currentUser.Id, OrgId: 1, DashList: []int64{folder.Id, dashInRoot.Id}}
					err := GetAllowedDashboards(query)
					So(err, ShouldBeNil)
					So(len(query.Result), ShouldEqual, 1)
					So(query.Result[0], ShouldEqual, dashInRoot.Id)
				})
			})
		})
	})
}

func createUser(name string) m.User {
	setting.AutoAssignOrg = true
	setting.AutoAssignOrgRole = "Viewer"

	currentUserCmd := m.CreateUserCommand{Login: name, Email: name + "@test.com", Name: "a " + name, IsAdmin: false}
	err := CreateUser(&currentUserCmd)
	So(err, ShouldBeNil)

	q1 := m.GetUserOrgListQuery{UserId: currentUserCmd.Result.Id}
	GetUserOrgList(&q1)
	So(q1.Result[0].Role, ShouldEqual, "Viewer")

	return currentUserCmd.Result
}

func updateTestDashboardWithAcl(dashId int64, userId int64, permissionType m.PermissionType) {
	err := AddOrUpdateDashboardPermission(&m.AddOrUpdateDashboardPermissionCommand{
		OrgId:          1,
		UserId:         userId,
		DashboardId:    dashId,
		PermissionType: permissionType,
	})
	So(err, ShouldBeNil)
}
