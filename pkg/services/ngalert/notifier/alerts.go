package notifier

import (
	"context"

	alertingNotify "github.com/grafana/alerting/notify"
)

func (am *alertmanager) GetAlerts(_ context.Context, active, silenced, inhibited bool, filter []string, receivers string) (alertingNotify.GettableAlerts, error) {
	return am.Base.GetAlerts(active, silenced, inhibited, filter, receivers)
}

func (am *alertmanager) GetAlertGroups(_ context.Context, active, silenced, inhibited bool, filter []string, receivers string) (alertingNotify.AlertGroups, error) {
	return am.Base.GetAlertGroups(active, silenced, inhibited, filter, receivers)
}
