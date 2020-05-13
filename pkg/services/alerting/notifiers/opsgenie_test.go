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

func TestOpsGenieNotifier(t *testing.T) {
	Convey("OpsGenie notifier tests", t, func() {

		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "opsgenie_testing",
					Type:     "opsgenie",
					Settings: settingsJSON,
				}

				_, err := NewOpsGenieNotifier(model)
				So(err, ShouldNotBeNil)
			})

			Convey("settings should trigger incident", func() {
				json := `
				{
          "apiKey": "abcdefgh0123456789"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "opsgenie_testing",
					Type:     "opsgenie",
					Settings: settingsJSON,
				}

				not, err := NewOpsGenieNotifier(model)
				opsgenieNotifier := not.(*OpsGenieNotifier)

				So(err, ShouldBeNil)
				So(opsgenieNotifier.Name, ShouldEqual, "opsgenie_testing")
				So(opsgenieNotifier.Type, ShouldEqual, "opsgenie")
				So(opsgenieNotifier.APIKey, ShouldEqual, "abcdefgh0123456789")
			})

			Convey("alert payload should include tag pairs in a ['key1:value1'] format when a value exists and in ['key2'] format when a value is absent", func() {
				json := `
				{
          "apiKey": "abcdefgh0123456789"
				}`

				tagPairs := []*models.Tag{
					{Key: "keyOnly"},
					{Key: "aKey", Value: "aValue"},
				}

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "opsgenie_testing",
					Type:     "opsgenie",
					Settings: settingsJSON,
				}

				notifier, notifierErr := NewOpsGenieNotifier(model) //unhandled error

				opsgenieNotifier := notifier.(*OpsGenieNotifier)

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

				alertErr := opsgenieNotifier.createAlert(evalContext)

				So(notifierErr, ShouldBeNil)
				So(alertErr, ShouldBeNil)
				So(receivedTags, ShouldResemble, []string{"keyOnly", "aKey:aValue"})
			})
		})
	})
}
