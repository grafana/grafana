package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestHipChatNotifier(t *testing.T) {
	Convey("HipChat notifier tests", t, func() {

		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "ops",
					Type:     "hipchat",
					Settings: settingsJSON,
				}

				_, err := NewHipChatNotifier(model)
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
					Type:     "hipchat",
					Settings: settingsJSON,
				}

				not, err := NewHipChatNotifier(model)
				hipchatNotifier := not.(*HipChatNotifier)

				So(err, ShouldBeNil)
				So(hipchatNotifier.Name, ShouldEqual, "ops")
				So(hipchatNotifier.Type, ShouldEqual, "hipchat")
				So(hipchatNotifier.Url, ShouldEqual, "http://google.com")
				So(hipchatNotifier.ApiKey, ShouldEqual, "")
				So(hipchatNotifier.RoomId, ShouldEqual, "")
			})

			Convey("from settings with Recipient and Mention", func() {
				json := `
				{
          "url": "http://www.hipchat.com",
          "apikey": "1234",
          "roomid": "1234"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "ops",
					Type:     "hipchat",
					Settings: settingsJSON,
				}

				not, err := NewHipChatNotifier(model)
				hipchatNotifier := not.(*HipChatNotifier)

				So(err, ShouldBeNil)
				So(hipchatNotifier.Name, ShouldEqual, "ops")
				So(hipchatNotifier.Type, ShouldEqual, "hipchat")
				So(hipchatNotifier.Url, ShouldEqual, "http://www.hipchat.com")
				So(hipchatNotifier.ApiKey, ShouldEqual, "1234")
				So(hipchatNotifier.RoomId, ShouldEqual, "1234")
			})

		})
	})
}
