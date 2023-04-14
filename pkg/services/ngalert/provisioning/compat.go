package provisioning

import (
	alertingNotify "github.com/grafana/alerting/notify"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

func EmbeddedContactPointToGrafanaIntegrationConfig(e definitions.EmbeddedContactPoint) (alertingNotify.GrafanaIntegrationConfig, error) {
	data, err := e.Settings.MarshalJSON()
	if err != nil {
		return alertingNotify.GrafanaIntegrationConfig{}, err
	}
	return alertingNotify.GrafanaIntegrationConfig{
		UID:                   e.UID,
		Name:                  e.Name,
		Type:                  e.Type,
		DisableResolveMessage: e.DisableResolveMessage,
		Settings:              data,
		SecureSettings:        nil,
	}, nil
}
