package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestLineNotifier(t *testing.T) {
	Convey("Line notifier tests", t, func() {
		Convey("empty settings should return error", func() {
			json := `{ }`

			settingsJSON, _ := simplejson.NewJson([]byte(json))
			model := &models.AlertNotification{
				Name:     "line_testing",
				Type:     "line",
				Settings: settingsJSON,
			}

			_, err := NewLINENotifier(model)
			So(err, ShouldNotBeNil)

		})
		Convey("settings should trigger incident", func() {
			json := `
			{
  "token": "abcdefgh0123456789"
			}`
			settingsJSON, _ := simplejson.NewJson([]byte(json))
			model := &models.AlertNotification{
				Name:     "line_testing",
				Type:     "line",
				Settings: settingsJSON,
			}

			not, err := NewLINENotifier(model)
			lineNotifier := not.(*LineNotifier)

			So(err, ShouldBeNil)
			So(lineNotifier.Name, ShouldEqual, "line_testing")
			So(lineNotifier.Type, ShouldEqual, "line")
			So(lineNotifier.Token, ShouldEqual, "abcdefgh0123456789")
		})
	})
}
