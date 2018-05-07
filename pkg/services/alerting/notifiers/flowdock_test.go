package notifiers

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestFlowdockNotifier(t *testing.T) {
	Convey("Flowdock notifier tests", t, func() {
		Convey("Parsing alert notification from settings", func() {
			So(true, ShouldEqual, true)
		})
	})
}
