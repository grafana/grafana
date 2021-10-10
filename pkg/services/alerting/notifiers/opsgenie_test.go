package notifiers

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/validations"
	. "github.com/smartystreets/goconvey/convey"
)

func TestOpsGenieNotifier(t *testing.T) {
	Convey("OpsGenie notifier tests", t, func() {
		secretsService := secrets.SetupTestService(t)
		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "opsgenie_testing",
					Type:     "opsgenie",
					Settings: settingsJSON,
				}

				_, err := NewOpsGenieNotifier(model, secretsService.GetDecryptedValue)
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

				not, err := NewOpsGenieNotifier(model, secretsService.GetDecryptedValue)
				opsgenieNotifier := not.(*OpsGenieNotifier)

				So(err, ShouldBeNil)
				So(opsgenieNotifier.Name, ShouldEqual, "opsgenie_testing")
				So(opsgenieNotifier.Type, ShouldEqual, "opsgenie")
				So(opsgenieNotifier.APIKey, ShouldEqual, "abcdefgh0123456789")
			})
		})

		Convey("Handling notification tags", func() {
			Convey("invalid sendTagsAs value should return error", func() {
				json := `{
          "apiKey": "abcdefgh0123456789",
          "sendTagsAs": "not_a_valid_value"
                                }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "opsgenie_testing",
					Type:     "opsgenie",
					Settings: settingsJSON,
				}

				_, err := NewOpsGenieNotifier(model, secretsService.GetDecryptedValue)
				So(err, ShouldNotBeNil)
				So(err, ShouldHaveSameTypeAs, alerting.ValidationError{})
				So(err.Error(), ShouldEndWith, "Invalid value for sendTagsAs: \"not_a_valid_value\"")
			})

			Convey("alert payload should include tag pairs only as an array in the tags key when sendAsTags is not set", func() {
				json := `{
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

				notifier, notifierErr := NewOpsGenieNotifier(model, secretsService.GetDecryptedValue) // unhandled error

				opsgenieNotifier := notifier.(*OpsGenieNotifier)

				evalContext := alerting.NewEvalContext(context.Background(), &alerting.Rule{
					ID:            0,
					Name:          "someRule",
					Message:       "someMessage",
					State:         models.AlertStateAlerting,
					AlertRuleTags: tagPairs,
				}, &validations.OSSPluginRequestValidator{})
				evalContext.IsTestRun = true

				tags := make([]string, 0)
				details := make(map[string]interface{})
				bus.AddHandlerCtx("alerting", func(ctx context.Context, cmd *models.SendWebhookSync) error {
					bodyJSON, err := simplejson.NewJson([]byte(cmd.Body))
					if err == nil {
						tags = bodyJSON.Get("tags").MustStringArray([]string{})
						details = bodyJSON.Get("details").MustMap(map[string]interface{}{})
					}
					return err
				})

				alertErr := opsgenieNotifier.createAlert(evalContext)

				So(notifierErr, ShouldBeNil)
				So(alertErr, ShouldBeNil)
				So(tags, ShouldResemble, []string{"keyOnly", "aKey:aValue"})
				So(details, ShouldResemble, map[string]interface{}{"url": ""})
			})

			Convey("alert payload should include tag pairs only as a map in the details key when sendAsTags=details", func() {
				json := `{
          "apiKey": "abcdefgh0123456789",
          "sendTagsAs": "details"
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

				notifier, notifierErr := NewOpsGenieNotifier(model, secretsService.GetDecryptedValue) // unhandled error

				opsgenieNotifier := notifier.(*OpsGenieNotifier)

				evalContext := alerting.NewEvalContext(context.Background(), &alerting.Rule{
					ID:            0,
					Name:          "someRule",
					Message:       "someMessage",
					State:         models.AlertStateAlerting,
					AlertRuleTags: tagPairs,
				}, nil)
				evalContext.IsTestRun = true

				tags := make([]string, 0)
				details := make(map[string]interface{})
				bus.AddHandlerCtx("alerting", func(ctx context.Context, cmd *models.SendWebhookSync) error {
					bodyJSON, err := simplejson.NewJson([]byte(cmd.Body))
					if err == nil {
						tags = bodyJSON.Get("tags").MustStringArray([]string{})
						details = bodyJSON.Get("details").MustMap(map[string]interface{}{})
					}
					return err
				})

				alertErr := opsgenieNotifier.createAlert(evalContext)

				So(notifierErr, ShouldBeNil)
				So(alertErr, ShouldBeNil)
				So(tags, ShouldResemble, []string{})
				So(details, ShouldResemble, map[string]interface{}{"keyOnly": "", "aKey": "aValue", "url": ""})
			})

			Convey("alert payload should include tag pairs as both a map in the details key and an array in the tags key when sendAsTags=both", func() {
				json := `{
          "apiKey": "abcdefgh0123456789",
          "sendTagsAs": "both"
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

				notifier, notifierErr := NewOpsGenieNotifier(model, secretsService.GetDecryptedValue) // unhandled error

				opsgenieNotifier := notifier.(*OpsGenieNotifier)

				evalContext := alerting.NewEvalContext(context.Background(), &alerting.Rule{
					ID:            0,
					Name:          "someRule",
					Message:       "someMessage",
					State:         models.AlertStateAlerting,
					AlertRuleTags: tagPairs,
				}, nil)
				evalContext.IsTestRun = true

				tags := make([]string, 0)
				details := make(map[string]interface{})
				bus.AddHandlerCtx("alerting", func(ctx context.Context, cmd *models.SendWebhookSync) error {
					bodyJSON, err := simplejson.NewJson([]byte(cmd.Body))
					if err == nil {
						tags = bodyJSON.Get("tags").MustStringArray([]string{})
						details = bodyJSON.Get("details").MustMap(map[string]interface{}{})
					}
					return err
				})

				alertErr := opsgenieNotifier.createAlert(evalContext)

				So(notifierErr, ShouldBeNil)
				So(alertErr, ShouldBeNil)
				So(tags, ShouldResemble, []string{"keyOnly", "aKey:aValue"})
				So(details, ShouldResemble, map[string]interface{}{"keyOnly": "", "aKey": "aValue", "url": ""})
			})
		})
	})
}
