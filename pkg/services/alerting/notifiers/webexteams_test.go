package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestWebexTeamsNotifier(t *testing.T) {
	Convey("WebexTeams notifier tests", t, func() {
		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "webexteams_testing",
					Type:     "webexteams",
					Settings: settingsJSON,
				}

				_, err := NewWebexTeamsNotifier(model)
				So(err, ShouldNotBeNil)
			})

			Convey("settings should trigger", func() {
				json := `
				{
		  			"space_id": "abcdefgh0123456789",
					"token": "xoxb-XXXXXXXX-XXXXXXXX-XXXXXXXXXX"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "webexteams_testing",
					Type:     "webexteams",
					Settings: settingsJSON,
				}

				not, err := NewWebexTeamsNotifier(model)
				webexTeamsNotifier := not.(*WebexTeamsNotifier)

				So(err, ShouldBeNil)
				So(webexTeamsNotifier.Name, ShouldEqual, "webexteams_testing")
				So(webexTeamsNotifier.Type, ShouldEqual, "webexteams")
				So(webexTeamsNotifier.Recipient, ShouldEqual, "abcdefgh0123456789")
				So(webexTeamsNotifier.Token, ShouldEqual, "xoxb-XXXXXXXX-XXXXXXXX-XXXXXXXXXX")
			})
		})
	})
}
