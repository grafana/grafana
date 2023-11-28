package alerting

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/annotations/annotationstest"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/user"
)

// AlertTest makes a test alert.
func (e *AlertEngine) AlertTest(orgID int64, dashboard *simplejson.Json, panelID int64, user *user.SignedInUser) (*EvalContext, error) {
	dash := dashboards.NewDashboardFromJson(dashboard)
	dashInfo := DashAlertInfo{
		User:  user,
		Dash:  dash,
		OrgID: orgID,
	}
	alerts, err := e.dashAlertExtractor.GetAlerts(context.Background(), dashInfo)
	if err != nil {
		return nil, err
	}

	for _, alert := range alerts {
		if alert.PanelID != panelID {
			continue
		}
		rule, err := NewRuleFromDBAlert(context.Background(), e.AlertStore, alert, true)
		if err != nil {
			return nil, err
		}

		handler := NewEvalHandler(e.DataService)

		context := NewEvalContext(context.Background(), rule, fakeRequestValidator{}, e.AlertStore, nil, e.datasourceService, annotationstest.NewFakeAnnotationsRepo())
		context.IsTestRun = true
		context.IsDebug = true

		handler.Eval(context)
		context.Rule.State = context.GetNewState()
		return context, nil
	}

	return nil, fmt.Errorf("could not find alert with panel ID %d", panelID)
}
