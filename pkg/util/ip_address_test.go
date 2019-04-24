package util

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestParseIPAddress(t *testing.T) {
	Convey("Test parse ip address", t, func() {
		So(ParseIPAddress("192.168.0.140:456"), ShouldEqual, "192.168.0.140")
		So(ParseIPAddress("192.168.0.140"), ShouldEqual, "192.168.0.140")
		So(ParseIPAddress("[::1:456]"), ShouldEqual, "127.0.0.1")
		So(ParseIPAddress("[::1]"), ShouldEqual, "127.0.0.1")
		So(ParseIPAddress("::1"), ShouldEqual, "127.0.0.1")
		So(ParseIPAddress("::1:123"), ShouldEqual, "127.0.0.1")
	})
}

func TestSplitHostPortDefault(t *testing.T) {
	Convey("Test split ip address to host and port", t, func() {
		host, port := SplitHostPortDefault("192.168.0.140:456", "", "")
		So(host, ShouldEqual, "192.168.0.140")
		So(port, ShouldEqual, "456")

		host, port = SplitHostPortDefault("192.168.0.140", "", "123")
		So(host, ShouldEqual, "192.168.0.140")
		So(port, ShouldEqual, "123")

		host, port = SplitHostPortDefault("[::1:456]", "", "")
		So(host, ShouldEqual, "::1")
		So(port, ShouldEqual, "456")

		host, port = SplitHostPortDefault("[::1]", "", "123")
		So(host, ShouldEqual, "::1")
		So(port, ShouldEqual, "123")

		host, port = SplitHostPortDefault("::1:123", "", "")
		So(host, ShouldEqual, "::1")
		So(port, ShouldEqual, "123")

		host, port = SplitHostPortDefault("::1", "", "123")
		So(host, ShouldEqual, "::1")
		So(port, ShouldEqual, "123")

		host, port = SplitHostPortDefault(":456", "1.2.3.4", "")
		So(host, ShouldEqual, "1.2.3.4")
		So(port, ShouldEqual, "456")

		host, port = SplitHostPortDefault("xyz.rds.amazonaws.com", "", "123")
		So(host, ShouldEqual, "xyz.rds.amazonaws.com")
		So(port, ShouldEqual, "123")

		host, port = SplitHostPortDefault("xyz.rds.amazonaws.com:123", "", "")
		So(host, ShouldEqual, "xyz.rds.amazonaws.com")
		So(port, ShouldEqual, "123")
	})
}

func TestSplitHostPort(t *testing.T) {
	Convey("Test split ip address to host and port", t, func() {
		host, port := SplitHostPort("192.168.0.140:456")
		So(host, ShouldEqual, "192.168.0.140")
		So(port, ShouldEqual, "456")

		host, port = SplitHostPort("192.168.0.140")
		So(host, ShouldEqual, "192.168.0.140")
		So(port, ShouldEqual, "")

		host, port = SplitHostPort("[::1:456]")
		So(host, ShouldEqual, "::1")
		So(port, ShouldEqual, "456")

		host, port = SplitHostPort("[::1]")
		So(host, ShouldEqual, "::1")
		So(port, ShouldEqual, "")

		host, port = SplitHostPort("::1:123")
		So(host, ShouldEqual, "::1")
		So(port, ShouldEqual, "123")

		host, port = SplitHostPort("::1")
		So(host, ShouldEqual, "::1")
		So(port, ShouldEqual, "")

		host, port = SplitHostPort(":456")
		So(host, ShouldEqual, "")
		So(port, ShouldEqual, "456")

		host, port = SplitHostPort("xyz.rds.amazonaws.com")
		So(host, ShouldEqual, "xyz.rds.amazonaws.com")
		So(port, ShouldEqual, "")

		host, port = SplitHostPort("xyz.rds.amazonaws.com:123")
		So(host, ShouldEqual, "xyz.rds.amazonaws.com")
		So(port, ShouldEqual, "123")
	})
}
