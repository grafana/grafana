package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestEmailNotifier(t *testing.T) {
	Convey("Email notifier tests", t, func() {
		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "ops",
					Type:     "email",
					Settings: settingsJSON,
				}

				_, err := NewEmailNotifier(model)
				So(err, ShouldNotBeNil)
			})

			Convey("from settings", func() {
				json := `
				{
					"addresses": "ops@grafana.org"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "ops",
					Type:     "email",
					Settings: settingsJSON,
				}

				not, err := NewEmailNotifier(model)
				emailNotifier := not.(*EmailNotifier)

				So(err, ShouldBeNil)
				So(emailNotifier.Name, ShouldEqual, "ops")
				So(emailNotifier.Type, ShouldEqual, "email")
				So(emailNotifier.Addresses[0], ShouldEqual, "ops@grafana.org")
			})

			Convey("from settings with two emails", func() {
				json := `
				{
					"addresses": "ops@grafana.org;dev@grafana.org"
				}`

				settingsJSON, err := simplejson.NewJson([]byte(json))
				So(err, ShouldBeNil)

				model := &models.AlertNotification{
					Name:     "ops",
					Type:     "email",
					Settings: settingsJSON,
				}

				not, err := NewEmailNotifier(model)
				emailNotifier := not.(*EmailNotifier)

				So(err, ShouldBeNil)
				So(emailNotifier.Name, ShouldEqual, "ops")
				So(emailNotifier.Type, ShouldEqual, "email")
				So(len(emailNotifier.Addresses), ShouldEqual, 2)

				So(emailNotifier.Addresses[0], ShouldEqual, "ops@grafana.org")
				So(emailNotifier.Addresses[1], ShouldEqual, "dev@grafana.org")
			})
		})
	})
}
