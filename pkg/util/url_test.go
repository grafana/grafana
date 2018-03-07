package util

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestUrl(t *testing.T) {

	Convey("When joining two urls where right hand side is empty", t, func() {
		result := JoinUrlFragments("http://localhost:8080", "")

		So(result, ShouldEqual, "http://localhost:8080")
	})

	Convey("When joining two urls where right hand side is empty and lefthand side has a trailing slash", t, func() {
		result := JoinUrlFragments("http://localhost:8080/", "")

		So(result, ShouldEqual, "http://localhost:8080/")
	})

	Convey("When joining two urls where neither has a trailing slash", t, func() {
		result := JoinUrlFragments("http://localhost:8080", "api")

		So(result, ShouldEqual, "http://localhost:8080/api")
	})

	Convey("When joining two urls where lefthand side has a trailing slash", t, func() {
		result := JoinUrlFragments("http://localhost:8080/", "api")

		So(result, ShouldEqual, "http://localhost:8080/api")
	})

	Convey("When joining two urls where righthand side has preceding slash", t, func() {
		result := JoinUrlFragments("http://localhost:8080", "/api")

		So(result, ShouldEqual, "http://localhost:8080/api")
	})

	Convey("When joining two urls where righthand side has trailing slash", t, func() {
		result := JoinUrlFragments("http://localhost:8080", "api/")

		So(result, ShouldEqual, "http://localhost:8080/api/")
	})
}
