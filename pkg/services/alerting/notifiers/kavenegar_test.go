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
					Name:     "kavenegar",
					Type:     "kavenegar",
					Settings: settingsJSON,
				}

				_, err := NewKavenegarNotifier(model)
				So(err, ShouldNotBeNil)
			})

			Convey("from settings", func() {
				json := `
				{
					"method": "call",
					"recipient": "989120000000",
					"token": "test_token"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "kavenegar",
					Type:     "kavenegar",
					Settings: settingsJSON,
				}

				not, err := NewKavenegarNotifier(model)
				kavenegarNotifier := not.(*KavenegarNotifier)

				So(err, ShouldBeNil)
				So(kavenegarNotifier.Name, ShouldEqual, "kavenegar")
				So(kavenegarNotifier.Method, ShouldEqual, "call")
				So(kavenegarNotifier.Recipient, ShouldEqual, "989120000000")
				So(kavenegarNotifier.Token, ShouldEqual, "test_token")
			})
		})
	})
}
