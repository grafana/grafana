package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestOneSignalNotifier(t *testing.T) {
	Convey("onesignal notifier tests", t, func() {

		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name: "onesignal",
					Type: "onesignal",

					Settings: settingsJSON,
				}

				_, err := NewOneSignalNotifier(model)
				So(err, ShouldNotBeNil)
			})

			Convey("from settings", func() {
				json := `
				{
					"url": "https://onesignal.com/api/v1/notifications",
					"source": "grafana_instance_01",
					"appId": "7cc8e60c",
                    "restApiKey":"YTRjNmRkMT"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "onesignal",
					Type:     "onesignal",
					Settings: settingsJSON,
				}

				not, err := NewOneSignalNotifier(model)
				onesignalNotifier := not.(*OneSignalNotifier)

				So(err, ShouldBeNil)
				So(onesignalNotifier.Name, ShouldEqual, "onesignal")
				So(onesignalNotifier.Type, ShouldEqual, "onesignal")
				So(onesignalNotifier.Url, ShouldEqual, "https://onesignal.com/api/v1/notifications")
				So(onesignalNotifier.Source, ShouldEqual, "grafana_instance_01")
				So(onesignalNotifier.AppId, ShouldEqual, "7cc8e60c")
				So(onesignalNotifier.RestApiKey, ShouldEqual, "YTRjNmRkMT")
			})
		})
	})
}
