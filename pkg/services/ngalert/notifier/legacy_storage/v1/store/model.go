package store

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/alerting/definition"
	"github.com/prometheus/alertmanager/config/common"
	amcompat "github.com/prometheus/alertmanager/matchers/compat"
	"github.com/prometheus/alertmanager/timeinterval"
	"github.com/prometheus/common/model"
	"go.yaml.in/yaml/v3"
)

// AMConfigDB is the persisted representation of the legacy Alertmanager configuration blob.
type AMConfigDB struct {
	TemplateFiles          map[string]string                `yaml:"template_files,omitempty" json:"template_files,omitempty"`
	ManagedTemplates       map[string]PostableApiTemplateDB `yaml:"managed_templates,omitempty" json:"managed_templates,omitempty"`
	AlertmanagerConfig     AlertingConfigDB                 `yaml:"alertmanager_config" json:"alertmanager_config"`
	ExtraConfigs           []ExtraConfigurationDB           `yaml:"extra_config,omitempty" json:"extra_config,omitempty"`
	ManagedRoutes          map[string]*ManagedRouteDB       `yaml:"managed_routes,omitempty" json:"managed_routes,omitempty"`
	ManagedInhibitionRules ManagedInhibitionRulesDB         `yaml:"managed_inhibition_rules,omitempty" json:"managed_inhibition_rules,omitempty"`
}

// PostableApiTemplateDB is the persisted representation of a managed template.
type PostableApiTemplateDB struct {
	Name    string `yaml:"name" json:"name"`
	Content string `yaml:"content" json:"content"`
	Kind    string `yaml:"kind" json:"kind"`
}

// ExtraConfigurationDB is the persisted representation of an imported (extra) Alertmanager
// configuration.
type ExtraConfigurationDB struct {
	Identifier         string            `yaml:"identifier" json:"identifier"`
	TemplateFiles      map[string]string `yaml:"template_files" json:"template_files"`
	AlertmanagerConfig string            `yaml:"alertmanager_config" json:"alertmanager_config"`
}

// UnmarshalJSON validates the route, the extra-config count, and every managed inhibition
// rule's label names.
func (c *AMConfigDB) UnmarshalJSON(b []byte) error {
	type plain AMConfigDB
	if err := json.Unmarshal(b, (*plain)(c)); err != nil {
		return err
	}

	if c.AlertmanagerConfig.Route == nil {
		return fmt.Errorf("no route provided in config")
	}
	if c.AlertmanagerConfig.Route.Continue {
		return fmt.Errorf("cannot have continue in root route")
	}
	if len(c.ExtraConfigs) > 1 {
		return errors.New("only one extra config is supported")
	}
	for _, ir := range c.ManagedInhibitionRules {
		if ir == nil {
			continue
		}
		// InhibitionRuleDB only has Equal to validate (no SourceMatch/TargetMatch).
		if err := validateInhibitRuleLabelNames(nil, nil, ir.Equal); err != nil {
			return err
		}
	}

	for _, r := range c.ManagedRoutes {
		if r == nil {
			continue
		}
		if err := r.validate(); err != nil {
			return err
		}
	}

	return nil
}

// ManagedRouteDB is the persisted representation of a managed routing tree. Like the default
// route it is the root of its own tree, so it only supports the fields a root can carry: no
// matchers, time intervals or continue.
type ManagedRouteDB struct {
	Receiver string `yaml:"receiver,omitempty" json:"receiver,omitempty"`

	GroupByStr []string   `yaml:"group_by,omitempty" json:"group_by,omitempty"`
	Routes     []*RouteDB `yaml:"routes,omitempty" json:"routes,omitempty"`

	GroupWait      *model.Duration `yaml:"group_wait,omitempty" json:"group_wait,omitempty"`
	GroupInterval  *model.Duration `yaml:"group_interval,omitempty" json:"group_interval,omitempty"`
	RepeatInterval *model.Duration `yaml:"repeat_interval,omitempty" json:"repeat_interval,omitempty"`

	Provenance string `yaml:"provenance,omitempty" json:"provenance,omitempty"`
}

// validate applies the root route checks that are relevant to the fields a managed route has.
func (r *ManagedRouteDB) validate() error {
	if len(r.Receiver) == 0 {
		return fmt.Errorf("root route must specify a default receiver")
	}
	if err := validateGrouping(r.Receiver, r.GroupByStr, r.GroupInterval, r.RepeatInterval); err != nil {
		return err
	}
	for _, child := range r.Routes {
		if err := child.validateChild(); err != nil {
			return err
		}
	}
	return nil
}

// RouteDB is the persisted representation of a routing tree node. The derived GroupBy/GroupByAll
// fields are not stored; they are computed from GroupByStr when converting to the domain model.
// ObjectMatchers stays a definition.ObjectMatchers because its (un)marshalling normalizes matchers.
type RouteDB struct {
	Receiver string `yaml:"receiver,omitempty" json:"receiver,omitempty"`

	GroupByStr          []string                  `yaml:"group_by,omitempty" json:"group_by,omitempty"`
	Match               map[string]string         `yaml:"match,omitempty" json:"match,omitempty"`
	MatchRE             common.MatchRegexps       `yaml:"match_re,omitempty" json:"match_re,omitempty"`
	Matchers            common.Matchers           `yaml:"matchers,omitempty" json:"matchers,omitempty"`
	ObjectMatchers      definition.ObjectMatchers `yaml:"object_matchers,omitempty" json:"object_matchers,omitempty"`
	MuteTimeIntervals   []string                  `yaml:"mute_time_intervals,omitempty" json:"mute_time_intervals,omitempty"`
	ActiveTimeIntervals []string                  `yaml:"active_time_intervals,omitempty" json:"active_time_intervals,omitempty"`
	Continue            bool                      `yaml:"continue" json:"continue,omitempty"`
	Routes              []*RouteDB                `yaml:"routes,omitempty" json:"routes,omitempty"`

	GroupWait      *model.Duration `yaml:"group_wait,omitempty" json:"group_wait,omitempty"`
	GroupInterval  *model.Duration `yaml:"group_interval,omitempty" json:"group_interval,omitempty"`
	RepeatInterval *model.Duration `yaml:"repeat_interval,omitempty" json:"repeat_interval,omitempty"`

	Provenance string `yaml:"provenance,omitempty" json:"provenance,omitempty"`
}

// UnmarshalJSON diverts to yaml.Unmarshal because common.MatchRegexps only validates its label
// names and regexps in UnmarshalYAML; plain JSON decoding would skip those checks.
func (r *RouteDB) UnmarshalJSON(b []byte) error {
	return yaml.Unmarshal(b, r)
}

// groupByAll is a special value defined by alertmanager that can be used in a route's group_by to
// aggregate by all possible labels.
const groupByAll = "..."

// validateGrouping holds the group_by and interval checks shared by every route type. It is a
// copy of the corresponding checks in definition.Route.ValidateChild.
func validateGrouping(receiver string, groupByStr []string, groupInterval, repeatInterval *model.Duration) error {
	var groupBy []model.LabelName
	hasAll := false
	for _, l := range groupByStr {
		if l == groupByAll {
			hasAll = true
		} else {
			groupBy = append(groupBy, model.LabelName(l))
		}
	}
	if len(groupBy) > 0 && hasAll {
		return fmt.Errorf("cannot have wildcard group_by (`...`) and other other labels at the same time")
	}
	seen := map[model.LabelName]struct{}{}
	for _, ln := range groupBy {
		if _, ok := seen[ln]; ok {
			return fmt.Errorf("duplicated label %q in group_by, %s %s", ln, receiver, groupBy)
		}
		seen[ln] = struct{}{}
	}

	if groupInterval != nil && time.Duration(*groupInterval) == time.Duration(0) {
		return fmt.Errorf("group_interval cannot be zero")
	}
	if repeatInterval != nil && time.Duration(*repeatInterval) == time.Duration(0) {
		return fmt.Errorf("repeat_interval cannot be zero")
	}
	return nil
}

// validateChild is a copy of definition.Route.ValidateChild
// (github.com/grafana/alerting/definition, alertmanager_validation.go), minus the GroupBy/GroupByAll
// normalization which RouteDB does not store.
func (r *RouteDB) validateChild() error {
	if err := validateGrouping(r.Receiver, r.GroupByStr, r.GroupInterval, r.RepeatInterval); err != nil {
		return err
	}

	for _, child := range r.Routes {
		if err := child.validateChild(); err != nil {
			return err
		}
	}
	return nil
}

// validate is a copy of definition.Route.Validate: the additional checks for a root route.
func (r *RouteDB) validate() error {
	if len(r.Receiver) == 0 {
		return fmt.Errorf("root route must specify a default receiver")
	}
	if len(r.Match) > 0 || len(r.MatchRE) > 0 || len(r.Matchers) > 0 || len(r.ObjectMatchers) > 0 {
		return fmt.Errorf("root route must not have any matchers")
	}
	if len(r.MuteTimeIntervals) > 0 {
		return fmt.Errorf("root route must not have any mute time intervals")
	}
	if len(r.ActiveTimeIntervals) > 0 {
		return fmt.Errorf("root route must not have any active time intervals")
	}
	return r.validateChild()
}

// allReceivers is a copy of definition.AllReceivers (github.com/grafana/alerting/definition,
// alertmanager.go) for RouteDB, minus its skipping of autogenerated routes (which are never
// persisted): it recursively returns every referenced receiver name.
func allReceivers(r *RouteDB) []string {
	if r == nil {
		return nil
	}
	var res []string
	if r.Receiver != "" {
		res = append(res, r.Receiver)
	}
	for _, sub := range r.Routes {
		res = append(res, allReceivers(sub)...)
	}
	return res
}

// ManagedInhibitionRulesDB is the persisted "managed_inhibition_rules" map.
type ManagedInhibitionRulesDB map[string]*InhibitionRuleDB

// InhibitionRuleDB is the persisted representation of a managed inhibition rule. Only a subset
// of config.InhibitRule's fields are here: SourceMatch/SourceMatchRE/TargetMatch/TargetMatchRE
// (the deprecated map/regex-based matchers) are not supported.
type InhibitionRuleDB struct {
	Name           string          `json:"name" yaml:"name"`
	SourceMatchers common.Matchers `yaml:"source_matchers,omitempty" json:"source_matchers,omitempty"`
	TargetMatchers common.Matchers `yaml:"target_matchers,omitempty" json:"target_matchers,omitempty"`
	Equal          []string        `yaml:"equal,omitempty" json:"equal,omitempty"`
	Provenance     string          `json:"provenance,omitempty"`
}

// AlertingConfigDB is the persisted "alertmanager_config" object. Route/InhibitRules reuse the
// shared Alertmanager types directly. Receivers and TimeIntervals/MuteTimeIntervals use DB-owned
// wrapper types instead: TimeIntervals already persists its own `uid` (TimeIntervalDB.UID);
// Receivers doesn't yet, but the wrapper type means one can be added later without touching the
// shared/upstream types.
//
// Global and the legacy top-level Templates (template file names, distinct from
// TemplateFiles/ManagedTemplates) are intentionally not here: Grafana never applies either when
// building the config actually handed to the running Alertmanager.
type AlertingConfigDB struct {
	Route             *RouteDB             `yaml:"route,omitempty" json:"route,omitempty"`
	InhibitRules      []common.InhibitRule `yaml:"inhibit_rules,omitempty" json:"inhibit_rules,omitempty"`
	MuteTimeIntervals []TimeIntervalDB     `yaml:"mute_time_intervals,omitempty" json:"mute_time_intervals,omitempty"`
	TimeIntervals     []TimeIntervalDB     `yaml:"time_intervals,omitempty" json:"time_intervals,omitempty"`
	Receivers         []*ReceiverDB        `yaml:"receivers,omitempty" json:"receivers,omitempty"`
}

// UnmarshalJSON decodes the object, then runs the same validation
// definition.PostableApiAlertingConfig's own unmarshal chain performs - copied here instead of
// delegated to it.
// Mirrors, in call order:
//   - definition.Config.UnmarshalYAML (github.com/grafana/alerting/definition, alertmanager.go)
//   - config.InhibitRule.UnmarshalYAML's validation, per rule (github.com/prometheus/alertmanager/config, config.go)
//   - definition.PostableApiAlertingConfig.Validate (github.com/grafana/alerting/definition, alertmanager.go)
func (a *AlertingConfigDB) UnmarshalJSON(b []byte) error {
	type plain AlertingConfigDB
	if err := json.Unmarshal(b, (*plain)(a)); err != nil {
		return err
	}

	// --- definition.Config.UnmarshalYAML ---
	if a.Route == nil {
		return fmt.Errorf("no routes provided")
	}
	if err := a.Route.validate(); err != nil {
		return err
	}
	for _, r := range a.InhibitRules {
		if err := validateInhibitRuleLabelNames(r.SourceMatch, r.TargetMatch, r.Equal); err != nil {
			return err
		}
		if err := validateMatchRegexps(r.SourceMatchRE); err != nil {
			return err
		}
		if err := validateMatchRegexps(r.TargetMatchRE); err != nil {
			return err
		}
	}
	tiNames := make(map[string]struct{})
	for _, mt := range a.MuteTimeIntervals {
		if mt.Name == "" {
			return fmt.Errorf("missing name in mute time interval")
		}
		if _, ok := tiNames[mt.Name]; ok {
			return fmt.Errorf("mute time interval %q is not unique", mt.Name)
		}
		tiNames[mt.Name] = struct{}{}
	}
	for _, ti := range a.TimeIntervals {
		if ti.Name == "" {
			return fmt.Errorf("missing name in time interval")
		}
		if _, ok := tiNames[ti.Name]; ok {
			return fmt.Errorf("time interval %q is not unique", ti.Name)
		}
		tiNames[ti.Name] = struct{}{}
	}
	if err := checkTimeInterval(a.Route, tiNames); err != nil {
		return err
	}

	// --- definition.PostableApiAlertingConfig.Validate ---
	receivers := make(map[string]struct{}, len(a.Receivers))
	for _, r := range a.Receivers {
		receivers[r.Name] = struct{}{}
	}
	if a.Route.Continue {
		return fmt.Errorf("cannot have continue in root route")
	}
	for _, receiver := range allReceivers(a.Route) {
		if _, ok := receivers[receiver]; !ok {
			return fmt.Errorf("unexpected receiver (%s) is undefined", receiver)
		}
	}

	return nil
}

// checkTimeInterval is a copy of the unexported function of the same name in
// github.com/grafana/alerting/definition (alertmanager.go).
func checkTimeInterval(r *RouteDB, timeIntervals map[string]struct{}) error {
	for _, mt := range r.MuteTimeIntervals {
		if _, ok := timeIntervals[mt]; !ok {
			return fmt.Errorf("undefined mute time interval %q used in route", mt)
		}
	}
	for _, mt := range r.ActiveTimeIntervals {
		if _, ok := timeIntervals[mt]; !ok {
			return fmt.Errorf("undefined active time interval %q used in route", mt)
		}
	}

	for _, sr := range r.Routes {
		if err := checkTimeInterval(sr, timeIntervals); err != nil {
			return err
		}
	}

	return nil
}

// validateMatchRegexps is a copy of the validation in common.MatchRegexps.UnmarshalYAML
// (github.com/prometheus/alertmanager/config/common, matchers.go).
func validateMatchRegexps(m common.MatchRegexps) error {
	for k, v := range m {
		if !model.LabelNameRE.MatchString(k) {
			return fmt.Errorf("invalid label name %q", k)
		}
		if v.Regexp == nil {
			return fmt.Errorf("invalid regexp value for %q", k)
		}
	}
	return nil
}

// validateInhibitRuleLabelNames is a copy of the validation half of config.InhibitRule's
// UnmarshalYAML in github.com/prometheus/alertmanager/config (config.go); decoding already
// populated the fields, this only re-checks label names. Takes the fields directly rather than a
// config.InhibitRule so it also works for InhibitionRuleDB.
func validateInhibitRuleLabelNames(sourceMatch, targetMatch map[string]string, equal []string) error {
	for k := range sourceMatch {
		if !model.LabelNameRE.MatchString(k) {
			return fmt.Errorf("invalid label name %q", k)
		}
	}
	for k := range targetMatch {
		if !model.LabelNameRE.MatchString(k) {
			return fmt.Errorf("invalid label name %q", k)
		}
	}
	for _, l := range equal {
		labelName := model.LabelName(l)
		if !amcompat.IsValidLabelName(labelName) {
			return fmt.Errorf("invalid label name %q in equal list", l)
		}
	}
	return nil
}

// ReceiverDB is the persisted representation of a receiver/contact point.
type ReceiverDB struct {
	Name                    string                       `json:"name" yaml:"name"`
	GrafanaManagedReceivers []*PostableGrafanaReceiverDB `yaml:"grafana_managed_receiver_configs,omitempty" json:"grafana_managed_receiver_configs,omitempty"`
}

// PostableGrafanaReceiverDB is the persisted representation of a receiver integration. Settings
// stays a definition.RawMessage because its YAML unmarshalling normalizes the stored JSON.
type PostableGrafanaReceiverDB struct {
	UID                   string                `json:"uid" yaml:"uid"`
	Name                  string                `json:"name" yaml:"name"`
	Type                  string                `json:"type" yaml:"type"`
	Version               string                `json:"version,omitempty" yaml:"version,omitempty"`
	DisableResolveMessage bool                  `json:"disableResolveMessage" yaml:"disableResolveMessage"`
	Settings              definition.RawMessage `json:"settings,omitempty" yaml:"settings,omitempty"`
	SecureSettings        map[string]string     `json:"secureSettings,omitempty" yaml:"secureSettings,omitempty"`
}

// UnmarshalJSON diverts to yaml.Unmarshal to keep legacy behaviour. It normalizes each
// integration's Settings as a side effect: definition.RawMessage's UnmarshalYAML decodes
// into a generic value and re-marshals it via encoding/json.
//
// We kept this normalization because Settings would otherwise decode byte-for-byte, which could
// change calculated fingerprints and remote AM config hashes. Worth investigating further and
// potentially removing.
func (r *ReceiverDB) UnmarshalJSON(b []byte) error {
	return yaml.Unmarshal(b, r)
}

// TimeIntervalDB is the persisted representation of a single "time_intervals"/"mute_time_intervals"
// entry. UID is omitempty for rows written before UID persistence existed; callers fall back to a
// name-derived UID for those.
type TimeIntervalDB struct {
	UID           string                      `yaml:"uid,omitempty" json:"uid,omitempty"`
	Name          string                      `yaml:"name" json:"name"`
	TimeIntervals []timeinterval.TimeInterval `yaml:"time_intervals" json:"time_intervals"`
}
