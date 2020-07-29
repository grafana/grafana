package alerting

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
)

// AlertTestCommand initiates an test evaluation
// of an alert rule.
type AlertTestCommand struct {
	Dashboard *simplejson.Json
	PanelID   int64
	OrgID     int64
	User      *models.SignedInUser

	Result *EvalContext
}

func init() {
	bus.AddHandler("alerting", handleAlertTestCommand)
}

func handleAlertTestCommand(cmd *AlertTestCommand) error {
	dash := models.NewDashboardFromJson(cmd.Dashboard)

	extractor := NewDashAlertExtractor(dash, cmd.OrgID, cmd.User)
	alerts, err := extractor.GetAlerts()
	if err != nil {
		return err
	}

	for _, alert := range alerts {
		if alert.PanelId == cmd.PanelID {
			rule, err := NewRuleFromDBAlert(alert)
			if err != nil {
				return err
			}

			cmd.Result = testAlertRule(rule)
			return nil
		}
	}

	return fmt.Errorf("Could not find alert with panel id %d", cmd.PanelID)
}

func testAlertRule(rule *Rule) *EvalContext {
	handler := NewEvalHandler()

	context := NewEvalContext(context.Background(), rule)
	context.IsTestRun = true
	context.IsDebug = true

	handler.Eval(context)
	context.Rule.State = context.GetNewState()

	return context
}
