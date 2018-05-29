package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
 	"github.com/grafana/grafana/pkg/services/alerting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestBMSNotifier(t *testing.T) {
	Convey("BMS notifier tests", t, func() {

		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "bms_testing",
					Type:     "bms",
					Settings: settingsJSON,
				}

				_, err := NewBMSNotifier(model)
				So(err, ShouldNotBeNil)
			})

			Convey("from settings", func() {
				json := `
				{
          "alphaname": "http://TESTAI"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "bms_testing",
					Type:     "bms",
					Settings: settingsJSON,
				}

				not, err := NewBMSNotifier(model)
				bmsNotifier := not.(*BMSNotifier)

				So(err, ShouldBeNil)
				So(bmsNotifier.Name, ShouldEqual, "bms_testing")
				So(bmsNotifier.Type, ShouldEqual, "bms")
				So(bmsNotifier.URL, ShouldEqual, "TESTAI")
			})
		})
	})
}
