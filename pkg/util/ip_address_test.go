package util

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
	"golang.org/x/xerrors"
)

func TestParseIPAddress(t *testing.T) {
	Convey("Test parse ip address", t, func() {
		addr, err := ParseIPAddress("192.168.0.140:456")
		So(err, ShouldBeNil)
		So(addr, ShouldEqual, "192.168.0.140")

		addr, err = ParseIPAddress("192.168.0.140")
		So(err, ShouldBeNil)
		So(addr, ShouldEqual, "192.168.0.140")

		addr, err = ParseIPAddress("[::1]:456")
		So(err, ShouldBeNil)
		So(addr, ShouldEqual, "::1")

		addr, err = ParseIPAddress("[::1]")
		So(err, ShouldBeNil)
		So(addr, ShouldEqual, "::1")
	})

	Convey("Invalid address", t, func() {
		_, err := ParseIPAddress("[::1")
		So(err, ShouldBeError, xerrors.Errorf(
			"Failed to split network address '[::1' by host and port: Malformed IPv6 address: '[::1'"))

		_, err = ParseIPAddress("::1]")
		So(err, ShouldBeError, xerrors.Errorf(
			"Failed to split network address '::1]' by host and port: net.SplitHostPort failed for '::1]': address ::1]: too many colons in address"))

		_, err = ParseIPAddress("")
		So(err, ShouldBeError, xerrors.Errorf(
			"Failed to split network address '' by host and port: Input is empty"))
	})

	Convey("Loopback address", t, func() {
		addr, err := ParseIPAddress("127.0.0.1")
		So(err, ShouldBeNil)
		So(addr, ShouldEqual, "127.0.0.1")

		addr, err = ParseIPAddress("[::1]")
		So(err, ShouldBeNil)
		So(addr, ShouldEqual, "::1")
	})
}

func TestSplitHostPortDefault(t *testing.T) {
	Convey("Test split ip address to host and port", t, func() {
		addr, err := SplitHostPortDefault("192.168.0.140:456", "", "")
		So(err, ShouldBeNil)
		So(addr.Host, ShouldEqual, "192.168.0.140")
		So(addr.Port, ShouldEqual, "456")

		addr, err = SplitHostPortDefault("192.168.0.140", "", "123")
		So(err, ShouldBeNil)
		So(addr.Host, ShouldEqual, "192.168.0.140")
		So(addr.Port, ShouldEqual, "123")

		addr, err = SplitHostPortDefault("[::1]:456", "", "")
		So(err, ShouldBeNil)
		So(addr.Host, ShouldEqual, "::1")
		So(addr.Port, ShouldEqual, "456")

		addr, err = SplitHostPortDefault("[::1]", "", "123")
		So(err, ShouldBeNil)
		So(addr.Host, ShouldEqual, "::1")
		So(addr.Port, ShouldEqual, "123")

		addr, err = SplitHostPortDefault(":456", "1.2.3.4", "")
		So(err, ShouldBeNil)
		So(addr.Host, ShouldEqual, "1.2.3.4")
		So(addr.Port, ShouldEqual, "456")

		addr, err = SplitHostPortDefault("xyz.rds.amazonaws.com", "", "123")
		So(err, ShouldBeNil)
		So(addr.Host, ShouldEqual, "xyz.rds.amazonaws.com")
		So(addr.Port, ShouldEqual, "123")

		addr, err = SplitHostPortDefault("xyz.rds.amazonaws.com:123", "", "")
		So(err, ShouldBeNil)
		So(addr.Host, ShouldEqual, "xyz.rds.amazonaws.com")
		So(addr.Port, ShouldEqual, "123")

		addr, err = SplitHostPortDefault("", "localhost", "1433")
		So(err, ShouldBeNil)
		So(addr.Host, ShouldEqual, "localhost")
		So(addr.Port, ShouldEqual, "1433")
	})
}

func TestSplitHostPort(t *testing.T) {
	Convey("Test split ip address to host and port", t, func() {
		addr, err := SplitHostPort("192.168.0.140:456")
		So(err, ShouldBeNil)
		So(addr.Host, ShouldEqual, "192.168.0.140")
		So(addr.Port, ShouldEqual, "456")

		addr, err = SplitHostPort("192.168.0.140")
		So(err, ShouldBeNil)
		So(addr.Host, ShouldEqual, "192.168.0.140")
		So(addr.Port, ShouldEqual, "")

		addr, err = SplitHostPort("[::1]:456")
		So(err, ShouldBeNil)
		So(addr.Host, ShouldEqual, "::1")
		So(addr.Port, ShouldEqual, "456")

		addr, err = SplitHostPort("[::1]")
		So(err, ShouldBeNil)
		So(addr.Host, ShouldEqual, "::1")
		So(addr.Port, ShouldEqual, "")

		addr, err = SplitHostPort(":456")
		So(err, ShouldBeNil)
		So(addr.Host, ShouldEqual, "")
		So(addr.Port, ShouldEqual, "456")

		addr, err = SplitHostPort("xyz.rds.amazonaws.com")
		So(err, ShouldBeNil)
		So(addr.Host, ShouldEqual, "xyz.rds.amazonaws.com")
		So(addr.Port, ShouldEqual, "")

		addr, err = SplitHostPort("xyz.rds.amazonaws.com:123")
		So(err, ShouldBeNil)
		So(addr.Host, ShouldEqual, "xyz.rds.amazonaws.com")
		So(addr.Port, ShouldEqual, "123")
	})
}
