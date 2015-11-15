package sqlstore

import (
	"testing"

	m "github.com/wangy1931/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestUserStarsDataAccess(t *testing.T) {

	Convey("Testing User Stars Data Access", t, func() {
		InitTestDB(t)

		Convey("Given saved star", func() {
			cmd := m.StarDashboardCommand{
				DashboardId: 10,
				UserId:      12,
			}

			err := StarDashboard(&cmd)
			So(err, ShouldBeNil)

			Convey("IsStarredByUser should return true when starred", func() {
				query := m.IsStarredByUserQuery{UserId: 12, DashboardId: 10}
				err := IsStarredByUser(&query)
				So(err, ShouldBeNil)

				So(query.Result, ShouldBeTrue)
			})

			Convey("IsStarredByUser should return false when not starred", func() {
				query := m.IsStarredByUserQuery{UserId: 12, DashboardId: 12}
				err := IsStarredByUser(&query)
				So(err, ShouldBeNil)

				So(query.Result, ShouldBeFalse)
			})

		})
	})
}
