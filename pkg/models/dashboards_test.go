package models

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestDashboardModel(t *testing.T) {

	Convey("When generating slug", t, func() {
		dashboard := NewDashboard("Grafana Play Home")
		dashboard.UpdateSlug()

		So(dashboard.Slug, ShouldEqual, "grafana-play-home")
	})

	Convey("Given a dashboard json", t, func() {
		json := map[string]interface{}{
			"title": "test dash",
		}

		Convey("With tags as string value", func() {
			json["tags"] = ""
			dash := NewDashboardFromJson(json)

			So(len(dash.GetTags()), ShouldEqual, 0)
		})
	})

}
