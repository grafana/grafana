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

}
