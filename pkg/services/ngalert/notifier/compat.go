package notifier

import (
	"encoding/json"
	"fmt"
	"maps"
	"slices"
	"strings"

	"github.com/grafana/alerting/definition"
	alertingModels "github.com/grafana/alerting/models"
	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/grafana/alerting/templates"
	"github.com/prometheus/alertmanager/config"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
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
		Type:                  i.Config.Type(),
		Version:               i.Config.Version,
		DisableResolveMessage: i.DisableResolveMessage,
		Settings:              raw,
		SecureSettings:        i.SecureSettings,
	}, nil
}

func PostableAPIConfigToNotificationsConfiguration(
	cfg v1.AMConfigV1,
	limits alertingNotify.DynamicLimits,
) (alertingNotify.NotificationsConfiguration, error) {
	receivers, err := ModelToAPIReceivers(cfg.AlertmanagerConfig.Receivers)
	if err != nil {
		return alertingNotify.NotificationsConfiguration{}, err
	}
	inhibitionRules, err := ModelToInhibitionRules(cfg.InhibitionRules)
	if err != nil {
		return alertingNotify.NotificationsConfiguration{}, err
	}
	return alertingNotify.NotificationsConfiguration{
		RoutingTree: RouteToAPI(cfg.AlertmanagerConfig.Route),
		// Unclear if we need to include inhibition rules from AlertmanagerConfig as historically they shouldn't have been supported, but for now we do to keep behaviour unchanged.
		InhibitRules:  append(inhibitionRules, cfg.AlertmanagerConfig.InhibitRules...),
		TimeIntervals: ModelToTimeIntervals(cfg.AlertmanagerConfig.TimeIntervals, cfg.AlertmanagerConfig.MuteTimeIntervals),
		Templates:     ModelToTemplateDefinitions(cfg.SortedTemplates(false)), // templates are already merged.
		Receivers:     receivers,
		Limits:        limits,
	}, nil
}

func ModelToAPIReceivers(recvs []*v1.PostableApiReceiver) ([]alertingModels.ReceiverConfig, error) {
	result := make([]alertingModels.ReceiverConfig, 0, len(recvs))
	for _, r := range recvs {
		recv, err := ModelToReceiverConfig(r)
		if err != nil {
			return nil, fmt.Errorf("invalid receiver %s: %w", r.Name, err)
		}
		result = append(result, recv)
	}
	return result, nil
}

func ModelToReceiverConfig(r *v1.PostableApiReceiver) (alertingModels.ReceiverConfig, error) {
	result := alertingModels.ReceiverConfig{
		Name:         r.Name,
		Integrations: make([]*alertingModels.IntegrationConfig, 0, len(r.GrafanaManagedReceivers)),
	}
	for idx, p := range r.GrafanaManagedReceivers {
		i, err := alertingNotify.PostableGrafanaReceiverToIntegrationConfig(new(definition.PostableGrafanaReceiver(*p)))
		if err != nil {
			return alertingModels.ReceiverConfig{}, fmt.Errorf("invalid integration at index %d: %w", idx, err)
		}
		result.Integrations = append(result.Integrations, i)
	}
	return result, nil
}

func ModelToTimeIntervals(in []v1.TimeInterval, mute []v1.MuteTimeInterval) []alertingNotify.TimeInterval {
	// go with mute intervals first, in the case of collision in the alertmanager, the last will will, which is expected behavior.
	out := make([]alertingNotify.TimeInterval, 0, len(in)+len(mute))
	for _, t := range mute {
		out = append(out, config.TimeInterval{
			Name:          t.Name,
			TimeIntervals: t.TimeIntervals,
		})
	}
	for _, t := range in {
		out = append(out, config.TimeInterval{
			Name:          t.Name,
			TimeIntervals: t.TimeIntervals,
		})
	}
	return out
}

func ModelToTemplateDefinitions(ts []v1.TemplateGroup) []templates.TemplateDefinition {
	defs := make([]templates.TemplateDefinition, 0, len(ts))
	for _, t := range ts {
		var kind templates.Kind
		switch t.Kind {
		case v1.TemplateKindGrafana:
			kind = templates.GrafanaKind
		case v1.TemplateKindMimir:
			kind = templates.MimirKind
		}
		defs = append(defs, templates.TemplateDefinition{
			Name:     t.Title,
			Template: t.Content,
			Kind:     kind,
		})
	}
	return defs
}

// ModelToInhibitionRules Converts inhibition rules to a consistently ordered slice of upstream inhibit rules.
func ModelToInhibitionRules(inhibitionRules map[v1.ResourceUID]v1.InhibitionRule) ([]config.InhibitRule, error) {
	if len(inhibitionRules) == 0 {
		return make([]config.InhibitRule, 0), nil
	}

	res := make([]config.InhibitRule, 0, len(inhibitionRules))
	for _, ir := range slices.SortedFunc(maps.Values(inhibitionRules), func(a v1.InhibitionRule, b v1.InhibitionRule) int {
		return strings.Compare(string(a.UID), string(b.UID))
	}) {
		apiDef, err := InhibitionRuleToAPI(ir)
		if err != nil {
			return nil, err
		}
		res = append(res, apiDef.InhibitRule)
	}

	return res, nil
}

// TODO: Temporary until DB model and API model separate. Doing it this way makes caller intent clearer.
var RouteToAPI = v1.RouteToDB
var PostableApiAlertingConfigToAPI = v1.PostableApiAlertingConfigToDB
var ExtraConfigsToAPI = v1.ExtraConfigsToDB
var InhibitionRuleToAPI = v1.InhibitionRuleToDB

func NotificationsConfigurationToPostableAPIConfig(config alertingNotify.NotificationsConfiguration) apimodels.PostableApiAlertingConfig {
	return apimodels.PostableApiAlertingConfig{
		Config: apimodels.Config{
			Global:        nil, // Grafana does not have global.
			Route:         config.RoutingTree,
			InhibitRules:  config.InhibitRules,
			TimeIntervals: config.TimeIntervals,
			Templates:     nil, // we do not use this.
		},
		Receivers: APIReceiversToPostableAPIReceivers(config.Receivers),
	}
}

func APIReceiversToPostableAPIReceivers(r []alertingModels.ReceiverConfig) []*definition.PostableApiReceiver {
	result := make([]*definition.PostableApiReceiver, 0, len(r))
	for _, receiver := range r {
		result = append(result, APIReceiverToPostableAPIReceiver(receiver))
	}
	return result
}

func APIReceiverToPostableAPIReceiver(r alertingModels.ReceiverConfig) *definition.PostableApiReceiver {
	receivers := make([]*definition.PostableGrafanaReceiver, 0, len(r.Integrations))
	for _, p := range r.Integrations {
		receivers = append(receivers, IntegrationConfigToPostableGrafanaReceiver(p))
	}

	return &definition.PostableApiReceiver{
		Receiver: definition.Receiver{Name: r.Name},
		PostableGrafanaReceivers: definition.PostableGrafanaReceivers{
			GrafanaManagedReceivers: receivers,
		},
	}
}

func IntegrationConfigToPostableGrafanaReceiver(r *alertingModels.IntegrationConfig) *definition.PostableGrafanaReceiver {
	return &definition.PostableGrafanaReceiver{
		UID:                   r.UID,
		Name:                  r.Name,
		Type:                  string(r.Type),
		Version:               string(r.Version),
		DisableResolveMessage: r.DisableResolveMessage,
		Settings:              definition.RawMessage(r.Settings),
		SecureSettings:        r.SecureSettings,
	}
}

// TemplateDefinitionToPostableAPITemplate converts a templates.TemplateDefinition to a definition.PostableApiTemplate
func TemplateDefinitionToPostableAPITemplate(t templates.TemplateDefinition) definition.PostableApiTemplate {
	var kind definition.TemplateKind
	switch t.Kind {
	case templates.GrafanaKind:
		kind = definition.GrafanaTemplateKind
	case templates.MimirKind:
		kind = definition.MimirTemplateKind
	}
	return definition.PostableApiTemplate{
		Name:    t.Name,
		Content: t.Template,
		Kind:    kind,
	}
}

func TemplateDefinitionsToPostableAPITemplates(ts []templates.TemplateDefinition) []definition.PostableApiTemplate {
	defs := make([]definition.PostableApiTemplate, 0, len(ts))
	for _, t := range ts {
		defs = append(defs, TemplateDefinitionToPostableAPITemplate(t))
	}
	return defs
}
