package util

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestEncoding(t *testing.T) {

	Convey("When generating base64 header", t, func() {
		result := GetBasicAuthHeader("grafana", "1234")

		So(result, ShouldEqual, "Basic Z3JhZmFuYToxMjM0")
	})

	Convey("When decoding basic auth header", t, func() {
		header := GetBasicAuthHeader("grafana", "1234")
		username, password, err := DecodeBasicAuthHeader(header)
		So(err, ShouldBeNil)

		So(username, ShouldEqual, "grafana")
		So(password, ShouldEqual, "1234")
	})

}
