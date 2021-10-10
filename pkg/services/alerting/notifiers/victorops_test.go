package notifiers

import (
	"context"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/validations"
	. "github.com/smartystreets/goconvey/convey"
)

func presenceComparerInt(a, b int64) bool {
	if a == -1 {
		return b != 0
	}
	if b == -1 {
		return a != 0
	}
	return a == b
}
func TestVictoropsNotifier(t *testing.T) {
	Convey("Victorops notifier tests", t, func() {
		secretsService := secrets.SetupTestService(t)
		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "victorops_testing",
					Type:     "victorops",
					Settings: settingsJSON,
				}

				_, err := NewVictoropsNotifier(model, secretsService.GetDecryptedValue)
				So(err, ShouldNotBeNil)
			})

			Convey("from settings", func() {
				json := `
				{
          "url": "http://google.com"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "victorops_testing",
					Type:     "victorops",
					Settings: settingsJSON,
				}

				not, err := NewVictoropsNotifier(model, secretsService.GetDecryptedValue)
				victoropsNotifier := not.(*VictoropsNotifier)

				So(err, ShouldBeNil)
				So(victoropsNotifier.Name, ShouldEqual, "victorops_testing")
				So(victoropsNotifier.Type, ShouldEqual, "victorops")
				So(victoropsNotifier.URL, ShouldEqual, "http://google.com")
			})

			Convey("should return properly formatted event payload when using severity override tag", func() {
				json := `
				{
					"url": "http://google.com"
				}`

				settingsJSON, err := simplejson.NewJson([]byte(json))
				So(err, ShouldBeNil)

				model := &models.AlertNotification{
					Name:     "victorops_testing",
					Type:     "victorops",
					Settings: settingsJSON,
				}

				not, err := NewVictoropsNotifier(model, secretsService.GetDecryptedValue)
				So(err, ShouldBeNil)

				victoropsNotifier := not.(*VictoropsNotifier)

				evalContext := alerting.NewEvalContext(context.Background(), &alerting.Rule{
					ID:      0,
					Name:    "someRule",
					Message: "someMessage",
					State:   models.AlertStateAlerting,
					AlertRuleTags: []*models.Tag{
						{Key: "keyOnly"},
						{Key: "severity", Value: "warning"},
					},
				}, &validations.OSSPluginRequestValidator{})
				evalContext.IsTestRun = true

				payload, err := victoropsNotifier.buildEventPayload(evalContext)
				So(err, ShouldBeNil)

				diff := cmp.Diff(map[string]interface{}{
					"alert_url":           "",
					"entity_display_name": "[Alerting] someRule",
					"entity_id":           "someRule",
					"message_type":        "WARNING",
					"metrics":             map[string]interface{}{},
					"monitoring_tool":     "Grafana v",
					"state_message":       "someMessage",
					"state_start_time":    int64(-1),
					"timestamp":           int64(-1),
				}, payload.Interface(), cmp.Comparer(presenceComparerInt))
				So(diff, ShouldBeEmpty)
			})
			Convey("resolving with severity works properly", func() {
				json := `
				{
					"url": "http://google.com"
				}`

				settingsJSON, err := simplejson.NewJson([]byte(json))
				So(err, ShouldBeNil)

				model := &models.AlertNotification{
					Name:     "victorops_testing",
					Type:     "victorops",
					Settings: settingsJSON,
				}

				not, err := NewVictoropsNotifier(model, secretsService.GetDecryptedValue)
				So(err, ShouldBeNil)

				victoropsNotifier := not.(*VictoropsNotifier)

				evalContext := alerting.NewEvalContext(context.Background(), &alerting.Rule{
					ID:      0,
					Name:    "someRule",
					Message: "someMessage",
					State:   models.AlertStateOK,
					AlertRuleTags: []*models.Tag{
						{Key: "keyOnly"},
						{Key: "severity", Value: "warning"},
					},
				}, &validations.OSSPluginRequestValidator{})
				evalContext.IsTestRun = true

				payload, err := victoropsNotifier.buildEventPayload(evalContext)
				So(err, ShouldBeNil)

				diff := cmp.Diff(map[string]interface{}{
					"alert_url":           "",
					"entity_display_name": "[OK] someRule",
					"entity_id":           "someRule",
					"message_type":        "RECOVERY",
					"metrics":             map[string]interface{}{},
					"monitoring_tool":     "Grafana v",
					"state_message":       "someMessage",
					"state_start_time":    int64(-1),
					"timestamp":           int64(-1),
				}, payload.Interface(), cmp.Comparer(presenceComparerInt))
				So(diff, ShouldBeEmpty)
			})
		})
	})
}
