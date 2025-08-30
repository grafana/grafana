package legacy_storage

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"maps"
	"slices"
	"strings"

	"github.com/grafana/alerting/definition"
	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/prometheus/alertmanager/config"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util"
)

var NameToUid = models.NameToUid

func UidToName(uid string) (string, error) {
	data, err := base64.RawURLEncoding.DecodeString(uid)
	if err != nil {
		return uid, err
	}
	return string(data), nil
}

func IntegrationToPostableGrafanaReceiver(integration *models.Integration) (*apimodels.PostableGrafanaReceiver, error) {
	postable := &apimodels.PostableGrafanaReceiver{
		UID:                   integration.UID,
		Name:                  integration.Name,
		Type:                  integration.Config.Type,
		DisableResolveMessage: integration.DisableResolveMessage,
		SecureSettings:        maps.Clone(integration.SecureSettings),
	}

	// Alertmanager will fail validation with nil Settings , so ensure we always have at least an empty map.
	settings := integration.Settings
	if settings == nil {
		settings = make(map[string]any)
	}

	jsonBytes, err := json.Marshal(settings)
	if err != nil {
		return nil, err
	}
	postable.Settings = jsonBytes
	return postable, nil
}

func ReceiverToPostableApiReceiver(r *models.Receiver) (*apimodels.PostableApiReceiver, error) {
	integrations := apimodels.PostableGrafanaReceivers{
		GrafanaManagedReceivers: make([]*apimodels.PostableGrafanaReceiver, 0, len(r.Integrations)),
	}
	for _, cfg := range r.Integrations {
		postable, err := IntegrationToPostableGrafanaReceiver(cfg)
		if err != nil {
			return nil, err
		}
		integrations.GrafanaManagedReceivers = append(integrations.GrafanaManagedReceivers, postable)
	}

	return &apimodels.PostableApiReceiver{
		Receiver: alertingNotify.ConfigReceiver{
			Name: r.Name,
		},
		PostableGrafanaReceivers: integrations,
	}, nil
}

func PostableApiReceiversToReceivers(postables []*apimodels.PostableApiReceiver, storedProvenances map[string]models.Provenance) ([]*models.Receiver, error) {
	receivers := make([]*models.Receiver, 0, len(postables))
	for _, postable := range postables {
		r, err := PostableApiReceiverToReceiver(postable, GetReceiverProvenance(storedProvenances, postable))
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
	if postable.Type() == apimodels.AlertmanagerReceiverType {
		mimir, err := PostableMimirReceiverToIntegrations(postable.Receiver)
		if err != nil {
			return nil, err
		}
		integrations = append(integrations, mimir...)
	}
	r := &models.Receiver{
		UID:          NameToUid(postable.GetName()), // TODO replace with stable UID.
		Name:         postable.GetName(),
		Integrations: integrations,
		Provenance:   provenance,
	}
	r.Version = r.Fingerprint()
	return r, nil
}

// GetReceiverProvenance determines the provenance of a definitions.PostableApiReceiver based on the provenance of its integrations.
func GetReceiverProvenance(storedProvenances map[string]models.Provenance, r *apimodels.PostableApiReceiver) models.Provenance {
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

func PostableMimirReceiverToIntegrations(r config.Receiver) ([]*models.Integration, error) {
	data, err := definition.MarshalJSONWithSecrets(r)
	if err != nil {
		return nil, err
	}
	var un map[string]any
	err = json.Unmarshal(data, &un)
	if err != nil {
		return nil, err
	}

	result := make([]*models.Integration, 0, 3)
	for _, key := range slices.Sorted(maps.Keys(un)) {
		if !strings.HasSuffix(key, "_configs") {
			continue
		}
		tp := strings.TrimSuffix(key, "_configs")
		integrationConfig, err := models.IntegrationConfigFromType(tp, util.Pointer("v0"))
		if err != nil {
			return nil, err
		}
		for _, cfg := range un[key].([]any) {
			cfgMap := cfg.(map[string]any)
			integration := &models.Integration{
				Config:         integrationConfig,
				Settings:       cfgMap,
				SecureSettings: map[string]string{},
			}
			result = append(result, integration)
		}
	}
	return result, nil
}

func PostableGrafanaReceiverToIntegration(p *apimodels.PostableGrafanaReceiver) (*models.Integration, error) {
	config, err := models.IntegrationConfigFromType(p.Type, nil)
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
