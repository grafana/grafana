package sqlstore

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	m "github.com/torkelo/grafana-pro/pkg/models"
)

func TestDashboardDataAccess(t *testing.T) {

	Convey("Testing DB", t, func() {
		InitTestDB(t)

		Convey("Given saved dashboard", func() {
			var savedDash *m.Dashboard

			cmd := m.SaveDashboardCommand{
				AccountId: 1,
				Dashboard: map[string]interface{}{
					"id":    nil,
					"title": "test dash 23",
					"tags":  make([]interface{}, 0),
				},
			}

			err := SaveDashboard(&cmd)
			So(err, ShouldBeNil)

			savedDash = cmd.Result

			Convey("Should return dashboard model", func() {
				So(savedDash.Title, ShouldEqual, "test dash 23")
				So(savedDash.Slug, ShouldEqual, "test-dash-23")
				So(savedDash.Id, ShouldNotEqual, 0)
			})

			Convey("Should be able to get dashboard", func() {
				query := m.GetDashboardQuery{
					Slug:      "test-dash-23",
					AccountId: 1,
				}

				err := GetDashboard(&query)
				So(err, ShouldBeNil)

				So(query.Result.Title, ShouldEqual, "test dash 23")
				So(query.Result.Slug, ShouldEqual, "test-dash-23")
			})

			Convey("Should not be able to save dashboard with same name", func() {
				cmd := m.SaveDashboardCommand{
					AccountId: 1,
					Dashboard: map[string]interface{}{
						"id":    nil,
						"title": "test dash 23",
						"tags":  make([]interface{}, 0),
					},
				}

				err := SaveDashboard(&cmd)
				So(err, ShouldNotBeNil)
			})

		})

	})

}
