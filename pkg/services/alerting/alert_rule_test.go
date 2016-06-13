package alerting

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestAlertRuleModel(t *testing.T) {
	Convey("Testing alert rule", t, func() {

		Convey("Can parse seconds", func() {
			seconds := getTimeDurationStringToSeconds("10s")
			So(seconds, ShouldEqual, 10)
		})

		Convey("Can parse minutes", func() {
			seconds := getTimeDurationStringToSeconds("10m")
			So(seconds, ShouldEqual, 600)
		})

		Convey("Can parse hours", func() {
			seconds := getTimeDurationStringToSeconds("1h")
			So(seconds, ShouldEqual, 3600)
		})

		Convey("defaults to seconds", func() {
			seconds := getTimeDurationStringToSeconds("1o")
			So(seconds, ShouldEqual, 1)
		})
	})
}
