package notifier

import (
	"github.com/grafana/alerting/alerting"
)

func (am *Alertmanager) GetAlerts(active, silenced, inhibited bool, filter []string, receivers string) (alerting.GettableAlerts, error) {
	return am.Base.GetAlerts(active, silenced, inhibited, filter, receivers)
}

func (am *Alertmanager) GetAlertGroups(active, silenced, inhibited bool, filter []string, receivers string) (alerting.AlertGroups, error) {
	return am.Base.GetAlertGroups(active, silenced, inhibited, filter, receivers)
}
