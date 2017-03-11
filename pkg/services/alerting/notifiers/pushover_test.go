package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestPushoverNotifier(t *testing.T) {
	Convey("Pushover notifier tests", t, func() {

		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "Pushover",
					Type:     "pushover",
					Settings: settingsJSON,
				}

				_, err := NewPushoverNotifier(model)
				So(err, ShouldNotBeNil)
			})

			Convey("from settings", func() {
				json := `
				{
					"apiToken": "4SrUFQL4A5V5TQ1z5Pg9nxHXPXSTve",
					"userKey": "tzNZYf36y0ohWwXo4XoUrB61rz1A4o",
					"priority": "1",
					"sound": "pushover"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "Pushover",
					Type:     "pushover",
					Settings: settingsJSON,
				}

				not, err := NewPushoverNotifier(model)
				pushoverNotifier := not.(*PushoverNotifier)

				So(err, ShouldBeNil)
				So(pushoverNotifier.Name, ShouldEqual, "Pushover")
				So(pushoverNotifier.Type, ShouldEqual, "pushover")
				So(pushoverNotifier.ApiToken, ShouldEqual, "4SrUFQL4A5V5TQ1z5Pg9nxHXPXSTve")
				So(pushoverNotifier.UserKey, ShouldEqual, "tzNZYf36y0ohWwXo4XoUrB61rz1A4o")
				So(pushoverNotifier.Priority, ShouldEqual, 1)
				So(pushoverNotifier.Sound, ShouldEqual, "pushover")
			})
		})
	})
}
