package notifiers

import (
	"fmt"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/setting"
)

func getRuleLink(rule *alerting.Rule) (string, error) {
	slugQuery := &m.GetDashboardSlugByIdQuery{Id: rule.DashboardId}
	if err := bus.Dispatch(slugQuery); err != nil {
		return "", err
	}

	ruleLink := fmt.Sprintf("%sdashboard/db/%s?fullscreen&edit&tab=alert&panelId=%d", setting.AppUrl, slugQuery.Result, rule.PanelId)
	return ruleLink, nil
}
