package notifier

import (
	"github.com/grafana/alerting/notify"
)

func (am *Alertmanager) GetAlerts(active, silenced, inhibited bool, filter []string, receivers string) (notify.GettableAlerts, error) {
	return am.Base.GetAlerts(active, silenced, inhibited, filter, receivers)
}

func (am *Alertmanager) GetAlertGroups(active, silenced, inhibited bool, filter []string, receivers string) (notify.AlertGroups, error) {
	return am.Base.GetAlertGroups(active, silenced, inhibited, filter, receivers)
}
