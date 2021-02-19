package pluginproxy

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestInterpolateString(t *testing.T) {
	Convey("When interpolating string", t, func() {
		data := templateData{
			SecureJsonData: map[string]string{
				"Test": "0asd+asd",
			},
		}

		interpolated, err := InterpolateString("{{.SecureJsonData.Test}}", data)
		So(err, ShouldBeNil)
		So(interpolated, ShouldEqual, "0asd+asd")
	})
}
