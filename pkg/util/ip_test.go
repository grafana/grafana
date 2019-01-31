package util

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestSplitIPPort(t *testing.T) {

	Convey("When parsing an IPv4 without explicit port", t, func() {
		ip, port, err := SplitIPPort("1.2.3.4", "5678")

		So(err, ShouldEqual, nil)
		So(ip, ShouldEqual, "1.2.3.4")
		So(port, ShouldEqual, "5678")
	})

	Convey("When parsing an IPv6 without explicit port", t, func() {
		ip, port, err := SplitIPPort("::1", "5678")

		So(err, ShouldEqual, nil)
		So(ip, ShouldEqual, "::1")
		So(port, ShouldEqual, "5678")
	})

	Convey("When parsing an IPv4 with explicit port", t, func() {
		ip, port, err := SplitIPPort("1.2.3.4:56", "78")

		So(err, ShouldEqual, nil)
		So(ip, ShouldEqual, "1.2.3.4")
		So(port, ShouldEqual, "56")
	})

	Convey("When parsing an IPv6 with explicit port", t, func() {
		ip, port, err := SplitIPPort("[::1]:56", "78")

		So(err, ShouldEqual, nil)
		So(ip, ShouldEqual, "::1")
		So(port, ShouldEqual, "56")
	})

}
