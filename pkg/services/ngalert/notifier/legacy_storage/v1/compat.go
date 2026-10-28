package v1

import (
	"errors"
	"fmt"
	"hash/fnv"
	"maps"
	"slices"

	"github.com/grafana/alerting/definition/compat"
	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/config/common"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1/store"
)

func ToModel(in *store.AMConfigDB) *AMConfigV1 {
	if in == nil {
		return nil
	}
	// Merge legacy TemplateFiles and new ManagedTemplates into the internal model.
	// ManagedTemplates entries overwrite TemplateFiles entries with the same UID (same name+kind).
	templates := TemplateFilesToTemplates(in.TemplateFiles, TemplateKindGrafana)
	if len(in.ManagedTemplates) > 0 {
		if templates == nil {
			templates = make(map[ResourceUID]TemplateGroup, len(in.ManagedTemplates))
		}
		maps.Copy(templates, ManagedTemplatesToTemplates(in.ManagedTemplates))
	}
	return &AMConfigV1{
		Templates:          templates,
		InhibitionRules:    InhibitionRulesToModel(in.ManagedInhibitionRules),
		TimeIntervals:      TimeIntervalsToModel(in.AlertmanagerConfig.MuteTimeIntervals, in.AlertmanagerConfig.TimeIntervals),
		Receivers:          ReceiversToModel(in.AlertmanagerConfig.Receivers),
		AlertmanagerConfig: PostableApiAlertingConfigToModel(in.AlertmanagerConfig),
		ExtraConfigs:       ExtraConfigsToModel(in.ExtraConfigs),
		ManagedRoutes:      ManagedRoutesToModel(in.ManagedRoutes),
	}
}

func PostableApiAlertingConfigToModel(in store.AlertingConfigDB) PostableApiAlertingConfig {
	return PostableApiAlertingConfig{
		Config: Config{
			Route:        RouteToModel(in.Route),
			InhibitRules: slices.Clone(in.InhibitRules),
		},
	}
}

func TimeIntervalsToModel(muteIntervals []store.TimeIntervalDB, timeIntervals []store.TimeIntervalDB) map[ResourceUID]TimeInterval {
	if muteIntervals == nil && timeIntervals == nil {
		return nil
	}
	// Fold the deprecated mute time intervals into time intervals. Merging both lists under one set
	// of UIDs is safe because Config rejects duplicate names across them at unmarshal time, so no
	// definition can silently overwrite another here.
	out := make(map[ResourceUID]TimeInterval, len(muteIntervals)+len(timeIntervals))
	for _, interval := range muteIntervals {
		ti := NewTimeInterval(interval.Name, interval.TimeIntervals, models.ProvenanceNone)
		out[ti.UID] = ti
	}
	for _, interval := range timeIntervals {
		ti := NewTimeInterval(interval.Name, interval.TimeIntervals, models.ProvenanceNone)
		out[ti.UID] = ti
	}
	return out
}

func ReceiversToModel(in []*store.ReceiverDB) map[ResourceUID]PostableApiReceiver {
	if in == nil {
		return nil
	}
	out := make(map[ResourceUID]PostableApiReceiver, len(in))
	for _, receiver := range in {
		if receiver == nil {
			continue
		}
		m := NewReceiver(receiver.Name, PostableGrafanaReceiverDBsToModel(receiver.GrafanaManagedReceivers), models.ProvenanceNone)
		out[m.UID] = m
	}
	return out
}

func PostableGrafanaReceiverDBsToModel(in []*store.PostableGrafanaReceiverDB) []*PostableGrafanaReceiver {
	if in == nil {
		return nil
	}
	out := make([]*PostableGrafanaReceiver, 0, len(in))
	for _, r := range in {
		out = append(out, &PostableGrafanaReceiver{
			UID:                   r.UID,
			Name:                  r.Name,
			Type:                  r.Type,
			Version:               r.Version,
			DisableResolveMessage: r.DisableResolveMessage,
			Settings:              slices.Clone(r.Settings),
			SecureSettings:        maps.Clone(r.SecureSettings),
		})
	}
	return out
}

func ManagedRoutesToModel(in map[string]*store.ManagedRouteDB) map[string]*Route {
	if in == nil {
		return nil
	}
	routes := make(map[string]*Route, len(in))
	for name, route := range in {
		routes[name] = ManagedRouteToModel(route)
	}
	return routes
}

// ManagedRouteToModel converts a persisted managed route into the domain model, computing the
// derived GroupBy/GroupByAll fields from GroupByStr.
func ManagedRouteToModel(in *store.ManagedRouteDB) *Route {
	if in == nil {
		return nil
	}
	out := Route{
		Receiver:       in.Receiver,
		GroupByStr:     slices.Clone(in.GroupByStr),
		GroupWait:      in.GroupWait,
		GroupInterval:  in.GroupInterval,
		RepeatInterval: in.RepeatInterval,
		Provenance:     Provenance(in.Provenance),
	}
	out.GroupBy, out.GroupByAll = splitGroupBy(in.GroupByStr)

	if in.Routes != nil {
		out.Routes = make([]*Route, 0, len(in.Routes))
		for _, r := range in.Routes {
			out.Routes = append(out.Routes, RouteToModel(r))
		}
	}

	return &out
}

// splitGroupBy derives Route.GroupBy/GroupByAll from the persisted group_by strings.
func splitGroupBy(groupByStr []string) (groupBy []model.LabelName, groupByAll bool) {
	for _, l := range groupByStr {
		if l == "..." {
			groupByAll = true
		} else {
			groupBy = append(groupBy, model.LabelName(l))
		}
	}
	return groupBy, groupByAll
}

// AMRouteToModel converts an upstream Alertmanager route into the domain model.
func AMRouteToModel(in *config.Route) *Route {
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
		MuteTimeIntervals:   slices.Clone(in.MuteTimeIntervals),
		ActiveTimeIntervals: slices.Clone(in.ActiveTimeIntervals),
		Continue:            in.Continue,
		GroupWait:           in.GroupWait,
		GroupInterval:       in.GroupInterval,
		RepeatInterval:      in.RepeatInterval,
	}

	out.Routes = make([]*Route, 0, len(in.Routes))
	for _, r := range in.Routes {
		out.Routes = append(out.Routes, AMRouteToModel(r))
	}

	return &out
}

// RouteToModel converts a persisted route into the domain model, computing the derived
// GroupBy/GroupByAll fields from GroupByStr.
func RouteToModel(in *store.RouteDB) *Route {
	if in == nil {
		return nil
	}
	out := Route{
		Receiver:            in.Receiver,
		GroupByStr:          slices.Clone(in.GroupByStr),
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
	out.GroupBy, out.GroupByAll = splitGroupBy(in.GroupByStr)

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

func InhibitionRulesToModel(in store.ManagedInhibitionRulesDB) map[ResourceUID]InhibitionRule {
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

func InhibitionRuleToModel(in store.InhibitionRuleDB) InhibitionRule {
	return NewInhibitionRule(in.Name, MatchersToModel(in.SourceMatchers), MatchersToModel(in.TargetMatchers), in.Equal, models.Provenance(in.Provenance))
}

func MatchersToModel(in common.Matchers) []Matcher {
	out := make([]Matcher, 0, len(in))
	for _, m := range in {
		if m == nil {
			continue
		}
		out = append(out, Matcher{Type: MatcherType(m.Type.String()), Label: m.Name, Value: m.Value})
	}
	return out
}

func ExtraConfigsToModel(in []store.ExtraConfigurationDB) []ExtraConfiguration {
	if in == nil {
		return nil
	}
	out := make([]ExtraConfiguration, len(in))
	for i, cfg := range in {
		out[i] = ExtraConfigToModel(cfg)
	}
	return out
}

func ExtraConfigToModel(in store.ExtraConfigurationDB) ExtraConfiguration {
	return ExtraConfiguration{
		Identifier:         in.Identifier,
		TemplateFiles:      maps.Clone(in.TemplateFiles),
		AlertmanagerConfig: in.AlertmanagerConfig,
	}
}

// -----------------

func ToDBModel(in *AMConfigV1) (*store.AMConfigDB, error) {
	if in == nil {
		return nil, nil
	}
	dbModel := store.AMConfigDB{
		ManagedTemplates: TemplatesToManagedTemplates(in.Templates),
		AlertmanagerConfig: store.AlertingConfigDB{
			Route:        RouteToDB(in.AlertmanagerConfig.Route),
			InhibitRules: slices.Clone(in.AlertmanagerConfig.InhibitRules),
			// This conversion can be lossy since we don't track whether the TimeInterval came from MuteTimeInterval or TimeInterval.
			TimeIntervals: TimeIntervalsToDB(in.SortedTimeIntervals()),
			Receivers:     ReceiversToDB(in.GetReceivers()),
		},
		ExtraConfigs:  ExtraConfigsToDB(in.ExtraConfigs),
		ManagedRoutes: ManagedRoutesToDB(in.ManagedRoutes),
	}

	var errs []error
	var err error
	dbModel.ManagedInhibitionRules, err = InhibitionRulesToDB(in.InhibitionRules)
	if err != nil {
		errs = append(errs, err)
	}

	return &dbModel, errors.Join(errs...)
}

// TimeIntervalsToDB converts the domain time intervals into the persisted DB shape.
func TimeIntervalsToDB(in []TimeInterval) []store.TimeIntervalDB {
	if len(in) == 0 {
		return nil
	}
	out := make([]store.TimeIntervalDB, 0, len(in))
	for _, interval := range in {
		out = append(out, store.TimeIntervalDB{
			Name:          interval.Title,
			TimeIntervals: interval.TimeIntervals,
		})
	}
	return out
}

// ReceiversToDB converts the domain receivers into the persisted DB shape.
func ReceiversToDB(in []*PostableApiReceiver) []*store.ReceiverDB {
	if in == nil {
		return nil
	}
	out := make([]*store.ReceiverDB, 0, len(in))
	for _, receiver := range in {
		out = append(out, PostableApiReceiverToDB(receiver))
	}
	return out
}

func PostableApiReceiverToDB(in *PostableApiReceiver) *store.ReceiverDB {
	if in == nil {
		return nil
	}
	return &store.ReceiverDB{
		Name:                    in.Name,
		GrafanaManagedReceivers: PostableGrafanaReceiversToDB(in.GrafanaManagedReceivers),
	}
}

func PostableGrafanaReceiversToDB(in []*PostableGrafanaReceiver) []*store.PostableGrafanaReceiverDB {
	if in == nil {
		return nil
	}
	out := make([]*store.PostableGrafanaReceiverDB, 0, len(in))
	for _, r := range in {
		out = append(out, &store.PostableGrafanaReceiverDB{
			UID:                   r.UID,
			Name:                  r.Name,
			Type:                  r.Type,
			Version:               r.Version,
			DisableResolveMessage: r.DisableResolveMessage,
			Settings:              slices.Clone(r.Settings),
			SecureSettings:        maps.Clone(r.SecureSettings),
		})
	}
	return out
}

func ManagedRoutesToDB(in map[string]*Route) map[string]*store.ManagedRouteDB {
	if in == nil {
		return nil
	}
	routes := make(map[string]*store.ManagedRouteDB, len(in))
	for name, route := range in {
		routes[name] = ManagedRouteToDB(route)
	}
	return routes
}

// ManagedRouteToDB converts a domain managed route into its persisted shape, which only holds the
// fields a managed (root) route supports.
func ManagedRouteToDB(in *Route) *store.ManagedRouteDB {
	if in == nil {
		return nil
	}
	out := store.ManagedRouteDB{
		Receiver:       in.Receiver,
		GroupByStr:     slices.Clone(in.GroupByStr),
		GroupWait:      in.GroupWait,
		GroupInterval:  in.GroupInterval,
		RepeatInterval: in.RepeatInterval,
		Provenance:     string(in.Provenance),
	}

	if in.Routes != nil {
		out.Routes = make([]*store.RouteDB, 0, len(in.Routes))
		for _, r := range in.Routes {
			out.Routes = append(out.Routes, RouteToDB(r))
		}
	}

	return &out
}

// RouteToDB converts a domain route into its persisted shape.
func RouteToDB(in *Route) *store.RouteDB {
	if in == nil {
		return nil
	}
	out := store.RouteDB{
		Receiver:            in.Receiver,
		GroupByStr:          slices.Clone(in.GroupByStr),
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
		Provenance:          string(in.Provenance),
	}

	if in.Routes != nil {
		out.Routes = make([]*store.RouteDB, 0, len(in.Routes))
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

func InhibitionRulesToDB(in map[ResourceUID]InhibitionRule) (store.ManagedInhibitionRulesDB, error) {
	if in == nil {
		return nil, nil
	}
	var errs []error
	out := make(store.ManagedInhibitionRulesDB, len(in))
	for _, ir := range in {
		m, err := InhibitionRuleToDB(ir)
		if err != nil {
			errs = append(errs, err)
		}
		out[m.Name] = m
	}
	return out, errors.Join(errs...)
}

func InhibitionRuleToDB(in InhibitionRule) (*store.InhibitionRuleDB, error) {
	var errs []error

	sourceMatchers, err := MatchersToDB(in.SourceMatchers)
	if err != nil {
		errs = append(errs, fmt.Errorf("invalid source matchers: %w", err))
	}
	targetMatchers, err := MatchersToDB(in.TargetMatchers)
	if err != nil {
		errs = append(errs, fmt.Errorf("invalid target matchers: %w", err))
	}
	return &store.InhibitionRuleDB{
		Name:           string(in.UID),
		SourceMatchers: sourceMatchers,
		TargetMatchers: targetMatchers,
		Equal:          slices.Clone(in.Equal),
		Provenance:     string(in.Provenance),
	}, errors.Join(errs...)
}

func MatchersToDB(in []Matcher) (common.Matchers, error) {
	if len(in) == 0 {
		return nil, nil
	}

	var errs []error
	result := make(common.Matchers, 0, len(in))
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

func ExtraConfigsToDB(in []ExtraConfiguration) []store.ExtraConfigurationDB {
	if in == nil {
		return nil
	}
	out := make([]store.ExtraConfigurationDB, len(in))
	for i, cfg := range in {
		out[i] = ExtraConfigToDB(cfg)
	}
	return out
}

func ExtraConfigToDB(in ExtraConfiguration) store.ExtraConfigurationDB {
	return store.ExtraConfigurationDB{
		Identifier:         in.Identifier,
		TemplateFiles:      maps.Clone(in.TemplateFiles),
		AlertmanagerConfig: in.AlertmanagerConfig,
	}
}

// PostableMimirReceiverToPostableGrafanaReceiver converts an upstream (Mimir) receiver into a
// receiver that carries the equivalent Grafana integrations. The result never contains legacy
// models, so callers do not need to convert again.
func PostableMimirReceiverToPostableGrafanaReceiver(r compat.Receiver) (*PostableApiReceiver, error) {
	v0, err := alertingNotify.ConfigReceiverToMimirIntegrations(r)
	if err != nil {
		return nil, fmt.Errorf("failed to convert v0 receiver to integrations: %w", err)
	}
	integrations := make([]*PostableGrafanaReceiver, 0, len(v0))
	typeCount := make(map[string]int)
	for _, cfg := range v0 {
		integrationType := string(cfg.Schema.Type())
		idx := typeCount[integrationType]
		typeCount[integrationType]++
		integration, err := MimirIntegrationConfigToPostableGrafanaReceiver(cfg, r.Name, idx)
		if err != nil {
			return nil, fmt.Errorf("failed to convert Mimir integration config to PostableGrafanaReceiver: %w", err)
		}
		integrations = append(integrations, integration)
	}
	return new(NewReceiver(r.Name, integrations, models.ProvenanceNone)), nil
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
