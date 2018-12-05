package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestHangoutsChatNotifier(t *testing.T) {
	Convey("Hangouts Chat notifier tests", t, func() {

		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "ops",
					Type:     "hangoutschat",
					Settings: settingsJSON,
				}

				_, err := NewHangoutsChatNotifier(model)
				So(err, ShouldNotBeNil)
			})

			Convey("from settings", func() {
				json := `
				{
          "url": "http://google.com"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "ops",
					Type:     "hangoutschat",
					Settings: settingsJSON,
				}

				not, err := NewHangoutsChatNotifier(model)
				notifier := not.(*HangoutsChatNotifier)

				So(err, ShouldBeNil)
				So(notifier.Name, ShouldEqual, "ops")
				So(notifier.Type, ShouldEqual, "hangoutschat")
				So(notifier.Url, ShouldEqual, "http://google.com")
			})
		})
	})
}
