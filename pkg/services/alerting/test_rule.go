package alerting

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
)

type TestAlertRuleCommand struct {
	Dashboard *simplejson.Json
	PanelId   int64
	OrgId     int64

	Result *AlertResultContext
}

func init() {
	bus.AddHandler("alerting", handleTestAlertRuleCommand)
}

func handleTestAlertRuleCommand(cmd *TestAlertRuleCommand) error {

	dash, err := m.NewDashboardFromJson(cmd.Dashboard)
	if err != nil {
		return err
	}

	extractor := NewDashAlertExtractor(cmd.Dashboard)
	rules, err := extractor.GetAlerts()
	if err != nil {
		return err
	}

	for _, rule := range rules {
		if rule.PanelId == cmd.PanelId {
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
