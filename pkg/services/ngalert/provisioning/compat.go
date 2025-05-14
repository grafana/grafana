package provisioning

import (
	"strings"

	alertingNotify "github.com/grafana/alerting/notify"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
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

func PostableGrafanaReceiverToEmbeddedContactPoint(contactPoint *definitions.PostableGrafanaReceiver, provenance models.Provenance, decryptValue func(string) string) (definitions.EmbeddedContactPoint, error) {
	simpleJson, err := simplejson.NewJson(contactPoint.Settings)
	if err != nil {
		return definitions.EmbeddedContactPoint{}, err
	}
	embeddedContactPoint := definitions.EmbeddedContactPoint{
		UID:                   contactPoint.UID,
		Type:                  contactPoint.Type,
		Name:                  contactPoint.Name,
		DisableResolveMessage: contactPoint.DisableResolveMessage,
		Settings:              simpleJson,
		Provenance:            string(provenance),
	}
	for k, v := range contactPoint.SecureSettings {
		decryptedValue := decryptValue(v)
		if decryptedValue == "" {
			continue
		}
		embeddedContactPoint.Settings.SetPath(strings.Split(k, "."), decryptedValue)
	}
	return embeddedContactPoint, nil
}

func GrafanaIntegrationConfigToEmbeddedContactPoint(r *models.Integration, provenance models.Provenance) definitions.EmbeddedContactPoint {
	settingJson := simplejson.New()
	if r.Settings != nil {
		settingJson = simplejson.NewFromAny(r.Settings)
	}

	// We explicitly do not copy the secure settings to the settings field. This is because the provisioning API
	// never returns decrypted or encrypted values, only redacted values. Redacted values should already exist in the
	// settings field.

	return definitions.EmbeddedContactPoint{
		UID:                   r.UID,
		Name:                  r.Name,
		Type:                  r.Config.Type,
		DisableResolveMessage: r.DisableResolveMessage,
		Settings:              settingJson,
		Provenance:            string(provenance),
	}
}
