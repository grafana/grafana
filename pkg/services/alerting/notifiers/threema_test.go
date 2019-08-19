package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestThreemaNotifier(t *testing.T) {
	Convey("Threema notifier tests", t, func() {

		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "threema_testing",
					Type:     "threema",
					Settings: settingsJSON,
				}

				_, err := NewThreemaNotifier(model)
				So(err, ShouldNotBeNil)
			})

			Convey("valid settings should be parsed successfully", func() {
				json := `
				{
					"gateway_id": "*3MAGWID",
					"recipient_id": "ECHOECHO",
					"api_secret": "1234"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "threema_testing",
					Type:     "threema",
					Settings: settingsJSON,
				}

				not, err := NewThreemaNotifier(model)
				So(err, ShouldBeNil)
				threemaNotifier := not.(*ThreemaNotifier)

				So(err, ShouldBeNil)
				So(threemaNotifier.Name, ShouldEqual, "threema_testing")
				So(threemaNotifier.Type, ShouldEqual, "threema")
				So(threemaNotifier.GatewayID, ShouldEqual, "*3MAGWID")
				So(threemaNotifier.RecipientID, ShouldEqual, "ECHOECHO")
				So(threemaNotifier.APISecret, ShouldEqual, "1234")
			})

			Convey("invalid Threema Gateway IDs should be rejected (prefix)", func() {
				json := `
				{
					"gateway_id": "ECHOECHO",
					"recipient_id": "ECHOECHO",
					"api_secret": "1234"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "threema_testing",
					Type:     "threema",
					Settings: settingsJSON,
				}

				not, err := NewThreemaNotifier(model)
				So(not, ShouldBeNil)
				So(err.(alerting.ValidationError).Reason, ShouldEqual, "Invalid Threema Gateway ID: Must start with a *")
			})

			Convey("invalid Threema Gateway IDs should be rejected (length)", func() {
				json := `
				{
					"gateway_id": "*ECHOECHO",
					"recipient_id": "ECHOECHO",
					"api_secret": "1234"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "threema_testing",
					Type:     "threema",
					Settings: settingsJSON,
				}

				not, err := NewThreemaNotifier(model)
				So(not, ShouldBeNil)
				So(err.(alerting.ValidationError).Reason, ShouldEqual, "Invalid Threema Gateway ID: Must be 8 characters long")
			})

			Convey("invalid Threema Recipient IDs should be rejected (length)", func() {
				json := `
				{
					"gateway_id": "*3MAGWID",
					"recipient_id": "ECHOECH",
					"api_secret": "1234"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "threema_testing",
					Type:     "threema",
					Settings: settingsJSON,
				}

				not, err := NewThreemaNotifier(model)
				So(not, ShouldBeNil)
				So(err.(alerting.ValidationError).Reason, ShouldEqual, "Invalid Threema Recipient ID: Must be 8 characters long")
			})
		})
	})
}
