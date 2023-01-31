package notifier

import (
	"github.com/grafana/alerting/alerting"
)

func (am *Alertmanager) ListSilences(filter []string) (alerting.GettableSilences, error) {
	return am.Base.ListSilences(filter)
}

func (am *Alertmanager) GetSilence(silenceID string) (alerting.GettableSilence, error) {
	return am.Base.GetSilence(silenceID)
}

func (am *Alertmanager) CreateSilence(ps *alerting.PostableSilence) (string, error) {
	return am.Base.CreateSilence(ps)
}

func (am *Alertmanager) DeleteSilence(silenceID string) error {
	return am.Base.DeleteSilence(silenceID)
}
