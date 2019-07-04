package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestKavenegarNotifier(t *testing.T) {
	Convey("Kavenegar notifier tests", t, func() {

		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "kavenegar_testing",
					Type:     "kavenegar",
					Settings: settingsJSON,
				}

				_, err := NewKavenegarNotifier(model)
				So(err, ShouldNotBeNil)
			})

			Convey("from settings", func() {
				json := `
				{
					"apikey": "API_KEY",
					"sender": "SENDER_NUM",
					"recipients": "REC1;REC2"
					"template": "MESSAGE CONTENT"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "kavenegar_testing",
					Type:     "kavenegar",
					Settings: settingsJSON,
				}

				not, err := NewKavenegarNotifier(model)
				kavenegarNotifier := not.(*KavenegarNotifier)

				So(err, ShouldBeNil)
				So(kavenegarNotifier.Name, ShouldEqual, "kavenegar_testing")
				So(kavenegarNotifier.Type, ShouldEqual, "kavenegar")
				So(kavenegarNotifier.APIKey, ShouldEqual, "API_KEY")
				So(kavenegarNotifier.Sender, ShouldEqual, "SENDER_NUM")
				So(kavenegarNotifier.Recipients, ShouldResemble, []string{"REC1", "REC2"})
				So(kavenegarNotifier.Body, ShouldEqual, "MESSAGE CONTENT")
			})

			Convey("from settings with empty required values", func() {
				json := `
				{
					"apikey": "",
					"recipients": ""
					"sender": "",
					"template": ""
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "kavenegar_testing",
					Type:     "kavenegar",
					Settings: settingsJSON,
				}

				_, err := NewKavenegarNotifier(model)

				So(err, ShouldNotBeNil)
			})

			Convey("from settings with non existent sender", func() {
				json := `
				{
					"apikey": "API_KEY",
					"recipients": "REC1;REC2"
					"template": "MESSAGE CONTENT"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "kavenegar_testing",
					Type:     "kavenegar",
					Settings: settingsJSON,
				}

				not, err := NewKavenegarNotifier(model)
				kavenegarNotifier := not.(*KavenegarNotifier)

				So(err, ShouldBeNil)
				So(kavenegarNotifier.Name, ShouldEqual, "kavenegar_testing")
				So(kavenegarNotifier.Type, ShouldEqual, "kavenegar")
				So(kavenegarNotifier.APIKey, ShouldEqual, "API_KEY")
				So(kavenegarNotifier.Sender, ShouldEqual, "")
				So(kavenegarNotifier.Recipients, ShouldResemble, []string{"REC1", "REC2"})
				So(kavenegarNotifier.Body, ShouldEqual, "MESSAGE CONTENT")
			})
		})
	})
}
