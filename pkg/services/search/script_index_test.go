package search

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestScriptIndex(t *testing.T) {

	Convey("Given the json dash index", t, func() {
		index := NewDashboardScriptIndex("../../../public/dashboards/")

		Convey("Should be able to update index", func() {
			err := index.updateIndex()
			So(err, ShouldBeNil)
		})

		Convey("Should get a script by its name", func() {
			res := index.GetScript("scripted.js")
			So(res, ShouldNotBeNil)

			So(res.Name, ShouldEqual, "scripted.js")
			So(res.Path, ShouldEqual, "../../../public/dashboards/scripted.js")
		})

	})
}
