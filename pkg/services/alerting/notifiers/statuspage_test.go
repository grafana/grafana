package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestStatusPageNotifier(t *testing.T) {
	Convey("StatusPage notifier tests", t, func() {

		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "statuspage_testing",
					Type:     "statuspage",
					Settings: settingsJSON,
				}

				_, err := NewStatusPageNotifier(model)
				So(err, ShouldNotBeNil)
			})

			Convey("settings should trigger incident", func() {
				json := `
				{
          "apiKey": "abcdefgh0123456789",
          "pageId": "1234",
          "componentId": "4567"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "statuspage_testing",
					Type:     "statuspage",
					Settings: settingsJSON,
				}

				not, err := NewStatusPageNotifier(model)
				statuspageNotifier := not.(*StatusPageNotifier)

				So(err, ShouldBeNil)
				So(statuspageNotifier.Name, ShouldEqual, "statuspage_testing")
				So(statuspageNotifier.Type, ShouldEqual, "statuspage")
				So(statuspageNotifier.APIKey, ShouldEqual, "abcdefgh0123456789")
				So(statuspageNotifier.PageID, ShouldEqual, "1234")
				So(statuspageNotifier.ComponentID, ShouldEqual, "4567")
				So(statuspageNotifier.Status, ShouldEqual, "major_outage")
			})
		})
	})
}
