package sqlstore

import (
	"testing"

	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestGuardianDataAccess(t *testing.T) {

	Convey("Testing DB", t, func() {
		InitTestDB(t)

		Convey("Given one dashboard folder with two dashboard and one dashboard in the root folder", func() {
			folder := insertTestDashboard("1 test dash folder", 1, 0, true, "prod", "webapp")
			dashInRoot := insertTestDashboard("test dash 67", 1, 0, false, "prod", "webapp")
			insertTestDashboard("test dash 23", 1, folder.Id, false, "prod", "webapp")
			insertTestDashboard("test dash 45", 1, folder.Id, false, "prod")

			currentUser := createUser("viewer", "Viewer", false)

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
				var otherUser int64 = 999
				updateTestDashboardWithAcl(folder.Id, otherUser, m.PERMISSION_EDIT)

				Convey("should not return folder", func() {
					query := &m.GetAllowedDashboardsQuery{UserId: currentUser.Id, OrgId: 1, DashList: []int64{folder.Id, dashInRoot.Id}}
					err := GetAllowedDashboards(query)
					So(err, ShouldBeNil)
					So(len(query.Result), ShouldEqual, 1)
					So(query.Result[0], ShouldEqual, dashInRoot.Id)
				})

				Convey("when the user is given permission", func() {
					updateTestDashboardWithAcl(folder.Id, currentUser.Id, m.PERMISSION_EDIT)

					Convey("should folder", func() {
						query := &m.GetAllowedDashboardsQuery{UserId: currentUser.Id, OrgId: 1, DashList: []int64{folder.Id, dashInRoot.Id}}
						err := GetAllowedDashboards(query)
						So(err, ShouldBeNil)
						So(len(query.Result), ShouldEqual, 2)
						So(query.Result[0], ShouldEqual, folder.Id)
						So(query.Result[1], ShouldEqual, dashInRoot.Id)
					})
				})
			})
		})
	})
}
