package notifier

import (
	"encoding/json"

	alertingModels "github.com/grafana/alerting/models"
	alertingNotify "github.com/grafana/alerting/notify"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// Silence-specific compat functions to convert between grafana/alerting and model types.

func GettableSilenceToSilence(s alertingNotify.GettableSilence) *models.Silence {
	sil := models.Silence(s)
	return &sil
}

func GettableSilencesToSilences(silences alertingNotify.GettableSilences) []*models.Silence {
	res := make([]*models.Silence, 0, len(silences))
	for _, sil := range silences {
		res = append(res, GettableSilenceToSilence(*sil))
	}
	return res
}

func SilenceToPostableSilence(s models.Silence) *alertingNotify.PostableSilence {
	var id string
	if s.ID != nil {
		id = *s.ID
	}
	return &alertingNotify.PostableSilence{
		ID:      id,
		Silence: s.Silence,
	}
}

func IntegrationToIntegrationConfig(i models.Integration) (alertingModels.IntegrationConfig, error) {
	raw, err := json.Marshal(i.Settings)
	if err != nil {
		return alertingModels.IntegrationConfig{}, err
	}
	return alertingModels.IntegrationConfig{
		UID:                   i.UID,
		Name:                  i.Name,
		Type:                  string(i.Config.Type()),
		DisableResolveMessage: i.DisableResolveMessage,
		Settings:              raw,
		SecureSettings:        i.SecureSettings,
	}, nil
}
