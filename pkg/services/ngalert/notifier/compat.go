package notifier

import (
	"encoding/json"
	"fmt"

	alertingNotify "github.com/grafana/alerting/notify"
	alertingTemplates "github.com/grafana/alerting/templates"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
)

func PostableApiReceiversToReceivers(postables []*apimodels.PostableApiReceiver, storedProvenances map[string]models.Provenance) ([]*models.Receiver, error) {
	receivers := make([]*models.Receiver, 0, len(postables))
	for _, postable := range postables {
		r, err := PostableApiReceiverToReceiver(postable, getReceiverProvenance(storedProvenances, postable))
		if err != nil {
			return nil, err
		}
		receivers = append(receivers, r)
	}
	return receivers, nil
}

func PostableApiReceiverToReceiver(postable *apimodels.PostableApiReceiver, provenance models.Provenance) (*models.Receiver, error) {
	integrations, err := PostableGrafanaReceiversToIntegrations(postable.GrafanaManagedReceivers)
	if err != nil {
		return nil, err
	}
	r := &models.Receiver{
		UID:          legacy_storage.NameToUid(postable.GetName()), // TODO replace with stable UID.
		Name:         postable.GetName(),
		Integrations: integrations,
		Provenance:   provenance,
	}
	r.Version = r.Fingerprint()
	return r, nil
}

func PostableGrafanaReceiversToIntegrations(postables []*apimodels.PostableGrafanaReceiver) ([]*models.Integration, error) {
	integrations := make([]*models.Integration, 0, len(postables))
	for _, cfg := range postables {
		integration, err := PostableGrafanaReceiverToIntegration(cfg)
		if err != nil {
			return nil, err
		}
		integrations = append(integrations, integration)
	}

	return integrations, nil
}

func PostableGrafanaReceiverToIntegration(p *apimodels.PostableGrafanaReceiver) (*models.Integration, error) {
	config, err := models.IntegrationConfigFromType(p.Type)
	if err != nil {
		return nil, err
	}
	integration := &models.Integration{
		UID:                   p.UID,
		Name:                  p.Name,
		Config:                config,
		DisableResolveMessage: p.DisableResolveMessage,
		Settings:              make(map[string]any, len(p.Settings)),
		SecureSettings:        make(map[string]string, len(p.SecureSettings)),
	}

	if p.Settings != nil {
		if err := json.Unmarshal(p.Settings, &integration.Settings); err != nil {
			return nil, fmt.Errorf("integration '%s' of receiver '%s' has settings that cannot be parsed as JSON: %w", integration.Config.Type, p.Name, err)
		}
	}

	for k, v := range p.SecureSettings {
		if v != "" {
			integration.SecureSettings[k] = v
		}
	}

	return integration, nil
}

// getReceiverProvenance determines the provenance of a definitions.PostableApiReceiver based on the provenance of its integrations.
func getReceiverProvenance(storedProvenances map[string]models.Provenance, r *apimodels.PostableApiReceiver) models.Provenance {
	if len(r.GrafanaManagedReceivers) == 0 {
		return models.ProvenanceNone
	}

	// Current provisioning works on the integration level, so we need some way to determine the provenance of the
	// entire receiver. All integrations in a receiver should have the same provenance, but we don't want to rely on
	// this assumption in case the first provenance is None and a later one is not. To this end, we return the first
	// non-zero provenance we find.
	for _, contactPoint := range r.GrafanaManagedReceivers {
		if p, exists := storedProvenances[contactPoint.UID]; exists && p != models.ProvenanceNone {
			return p
		}
	}
	return models.ProvenanceNone
}

func PostableGrafanaReceiverToGrafanaIntegrationConfig(p *apimodels.PostableGrafanaReceiver) *alertingNotify.GrafanaIntegrationConfig {
	return &alertingNotify.GrafanaIntegrationConfig{
		UID:                   p.UID,
		Name:                  p.Name,
		Type:                  p.Type,
		DisableResolveMessage: p.DisableResolveMessage,
		Settings:              json.RawMessage(p.Settings),
		SecureSettings:        p.SecureSettings,
	}
}

func PostableApiReceiverToApiReceiver(r *apimodels.PostableApiReceiver) *alertingNotify.APIReceiver {
	integrations := alertingNotify.GrafanaIntegrations{
		Integrations: make([]*alertingNotify.GrafanaIntegrationConfig, 0, len(r.GrafanaManagedReceivers)),
	}
	for _, cfg := range r.GrafanaManagedReceivers {
		integrations.Integrations = append(integrations.Integrations, PostableGrafanaReceiverToGrafanaIntegrationConfig(cfg))
	}

	return &alertingNotify.APIReceiver{
		ConfigReceiver:      r.Receiver,
		GrafanaIntegrations: integrations,
	}
}

func PostableApiAlertingConfigToApiReceivers(c apimodels.PostableApiAlertingConfig) []*alertingNotify.APIReceiver {
	apiReceivers := make([]*alertingNotify.APIReceiver, 0, len(c.Receivers))
	for _, receiver := range c.Receivers {
		apiReceivers = append(apiReceivers, PostableApiReceiverToApiReceiver(receiver))
	}
	return apiReceivers
}

// ToTemplateDefinitions converts the given PostableUserConfig's TemplateFiles to a slice of TemplateDefinitions.
func ToTemplateDefinitions(cfg *apimodels.PostableUserConfig) []alertingTemplates.TemplateDefinition {
	out := make([]alertingTemplates.TemplateDefinition, 0, len(cfg.TemplateFiles))
	for name, tmpl := range cfg.TemplateFiles {
		out = append(out, alertingTemplates.TemplateDefinition{
			Name:     name,
			Template: tmpl,
			Kind:     alertingTemplates.GrafanaKind,
		})
	}
	return out
}

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
