package v1

import (
	"maps"
	"slices"

	"github.com/grafana/alerting/definition"
	"github.com/prometheus/alertmanager/config"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

func ToModel(in *definitions.PostableUserConfig) *AMConfigV1 {
	if in == nil {
		return nil
	}
	return &AMConfigV1{
		TemplateFiles:          maps.Clone(in.TemplateFiles),
		AlertmanagerConfig:     PostableApiAlertingConfigToModel(in.AlertmanagerConfig),
		ExtraConfigs:           ExtraConfigsToModel(in.ExtraConfigs),
		ManagedRoutes:          ManagedRoutesToModel(in.ManagedRoutes),
		ManagedInhibitionRules: ManagedInhibitionRulesToModel(in.ManagedInhibitionRules),
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

func ManagedInhibitionRulesToModel(in definitions.ManagedInhibitionRules) ManagedInhibitionRules {
	if in == nil {
		return nil
	}
	out := make(ManagedInhibitionRules, len(in))
	for k, ir := range in {
		out[k] = InhibitionRuleToModel(ir)
	}
	return out
}

func InhibitionRuleToModel(in *definitions.InhibitionRule) *InhibitionRule {
	if in == nil {
		return nil
	}
	return &InhibitionRule{
		Name:        in.Name,
		InhibitRule: in.InhibitRule,
		Provenance:  Provenance(in.Provenance),
	}
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

func ToDBModel(in *AMConfigV1) *AMConfigDB {
	if in == nil {
		return nil
	}
	return &AMConfigDB{
		TemplateFiles:          maps.Clone(in.TemplateFiles),
		AlertmanagerConfig:     PostableApiAlertingConfigToDB(in.AlertmanagerConfig),
		ExtraConfigs:           ExtraConfigsToDB(in.ExtraConfigs),
		ManagedRoutes:          ManagedRoutesToDB(in.ManagedRoutes),
		ManagedInhibitionRules: ManagedInhibitionRulesToDB(in.ManagedInhibitionRules),
	}
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

func ManagedInhibitionRulesToDB(in ManagedInhibitionRules) definitions.ManagedInhibitionRules {
	if in == nil {
		return nil
	}
	out := make(definitions.ManagedInhibitionRules, len(in))
	for k, ir := range in {
		out[k] = InhibitionRuleToDB(ir)
	}
	return out
}

func InhibitionRuleToDB(in *InhibitionRule) *definitions.InhibitionRule {
	if in == nil {
		return nil
	}
	return &definitions.InhibitionRule{
		Name:        in.Name,
		InhibitRule: in.InhibitRule,
		Provenance:  definition.Provenance(in.Provenance),
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
