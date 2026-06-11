package v1

import (
	"errors"
	"fmt"
	"hash/fnv"
	"maps"
	"slices"

	"github.com/grafana/alerting/definition"
	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func ToModel(in *definitions.PostableUserConfig) *AMConfigV1 {
	if in == nil {
		return nil
	}
	return &AMConfigV1{
		Templates:          TemplateFilesToTemplates(in.TemplateFiles, TemplateKindGrafana),
		InhibitionRules:    InhibitionRulesToModel(in.ManagedInhibitionRules),
		AlertmanagerConfig: PostableApiAlertingConfigToModel(in.AlertmanagerConfig),
		ExtraConfigs:       ExtraConfigsToModel(in.ExtraConfigs),
		ManagedRoutes:      ManagedRoutesToModel(in.ManagedRoutes),
	}
}

func PostableApiAlertingConfigToModel(in definition.PostableApiAlertingConfig) PostableApiAlertingConfig {
	return PostableApiAlertingConfig{
		Config: Config{
			Global:            in.Global,
			Route:             RouteToModel(in.Route),
			InhibitRules:      slices.Clone(in.InhibitRules),
			Templates:         slices.Clone(in.Templates),
			MuteTimeIntervals: MuteTimeIntervalsToModel(in.MuteTimeIntervals),
			TimeIntervals:     TimeIntervalsToModel(in.TimeIntervals),
		},
		Receivers: ReceiversToModel(in.Receivers),
	}
}

func MuteTimeIntervalsToModel(in []config.MuteTimeInterval) []MuteTimeInterval {
	if in == nil {
		return nil
	}
	out := make([]MuteTimeInterval, 0, len(in))
	for _, interval := range in {
		out = append(out, MuteTimeInterval{
			Name:          interval.Name,
			TimeIntervals: interval.TimeIntervals,
		})
	}
	return out
}

func TimeIntervalsToModel(in []config.TimeInterval) []TimeInterval {
	if in == nil {
		return nil
	}
	out := make([]TimeInterval, 0, len(in))
	for _, interval := range in {
		out = append(out, TimeInterval{
			Name:          interval.Name,
			TimeIntervals: interval.TimeIntervals,
		})
	}
	return out
}

func ReceiversToModel(in []*definition.PostableApiReceiver) []*PostableApiReceiver {
	if in == nil {
		return nil
	}
	out := make([]*PostableApiReceiver, 0, len(in))
	for _, receiver := range in {
		out = append(out, PostableApiReceiverToModel(receiver))
	}
	return out
}

func PostableApiReceiverToModel(in *definition.PostableApiReceiver) *PostableApiReceiver {
	if in == nil {
		return nil
	}
	return &PostableApiReceiver{
		Receiver: in.Receiver,
		PostableGrafanaReceivers: PostableGrafanaReceivers{
			GrafanaManagedReceivers: PostableGrafanaReceiversToModel(in.GrafanaManagedReceivers),
		},
	}
}

func PostableGrafanaReceiversToModel(in []*definition.PostableGrafanaReceiver) []*PostableGrafanaReceiver {
	if in == nil {
		return nil
	}
	out := make([]*PostableGrafanaReceiver, 0, len(in))
	for _, receiver := range in {
		out = append(out, new(PostableGrafanaReceiver(*receiver)))
	}
	return out
}

func ManagedRoutesToModel(in map[string]*definition.Route) ManagedRoutes {
	if in == nil {
		return nil
	}
	routes := make(map[string]*Route, len(in))
	for name, route := range in {
		routes[name] = RouteToModel(route)
	}
	return routes
}

func RouteToModel(in *definition.Route) *Route {
	if in == nil {
		return nil
	}
	out := Route{
		Receiver:            in.Receiver,
		GroupByStr:          slices.Clone(in.GroupByStr),
		GroupBy:             slices.Clone(in.GroupBy),
		GroupByAll:          in.GroupByAll,
		Match:               maps.Clone(in.Match),
		MatchRE:             maps.Clone(in.MatchRE),
		Matchers:            slices.Clone(in.Matchers),
		ObjectMatchers:      ObjectMatchersToModel(in.ObjectMatchers),
		MuteTimeIntervals:   slices.Clone(in.MuteTimeIntervals),
		ActiveTimeIntervals: slices.Clone(in.ActiveTimeIntervals),
		Continue:            in.Continue,
		GroupWait:           in.GroupWait,
		GroupInterval:       in.GroupInterval,
		RepeatInterval:      in.RepeatInterval,
		Provenance:          Provenance(in.Provenance),
	}

	if in.Routes != nil {
		out.Routes = make([]*Route, 0, len(in.Routes))
		for _, r := range in.Routes {
			out.Routes = append(out.Routes, RouteToModel(r))
		}
	}

	return &out
}

func ObjectMatchersToModel(in definitions.ObjectMatchers) ObjectMatchers {
	if in == nil {
		return nil
	}
	return ObjectMatchers(slices.Clone(in))
}

func InhibitionRulesToModel(in definitions.ManagedInhibitionRules) map[ResourceUID]InhibitionRule {
	if in == nil {
		return nil
	}
	out := make(map[ResourceUID]InhibitionRule, len(in))
	for _, ir := range in {
		if ir == nil {
			continue
		}
		m := InhibitionRuleToModel(*ir)
		out[m.UID] = m
	}
	return out
}

func InhibitionRuleToModel(in definitions.InhibitionRule) InhibitionRule {
	return NewInhibitionRule(in.Name, MatchersToModel(in.SourceMatchers), MatchersToModel(in.TargetMatchers), in.Equal, models.Provenance(in.Provenance))
}

func MatchersToModel(in config.Matchers) []Matcher {
	out := make([]Matcher, 0, len(in))
	for _, m := range in {
		if m == nil {
			continue
		}
		out = append(out, Matcher{Type: MatcherType(m.Type.String()), Label: m.Name, Value: m.Value})
	}
	return out
}

func ExtraConfigsToModel(in []definitions.ExtraConfiguration) []ExtraConfiguration {
	if in == nil {
		return nil
	}
	out := make([]ExtraConfiguration, len(in))
	for i, cfg := range in {
		out[i] = ExtraConfigToModel(cfg)
	}
	return out
}

func ExtraConfigToModel(in definitions.ExtraConfiguration) ExtraConfiguration {
	return ExtraConfiguration{
		Identifier:         in.Identifier,
		TemplateFiles:      maps.Clone(in.TemplateFiles),
		AlertmanagerConfig: in.AlertmanagerConfig,
	}
}

// -----------------

func ToDBModel(in *AMConfigV1) (*AMConfigDB, error) {
	if in == nil {
		return nil, nil
	}
	dbModel := AMConfigDB{
		TemplateFiles:      TemplatesToTemplateFiles(in.Templates),
		AlertmanagerConfig: PostableApiAlertingConfigToDB(in.AlertmanagerConfig),
		ExtraConfigs:       ExtraConfigsToDB(in.ExtraConfigs),
		ManagedRoutes:      ManagedRoutesToDB(in.ManagedRoutes),
	}

	var errs []error
	var err error
	dbModel.ManagedInhibitionRules, err = InhibitionRulesToDB(in.InhibitionRules)
	if err != nil {
		errs = append(errs, err)
	}

	return &dbModel, errors.Join(errs...)
}

func PostableApiAlertingConfigToDB(in PostableApiAlertingConfig) definition.PostableApiAlertingConfig {
	return definition.PostableApiAlertingConfig{
		Config: definition.Config{
			Global:            in.Global,
			Route:             RouteToDB(in.Route),
			InhibitRules:      slices.Clone(in.InhibitRules),
			Templates:         slices.Clone(in.Templates),
			MuteTimeIntervals: MuteTimeIntervalsToDB(in.MuteTimeIntervals),
			TimeIntervals:     TimeIntervalsToDB(in.TimeIntervals),
		},
		Receivers: ReceiversToDB(in.Receivers),
	}
}

func MuteTimeIntervalsToDB(in []MuteTimeInterval) []config.MuteTimeInterval {
	if in == nil {
		return nil
	}
	out := make([]config.MuteTimeInterval, 0, len(in))
	for _, interval := range in {
		out = append(out, config.MuteTimeInterval{
			Name:          interval.Name,
			TimeIntervals: interval.TimeIntervals,
		})
	}
	return out
}

func TimeIntervalsToDB(in []TimeInterval) []config.TimeInterval {
	if in == nil {
		return nil
	}
	out := make([]config.TimeInterval, 0, len(in))
	for _, interval := range in {
		out = append(out, config.TimeInterval{
			Name:          interval.Name,
			TimeIntervals: interval.TimeIntervals,
		})
	}
	return out
}

func ReceiversToDB(in []*PostableApiReceiver) []*definition.PostableApiReceiver {
	if in == nil {
		return nil
	}
	out := make([]*definition.PostableApiReceiver, 0, len(in))
	for _, receiver := range in {
		out = append(out, PostableApiReceiverToDB(receiver))
	}
	return out
}

func PostableApiReceiverToDB(in *PostableApiReceiver) *definition.PostableApiReceiver {
	if in == nil {
		return nil
	}
	return &definition.PostableApiReceiver{
		Receiver: in.Receiver,
		PostableGrafanaReceivers: definition.PostableGrafanaReceivers{
			GrafanaManagedReceivers: PostableGrafanaReceiversToDB(in.GrafanaManagedReceivers),
		},
	}
}

func PostableGrafanaReceiversToDB(in []*PostableGrafanaReceiver) []*definition.PostableGrafanaReceiver {
	if in == nil {
		return nil
	}
	out := make([]*definition.PostableGrafanaReceiver, 0, len(in))
	for _, receiver := range in {
		out = append(out, new(definition.PostableGrafanaReceiver(*receiver)))
	}
	return out
}

func ManagedRoutesToDB(in map[string]*Route) definitions.ManagedRoutes {
	if in == nil {
		return nil
	}
	routes := make(definitions.ManagedRoutes, len(in))
	for name, route := range in {
		routes[name] = RouteToDB(route)
	}
	return routes
}

func RouteToDB(in *Route) *definition.Route {
	if in == nil {
		return nil
	}
	out := definition.Route{
		Receiver:            in.Receiver,
		GroupByStr:          slices.Clone(in.GroupByStr),
		GroupBy:             slices.Clone(in.GroupBy),
		GroupByAll:          in.GroupByAll,
		Match:               maps.Clone(in.Match),
		MatchRE:             maps.Clone(in.MatchRE),
		Matchers:            slices.Clone(in.Matchers),
		ObjectMatchers:      ObjectMatchersToDB(in.ObjectMatchers),
		MuteTimeIntervals:   slices.Clone(in.MuteTimeIntervals),
		ActiveTimeIntervals: slices.Clone(in.ActiveTimeIntervals),
		Continue:            in.Continue,
		GroupWait:           in.GroupWait,
		GroupInterval:       in.GroupInterval,
		RepeatInterval:      in.RepeatInterval,
		Provenance:          definition.Provenance(in.Provenance),
	}

	if in.Routes != nil {
		out.Routes = make([]*definition.Route, 0, len(in.Routes))
		for _, r := range in.Routes {
			out.Routes = append(out.Routes, RouteToDB(r))
		}
	}

	return &out
}

func ObjectMatchersToDB(in ObjectMatchers) definitions.ObjectMatchers {
	if in == nil {
		return nil
	}
	return definitions.ObjectMatchers(slices.Clone(in))
}

func InhibitionRulesToDB(in map[ResourceUID]InhibitionRule) (definitions.ManagedInhibitionRules, error) {
	if in == nil {
		return nil, nil
	}
	var errs []error
	out := make(definitions.ManagedInhibitionRules, len(in))
	for _, ir := range in {
		m, err := InhibitionRuleToDB(ir)
		if err != nil {
			errs = append(errs, err)
		}
		out[m.Name] = m
	}
	return out, errors.Join(errs...)
}

func InhibitionRuleToDB(in InhibitionRule) (*definitions.InhibitionRule, error) {
	var errs []error

	sourceMatchers, err := MatchersToDB(in.SourceMatchers)
	if err != nil {
		errs = append(errs, fmt.Errorf("invalid source matchers: %w", err))
	}
	targetMatchers, err := MatchersToDB(in.TargetMatchers)
	if err != nil {
		errs = append(errs, fmt.Errorf("invalid target matchers: %w", err))
	}
	return &definitions.InhibitionRule{
		Name: string(in.UID),
		InhibitRule: definitions.InhibitRule{
			SourceMatchers: sourceMatchers,
			TargetMatchers: targetMatchers,
			Equal:          slices.Clone(in.Equal),
		},
		Provenance: definition.Provenance(in.Provenance),
	}, errors.Join(errs...)
}

func MatchersToDB(in []Matcher) (config.Matchers, error) {
	if len(in) == 0 {
		return nil, nil
	}

	var errs []error
	result := make(config.Matchers, 0, len(in))
	for _, m := range in {
		matchType, err := MatcherTypeToDB(m.Type)
		if err != nil {
			errs = append(errs, fmt.Errorf("invalid matcher (label=%s, type=%s, value=%s): %w", m.Label, m.Type, m.Value, err))
		}
		matcher, err := labels.NewMatcher(matchType, m.Label, m.Value)
		if err != nil {
			// Try to recover by using the default match type, could be useful in the future if we want to ignore certain compat errors without losing data.
			matcher = &labels.Matcher{
				Type:  matchType,
				Name:  m.Label,
				Value: m.Value,
			}
			errs = append(errs, fmt.Errorf("invalid matcher (label=%s, type=%s, value=%s): %w", m.Label, m.Type, m.Value, err))
		}
		result = append(result, matcher)
	}
	return result, errors.Join(errs...)
}

func MatcherTypeToDB(mType MatcherType) (labels.MatchType, error) {
	switch mType {
	case MatcherEqual:
		return labels.MatchEqual, nil
	case MatcherNotEqual:
		return labels.MatchNotEqual, nil
	case MatcherEqualRegex:
		return labels.MatchRegexp, nil
	case MatcherNotEqualRegex:
		return labels.MatchNotRegexp, nil
	default:
		return labels.MatchEqual, models.MakeErrInhibitionRuleInvalid(fmt.Errorf("unknown matcher type: %s", mType))
	}
}

func ExtraConfigsToDB(in []ExtraConfiguration) []definitions.ExtraConfiguration {
	if in == nil {
		return nil
	}
	out := make([]definitions.ExtraConfiguration, len(in))
	for i, cfg := range in {
		out[i] = ExtraConfigToDB(cfg)
	}
	return out
}

func ExtraConfigToDB(in ExtraConfiguration) definitions.ExtraConfiguration {
	return definitions.ExtraConfiguration{
		Identifier:         in.Identifier,
		TemplateFiles:      maps.Clone(in.TemplateFiles),
		AlertmanagerConfig: in.AlertmanagerConfig,
	}
}

// PostableMimirReceiverToPostableGrafanaReceiver converts all legacy models to PostableGrafanaReceiver.
// If receiver does not have any legacy receivers, returns the original receiver.
// Otherwise, returns a copy that contains converted integrations (and shallow copy of existing Grafana integrations).
func PostableMimirReceiverToPostableGrafanaReceiver(r *PostableApiReceiver) (*PostableApiReceiver, error) {
	if !r.HasMimirIntegrations() {
		return r, nil
	}
	v0, err := alertingNotify.ConfigReceiverToMimirIntegrations(r.Receiver)
	if err != nil {
		return nil, fmt.Errorf("failed to convert v0 receiver to integrations: %w", err)
	}
	result := &PostableApiReceiver{
		Receiver: definition.Receiver{
			Name: r.Name,
		},
		PostableGrafanaReceivers: PostableGrafanaReceivers{
			GrafanaManagedReceivers: make([]*PostableGrafanaReceiver, 0, len(v0)+len(r.GrafanaManagedReceivers)),
		},
	}
	result.GrafanaManagedReceivers = append(result.GrafanaManagedReceivers, r.GrafanaManagedReceivers...)
	typeCount := make(map[string]int)
	for _, cfg := range v0 {
		integrationType := string(cfg.Schema.Type())
		idx := typeCount[integrationType]
		typeCount[integrationType]++
		integration, err := MimirIntegrationConfigToPostableGrafanaReceiver(cfg, r.Name, idx)
		if err != nil {
			return nil, fmt.Errorf("failed to convert Mimir integration config to PostableGrafanaReceiver: %w", err)
		}
		result.GrafanaManagedReceivers = append(result.GrafanaManagedReceivers, integration)
	}
	return result, nil
}

// MimirIntegrationConfigToPostableGrafanaReceiver converts a Mimir integration configuration to a PostableGrafanaReceiver. All settings are unencrypted. Needs to be encrypted later.
func MimirIntegrationConfigToPostableGrafanaReceiver(cfg alertingNotify.MimirIntegrationConfig, receiverName string, idx int) (*PostableGrafanaReceiver, error) {
	raw, err := cfg.ConfigJSON()
	if err != nil {
		return nil, err
	}

	return &PostableGrafanaReceiver{
		// mimirIntegrationUID generates a stable, fixed-length UID for a converted Mimir integration that passes ValidateUID, 40-char limit for long names in particular
		UID:                   mimirIntegrationUID(receiverName, string(cfg.Schema.Type()), idx),
		Name:                  receiverName,
		Type:                  string(cfg.Schema.Type()),
		Version:               string(cfg.Schema.Version),
		DisableResolveMessage: false, // V0 ignores this flag as they have their own SendResolved one.
		Settings:              raw,
		SecureSettings:        nil,
	}, nil
}

func mimirIntegrationUID(receiverName string, integrationType string, idx int) string {
	h := fnv.New64a()
	_, _ = fmt.Fprintf(h, "%s-%s-%d", receiverName, integrationType, idx)
	return fmt.Sprintf("%016x", h.Sum64())
}
