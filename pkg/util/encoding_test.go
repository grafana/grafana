package util

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestEncoding(t *testing.T) {

	Convey("When generating base64 header", t, func() {
		result := GetBasicAuthHeader("grafana", "1234")

		So(result, ShouldEqual, "Z3JhZmFuYToxMjM0")
	})
}
