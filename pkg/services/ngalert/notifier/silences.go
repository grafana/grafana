package notifier

import (
	"context"

	alertingNotify "github.com/grafana/alerting/notify"
)

func (am *alertmanager) ListSilences(_ context.Context, filter []string) (alertingNotify.GettableSilences, error) {
	return am.Base.ListSilences(filter)
}

func (am *alertmanager) GetSilence(_ context.Context, silenceID string) (alertingNotify.GettableSilence, error) {
	return am.Base.GetSilence(silenceID)
}

func (am *alertmanager) CreateSilence(_ context.Context, ps *alertingNotify.PostableSilence) (string, error) {
	return am.Base.UpsertSilence(ps)
}

func (am *alertmanager) DeleteSilence(_ context.Context, silenceID string) error {
	return am.Base.DeleteSilence(silenceID)
}
