package notifier

import (
	alertingNotify "github.com/grafana/alerting/notify"
)

func (am *alertmanager) ListSilences(filter []string) (alertingNotify.GettableSilences, error) {
	return am.Base.ListSilences(filter)
}

func (am *alertmanager) GetSilence(silenceID string) (alertingNotify.GettableSilence, error) {
	return am.Base.GetSilence(silenceID)
}

func (am *alertmanager) CreateSilence(ps *alertingNotify.PostableSilence) (string, error) {
	return am.Base.CreateSilence(ps)
}

func (am *alertmanager) DeleteSilence(silenceID string) error {
	return am.Base.DeleteSilence(silenceID)
}
