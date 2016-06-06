package util

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestStringsUtil(t *testing.T) {
	Convey("Falling back until none empty string", t, func() {
		So(StringsFallback2("1", "2"), ShouldEqual, "1")
		So(StringsFallback2("", "2"), ShouldEqual, "2")
		So(StringsFallback3("", "", "3"), ShouldEqual, "3")
	})
}
