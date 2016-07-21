package alerting

import (
	"fmt"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
)

type AlertTestCommand struct {
	Dashboard *simplejson.Json
	PanelId   int64
	OrgId     int64

	Result *AlertResultContext
}

func init() {
	bus.AddHandler("alerting", handleAlertTestCommand)
}

func handleAlertTestCommand(cmd *AlertTestCommand) error {

	dash := m.NewDashboardFromJson(cmd.Dashboard)

	extractor := NewDashAlertExtractor(dash, cmd.OrgId)
	alerts, err := extractor.GetAlerts()
	if err != nil {
		return err
	}

	for _, alert := range alerts {
		if alert.PanelId == cmd.PanelId {
			rule, err := NewAlertRuleFromDBModel(alert)
			if err != nil {
				return err
			}

			cmd.Result = testAlertRule(rule)
			return nil
		}
	}

	return fmt.Errorf("Could not find alert with panel id %d", cmd.PanelId)
}

func testAlertRule(rule *AlertRule) *AlertResultContext {
	handler := NewHandler()

	context := NewAlertResultContext(rule)
	context.IsTestRun = true

	handler.Execute(context)

	return context
}
