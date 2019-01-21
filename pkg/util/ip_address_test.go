package util

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestParseIPAddress(t *testing.T) {
	Convey("Test parse ip address", t, func() {
		So(ParseIPAddress("192.168.0.140:456"), ShouldEqual, "192.168.0.140")
		So(ParseIPAddress("[::1:456]"), ShouldEqual, "127.0.0.1")
		So(ParseIPAddress("[::1]"), ShouldEqual, "127.0.0.1")
		So(ParseIPAddress("192.168.0.140"), ShouldEqual, "192.168.0.140")
	})
}
