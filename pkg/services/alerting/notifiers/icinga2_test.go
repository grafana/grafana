package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestIcinga2Notifier(t *testing.T) {
	Convey("Icinga2 notifier tests", t, func() {

		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "ops",
					Type:     "icinga2",
					Settings: settingsJSON,
				}

				_, err := NewIcinga2Notifier(model)
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
					Type:     "icinga2",
					Settings: settingsJSON,
				}

				not, err := NewIcinga2Notifier(model)
				icinga2Notifier := not.(*Icinga2Notifier)

				So(err, ShouldBeNil)
				So(icinga2Notifier.Name, ShouldEqual, "ops")
				So(icinga2Notifier.Type, ShouldEqual, "icinga2")
				So(icinga2Notifier.Url, ShouldEqual, "http://google.com")
				So(icinga2Notifier.HostName, ShouldEqual, "")
				So(icinga2Notifier.User, ShouldEqual, "")
				So(icinga2Notifier.Password, ShouldEqual, "")
				So(icinga2Notifier.ServiceName, ShouldEqual, "")
			})

			Convey("from settings with Recipient, Username, IconEmoji, IconUrl, Mention, and Token", func() {
				json := `
				{
          "url": "http://google.com",
          "username": "Grafana Alerts",
          "Password": "123456",
          "HostName": "Dummy",
          "ServiceName": "Service1",
          "token": "xoxb-XXXXXXXX-XXXXXXXX-XXXXXXXXXX"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "ops",
					Type:     "icinga2",
					Settings: settingsJSON,
				}

				not, err := NewIcinga2Notifier(model)
				icinga2Notifier := not.(*Icinga2Notifier)

				So(err, ShouldBeNil)
				So(icinga2Notifier.Name, ShouldEqual, "ops")
				So(icinga2Notifier.Type, ShouldEqual, "icinga2")
				So(icinga2Notifier.Url, ShouldEqual, "http://google.com")
				So(icinga2Notifier.User, ShouldEqual, "Grafana Alerts")
				So(icinga2Notifier.Password, ShouldEqual, "xxxxx")
				So(icinga2Notifier.HostName, ShouldEqual, "Dummy")
				So(icinga2Notifier.ServiceName, ShouldEqual, "Service1")
			})
		})
	})
}
