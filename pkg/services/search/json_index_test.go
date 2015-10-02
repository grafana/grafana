package search

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestJsonDashIndex(t *testing.T) {

	Convey("Given the json dash index", t, func() {
		index := NewJsonDashIndex("../../../public/dashboards/")

		Convey("Should be able to update index", func() {
			err := index.updateIndex()
			So(err, ShouldBeNil)
		})

		Convey("Should be able to search index", func() {
			res, err := index.Search(&Query{Title: "", Limit: 20})
			So(err, ShouldBeNil)

			So(len(res), ShouldEqual, 3)
		})

		Convey("Should be able to search index by title", func() {
			res, err := index.Search(&Query{Title: "home", Limit: 20})
			So(err, ShouldBeNil)

			So(len(res), ShouldEqual, 1)
			So(res[0].Title, ShouldEqual, "Home")
		})

		Convey("Should not return when starred is filtered", func() {
			res, err := index.Search(&Query{Title: "", IsStarred: true})
			So(err, ShouldBeNil)

			So(len(res), ShouldEqual, 0)
		})

	})
}
