package notifiers

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestSignl4Notifier(t *testing.T) {
	Convey("SIGNL4 notifier tests", t, func() {
		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "signl4_testing",
					Type:     "signl4",
					Settings: settingsJSON,
				}

				_, err := NewSignl4Notifier(model)
				So(err, ShouldNotBeNil)
			})

			Convey("settings should trigger incident", func() {
				json := `
				{
          "teamSecret": "abcdefg"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "signl4_testing",
					Type:     "signl4",
					Settings: settingsJSON,
				}

				not, err := NewSignl4Notifier(model)
				signl4Notifier := not.(*Signl4Notifier)

				So(err, ShouldBeNil)
				So(signl4Notifier.Name, ShouldEqual, "signl4_testing")
				So(signl4Notifier.Type, ShouldEqual, "signl4")
				So(signl4Notifier.TeamSecret, ShouldEqual, "abcdefg")
			})

			Convey("alert payload should include tag pairs in a ['key1:value1'] format when a value exists and in ['key2'] format when a value is absent", func() {
				json := `
				{
          "teamSecret": "abcdefg"
				}`

				tagPairs := []*models.Tag{
					{Key: "keyOnly"},
					{Key: "aKey", Value: "aValue"},
				}

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "signl4_testing",
					Type:     "signl4",
					Settings: settingsJSON,
				}

				notifier, notifierErr := NewSignl4Notifier(model) // unhandled error

				signl4Notifier := notifier.(*Signl4Notifier)

				evalContext := alerting.NewEvalContext(context.Background(), &alerting.Rule{
					ID:            0,
					Name:          "someRule",
					Message:       "someMessage",
					State:         models.AlertStateAlerting,
					AlertRuleTags: tagPairs,
				})
				evalContext.IsTestRun = true

				receivedTags := make([]string, 0)
				bus.AddHandlerCtx("alerting", func(ctx context.Context, cmd *models.SendWebhookSync) error {
					bodyJSON, err := simplejson.NewJson([]byte(cmd.Body))
					if err == nil {
						receivedTags = bodyJSON.Get("tags").MustStringArray([]string{})
					}
					return err
				})

				alertErr := signl4Notifier.createAlert(evalContext)

				So(notifierErr, ShouldBeNil)
				So(alertErr, ShouldBeNil)
				So(receivedTags, ShouldResemble, []string{"keyOnly", "aKey:aValue"})
			})
		})
	})
}
