package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestVictoropsNotifier(t *testing.T) {
	Convey("Victorops notifier tests", t, func() {
		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "victorops_testing",
					Type:     "victorops",
					Settings: settingsJSON,
				}

				_, err := NewVictoropsNotifier(model)
				So(err, ShouldNotBeNil)
			})

			Convey("from settings", func() {
				json := `
				{
          "url": "http://google.com"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "victorops_testing",
					Type:     "victorops",
					Settings: settingsJSON,
				}

				not, err := NewVictoropsNotifier(model)
				victoropsNotifier := not.(*VictoropsNotifier)

				So(err, ShouldBeNil)
				So(victoropsNotifier.Name, ShouldEqual, "victorops_testing")
				So(victoropsNotifier.Type, ShouldEqual, "victorops")
				So(victoropsNotifier.URL, ShouldEqual, "http://google.com")
			})
		})
	})
}
