package store

import (
	"encoding/json"
	"errors"
	"fmt"

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
	ManagedRoutes          ManagedRoutesDB                  `yaml:"managed_routes,omitempty" json:"managed_routes,omitempty"`
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

	return nil
}

// ManagedRoutesDB is the persisted "managed_routes" map. Unmarshalling calls each Route's own
// Validate and populates GroupBy/GroupByAll.
type ManagedRoutesDB map[string]*definition.Route

func (mr *ManagedRoutesDB) UnmarshalYAML(unmarshal func(interface{}) error) error {
	type plain ManagedRoutesDB
	if err := unmarshal((*plain)(mr)); err != nil {
		return err
	}
	return nil
}

func (mr *ManagedRoutesDB) UnmarshalJSON(b []byte) error {
	// Divert to the yaml unmarshaller as downstream Routes only define UnmarshalYAML.
	return yaml.Unmarshal(b, &mr)
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
// wrapper types instead, so a `uid` field can be added to them later without touching the
// shared/upstream types.
//
// Global and the legacy top-level Templates (template file names, distinct from
// TemplateFiles/ManagedTemplates) are intentionally not here: Grafana never applies either when
// building the config actually handed to the running Alertmanager.
type AlertingConfigDB struct {
	Route             *definition.Route    `yaml:"route,omitempty" json:"route,omitempty"`
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
	if err := a.Route.Validate(); err != nil {
		return err
	}
	for _, r := range a.InhibitRules {
		if err := validateInhibitRuleLabelNames(r.SourceMatch, r.TargetMatch, r.Equal); err != nil {
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
	for _, receiver := range definition.AllReceivers(a.Route.AsAMRoute()) {
		if _, ok := receivers[receiver]; !ok {
			return fmt.Errorf("unexpected receiver (%s) is undefined", receiver)
		}
	}

	return nil
}

// checkTimeInterval is a copy of the unexported function of the same name in
// github.com/grafana/alerting/definition (alertmanager.go).
func checkTimeInterval(r *definition.Route, timeIntervals map[string]struct{}) error {
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
	Name                    string                                `json:"name" yaml:"name"`
	GrafanaManagedReceivers []*definition.PostableGrafanaReceiver `yaml:"grafana_managed_receiver_configs,omitempty" json:"grafana_managed_receiver_configs,omitempty"`
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
// entry.
type TimeIntervalDB struct {
	Name          string                      `yaml:"name" json:"name"`
	TimeIntervals []timeinterval.TimeInterval `yaml:"time_intervals" json:"time_intervals"`
}
