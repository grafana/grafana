package sqlstore

import (
	"testing"

	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestGuardianAccess(t *testing.T) {

	Convey("Testing DB", t, func() {
		InitTestDB(t)

		Convey("Given one dashboard folder with two dashboard and one dashboard in the root folder", func() {
			folder := insertTestDashboard("1 test dash folder", 1, 0, true, "prod", "webapp")
			// dashInFolder1 := insertTestDashboard("test dash 23", 1, folder.Id, false, "prod", "webapp")
			// dashInFolder2 := insertTestDashboard("test dash 45", 1, folder.Id, false, "prod")
			dashInRoot := insertTestDashboard("test dash 67", 1, 0, false, "prod", "webapp")

			Convey("and no acls are set", func() {
				Convey("should return all dashboards", func() {
					query := &m.GetAllowedDashboardsQuery{UserId: 1, OrgId: 1, DashList: []int64{folder.Id, dashInRoot.Id}}
					err := GetAllowedDashboards(query)
					So(err, ShouldBeNil)
					So(query.Result[0], ShouldEqual, folder.Id)
					So(query.Result[1], ShouldEqual, dashInRoot.Id)
				})
			})
		})
	})
}
