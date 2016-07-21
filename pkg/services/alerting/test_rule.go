package alerting

import (
	"fmt"
	"time"

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

			if res, err := testAlertRule(rule); err != nil {
				return err
			} else {
				cmd.Result = res
				return nil
			}
		}
	}

	return fmt.Errorf("Could not find alert with panel id %d", cmd.PanelId)
}

func testAlertRule(rule *AlertRule) (*AlertResultContext, error) {
	handler := NewHandler()

	resultChan := make(chan *AlertResultContext, 1)
	handler.Execute(rule, resultChan)

	select {
	case <-time.After(time.Second * 10):
		return &AlertResultContext{Error: fmt.Errorf("Timeout")}, nil
	case result := <-resultChan:
		return result, nil
	}
}
