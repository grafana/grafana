package legacy_storage

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"maps"
	"strings"

	"github.com/grafana/alerting/definition"
	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/grafana/alerting/receivers/schema"
	"github.com/prometheus/common/model"
	k8svalidation "k8s.io/apimachinery/pkg/util/validation"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations/ualert"
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
		Type:                  string(integration.Config.Type()),
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

func PostableApiReceiverToReceiver(postable *apimodels.PostableApiReceiver, provenance models.Provenance, origin models.ResourceOrigin) (*models.Receiver, error) {
	integrations, err := PostableGrafanaReceiversToIntegrations(postable.GrafanaManagedReceivers)
	if err != nil {
		return nil, err
	}
	if postable.HasMimirIntegrations() {
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
		Origin:       origin,
	}
	r.Version = r.Fingerprint()
	return r, nil
}

// GetReceiverProvenance determines the provenance of a definitions.PostableApiReceiver based on the provenance of its integrations.
func GetReceiverProvenance(storedProvenances map[string]models.Provenance, r *apimodels.PostableApiReceiver, origin models.ResourceOrigin) models.Provenance {
	if origin == models.ResourceOriginImported {
		return models.ProvenanceConvertedPrometheus
	}

	if len(r.GrafanaManagedReceivers) == 0 || len(storedProvenances) == 0 {
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

func PostableMimirReceiverToIntegrations(r alertingNotify.ConfigReceiver) ([]*models.Integration, error) {
	v0, err := alertingNotify.ConfigReceiverToMimirIntegrations(r)
	if err != nil {
		return nil, fmt.Errorf("failed to convert v0 receiver to integrations: %w", err)
	}
	result := make([]*models.Integration, 0, len(v0))
	for _, config := range v0 {
		s, err := config.ConfigMap()
		if err != nil {
			return nil, fmt.Errorf("failed to get settings of v0 receiver %s (version %s): %w", config.Schema.Type(), config.Schema.Version, err)
		}
		result = append(result, &models.Integration{
			Config:         config.Schema,
			Settings:       s,
			SecureSettings: map[string]string{},
		})
	}
	return result, nil
}

func PostableGrafanaReceiverToIntegration(p *apimodels.PostableGrafanaReceiver) (*models.Integration, error) {
	integrationType, err := alertingNotify.IntegrationTypeFromString(p.Type)
	if err != nil {
		return nil, err
	}
	config, ok := alertingNotify.GetSchemaVersionForIntegration(integrationType, schema.V1)
	if !ok {
		return nil, fmt.Errorf("integration type [%s] does not have schema of version %s", integrationType, schema.V1)
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
			return nil, fmt.Errorf("integration '%s' of receiver '%s' has settings that cannot be parsed as JSON: %w", integration.Config.Type(), p.Name, err)
		}
	}

	for k, v := range p.SecureSettings {
		if v != "" {
			integration.SecureSettings[k] = v
		}
	}

	return integration, nil
}

func ManagedRouteToRoute(r *ManagedRoute) definition.Route {
	groupByAll, groupBy := ToGroupBy(r.GroupBy...)

	// Only need to copy the fields that are valid for a root route.
	return definition.Route{
		Receiver:       r.Receiver,
		GroupByStr:     r.GroupBy,
		GroupWait:      r.GroupWait,
		GroupInterval:  r.GroupInterval,
		RepeatInterval: r.RepeatInterval,
		Routes:         r.Routes,
		Provenance:     definition.Provenance(r.Provenance),

		// These are deceptively necessary since they are normally generated during unmarshalling and assumed to be
		// present in upstream alertmanager code. We can't assume we'll be unmarshalling the route again, so we need to
		// set them here.
		GroupBy:    groupBy,
		GroupByAll: groupByAll,
	}
}

// ToGroupBy converts the given label strings to (groupByAll, []model.LabelName) where groupByAll is true if the input
// contains models.GroupByAll. This logic is in accordance with upstream Route.ValidateChild().
func ToGroupBy(groupByStr ...string) (groupByAll bool, groupBy []model.LabelName) {
	for _, l := range groupByStr {
		if l == models.GroupByAll {
			return true, nil
		} else {
			groupBy = append(groupBy, model.LabelName(l))
		}
	}
	return false, groupBy
}

func InhibitRuleToInhibitionRule(name string, rule apimodels.InhibitRule, provenance apimodels.Provenance) (*apimodels.InhibitionRule, error) {
	if name = strings.TrimSpace(name); name == "" {
		return nil, fmt.Errorf("inhibition rule name must not be empty")
	}

	if strings.Contains(name, ":") {
		return nil, fmt.Errorf("inhibition rule name cannot contain invalid character ':'")
	}

	if errs := k8svalidation.IsDNS1123Subdomain(name); len(errs) > 0 {
		return nil, fmt.Errorf("inhibition rule name must be a valid DNS subdomain: %s", strings.Join(errs, ", "))
	}

	// imported inhibition rules have purposefully long names to ensure no conflict with non-imported ones
	if models.Provenance(provenance) != models.ProvenanceConvertedPrometheus && len(name) > ualert.UIDMaxLength {
		return nil, fmt.Errorf("inhibition rule name is too long (exceeds %d characters)", ualert.UIDMaxLength)
	}

	return &apimodels.InhibitionRule{
		Name:        name,
		InhibitRule: rule,
		Provenance:  provenance,
	}, nil
}
