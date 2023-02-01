package notifier

import (
	"github.com/grafana/alerting/notify"
)

func (am *Alertmanager) ListSilences(filter []string) (notify.GettableSilences, error) {
	return am.Base.ListSilences(filter)
}

func (am *Alertmanager) GetSilence(silenceID string) (notify.GettableSilence, error) {
	return am.Base.GetSilence(silenceID)
}

func (am *Alertmanager) CreateSilence(ps *notify.PostableSilence) (string, error) {
	return am.Base.CreateSilence(ps)
}

func (am *Alertmanager) DeleteSilence(silenceID string) error {
	return am.Base.DeleteSilence(silenceID)
}
