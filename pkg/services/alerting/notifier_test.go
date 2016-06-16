package alerting

import (
	"testing"

	"reflect"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestAlertNotificationExtraction(t *testing.T) {

	Convey("Parsing alert notification from settings", t, func() {
		Convey("Parsing email", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "ops",
					Type:     "email",
					Settings: settingsJSON,
				}

				_, err := NewNotificationFromDBModel(model)
				So(err, ShouldNotBeNil)
			})

			Convey("from settings", func() {
				json := `
				{
					"to": "ops@grafana.org"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "ops",
					Type:     "email",
					Settings: settingsJSON,
				}

				not, err := NewNotificationFromDBModel(model)

				So(err, ShouldBeNil)
				So(not.Name, ShouldEqual, "ops")
				So(not.Type, ShouldEqual, "email")
				So(reflect.TypeOf(not.Notifierr).Elem().String(), ShouldEqual, "alerting.EmailNotifier")

				email := not.Notifierr.(*EmailNotifier)
				So(email.To, ShouldEqual, "ops@grafana.org")
			})
		})

		Convey("Parsing webhook", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "ops",
					Type:     "webhook",
					Settings: settingsJSON,
				}

				_, err := NewNotificationFromDBModel(model)
				So(err, ShouldNotBeNil)
			})

			Convey("from settings", func() {
				json := `
				{
					"url": "http://localhost:3000",
					"username": "username",
					"password": "password"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "slack",
					Type:     "webhook",
					Settings: settingsJSON,
				}

				not, err := NewNotificationFromDBModel(model)

				So(err, ShouldBeNil)
				So(not.Name, ShouldEqual, "slack")
				So(not.Type, ShouldEqual, "webhook")
				So(reflect.TypeOf(not.Notifierr).Elem().String(), ShouldEqual, "alerting.WebhookNotifier")

				webhook := not.Notifierr.(*WebhookNotifier)
				So(webhook.Url, ShouldEqual, "http://localhost:3000")
			})
		})

	})
}
