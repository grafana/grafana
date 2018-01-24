package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestMatrixNotifier(t *testing.T) {
	Convey("Matrix notifier tests", t, func() {

		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "matrix_testing",
					Type:     "matrix",
					Settings: settingsJSON,
				}

				_, err := NewMatrixNotifier(model)
				So(err, ShouldNotBeNil)
			})

			Convey("from settings", func() {
				json := `
				{
          "url": "http://google.com"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "matrix_testing",
					Type:     "matrix",
					Settings: settingsJSON,
				}

				not, err := NewMatrixNotifier(model)
				matrixNotifier := not.(*MatrixNotifier)

				So(err, ShouldBeNil)
				So(matrixNotifier.Name, ShouldEqual, "matrix_testing")
				So(matrixNotifier.Type, ShouldEqual, "matrix")
				So(matrixNotifier.Url, ShouldEqual, "http://google.com")
			})
		})
	})
}
