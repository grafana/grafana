package notifiers

import (
	"context"
	"strings"
	"testing"

	"github.com/grafana/grafana/pkg/services/alerting"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestPushoverNotifier(t *testing.T) {
	Convey("Pushover notifier tests", t, func() {
		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
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
					"sound": "pushover",
					"okSound": "magic"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "Pushover",
					Type:     "pushover",
					Settings: settingsJSON,
				}

				not, err := NewPushoverNotifier(model)
				pushoverNotifier := not.(*PushoverNotifier)

				So(err, ShouldBeNil)
				So(pushoverNotifier.Name, ShouldEqual, "Pushover")
				So(pushoverNotifier.Type, ShouldEqual, "pushover")
				So(pushoverNotifier.APIToken, ShouldEqual, "4SrUFQL4A5V5TQ1z5Pg9nxHXPXSTve")
				So(pushoverNotifier.UserKey, ShouldEqual, "tzNZYf36y0ohWwXo4XoUrB61rz1A4o")
				So(pushoverNotifier.Priority, ShouldEqual, 1)
				So(pushoverNotifier.AlertingSound, ShouldEqual, "pushover")
				So(pushoverNotifier.OkSound, ShouldEqual, "magic")
			})
		})
	})
}

func TestGenPushoverBody(t *testing.T) {
	Convey("Pushover body generation tests", t, func() {
		Convey("Given common sounds", func() {
			sirenSound := "siren_sound_tst"
			successSound := "success_sound_tst"
			notifier := &PushoverNotifier{AlertingSound: sirenSound, OkSound: successSound}

			Convey("When alert is firing - should use siren sound", func() {
				evalContext := alerting.NewEvalContext(context.Background(),
					&alerting.Rule{
						State: models.AlertStateAlerting,
					})
				_, pushoverBody, err := notifier.genPushoverBody(evalContext, "", "")

				So(err, ShouldBeNil)
				So(strings.Contains(pushoverBody.String(), sirenSound), ShouldBeTrue)
			})

			Convey("When alert is ok - should use success sound", func() {
				evalContext := alerting.NewEvalContext(context.Background(),
					&alerting.Rule{
						State: models.AlertStateOK,
					})
				_, pushoverBody, err := notifier.genPushoverBody(evalContext, "", "")

				So(err, ShouldBeNil)
				So(strings.Contains(pushoverBody.String(), successSound), ShouldBeTrue)
			})
		})
	})
}
