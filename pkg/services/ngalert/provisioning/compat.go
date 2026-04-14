package provisioning

import (
	"fmt"
	"strings"

	alertingModels "github.com/grafana/alerting/models"
	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/grafana/alerting/receivers/schema"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func EmbeddedContactPointToGrafanaIntegrationConfig(e *definitions.EmbeddedContactPoint) (alertingModels.IntegrationConfig, error) {
	data, err := e.Settings.MarshalJSON()
	if err != nil {
		return alertingModels.IntegrationConfig{}, err
	}
	iType, err := alertingNotify.IntegrationTypeFromString(e.Type)
	if err != nil {
		return alertingModels.IntegrationConfig{}, err
	}
	if _, ok := alertingNotify.GetSchemaVersionForIntegration(iType, schema.V1); !ok {
		return alertingModels.IntegrationConfig{}, fmt.Errorf("integration version %s is not available for integration type %s", schema.V1, iType)
	}
	return alertingModels.IntegrationConfig{
		UID:                   e.UID,
		Name:                  e.Name,
		Type:                  iType,
		Version:               schema.V1,
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
		Type:                  string(r.Config.Type()),
		DisableResolveMessage: r.DisableResolveMessage,
		Settings:              settingJson,
		Provenance:            string(provenance),
	}
}

// EmbeddedContactPointToIntegration converts an EmbeddedContactPoint to a models.Integration.
// This is primarily used for protected field comparison during updates.
// Note: SecureSettings is not populated as the provisioning API doesn't expose encrypted values.
func EmbeddedContactPointToIntegration(
	cp definitions.EmbeddedContactPoint,
	typeSchema schema.IntegrationSchemaVersion,
) (*models.Integration, error) {
	settings := make(map[string]any)
	if cp.Settings != nil {
		m, err := cp.Settings.Map()
		if err != nil {
			return nil, fmt.Errorf("failed to parse contact point settings: %w", err)
		}
		settings = m
	}
	return &models.Integration{
		UID:                   cp.UID,
		Name:                  cp.Name,
		Config:                typeSchema,
		DisableResolveMessage: cp.DisableResolveMessage,
		Settings:              settings,
	}, nil
}
