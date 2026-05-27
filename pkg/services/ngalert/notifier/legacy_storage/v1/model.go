package v1

import (
	"cmp"
	"errors"
	"fmt"
	"reflect"
	"slices"
	"time"

	"github.com/grafana/alerting/definition"
	"github.com/grafana/alerting/definition/compat"
	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/alertmanager/timeinterval"
	"github.com/prometheus/common/model"
	"go.yaml.in/yaml/v3"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type AMConfigDB = definitions.PostableUserConfig // TODO: Define type explicitly and move elsewhere.

// AMConfigV1 is an exact structural copy of PostableUserConfig without json tags.
type AMConfigV1 struct {
	Templates          map[ResourceUID]TemplateGroup
	InhibitionRules    map[ResourceUID]InhibitionRule
	AlertmanagerConfig PostableApiAlertingConfig
	ExtraConfigs       []ExtraConfiguration
	ManagedRoutes      ManagedRoutes
}

// SortedTemplates returns templates ordered by kind and title.
func (c *AMConfigV1) SortedTemplates(includeImported bool) []TemplateGroup {
	res := make([]TemplateGroup, 0, len(c.Templates))
	for _, t := range c.Templates {
		res = append(res, t)
	}

	if includeImported && len(c.ExtraConfigs) > 0 {
		for name, content := range c.ExtraConfigs[0].TemplateFiles {
			res = append(res, NewTemplateGroup(name, content, TemplateKindMimir, models.ProvenanceConvertedPrometheus)) // Provenance shouldn't be used regardless.
		}
	}

	return slices.SortedFunc(slices.Values(res), func(a TemplateGroup, b TemplateGroup) int {
		return cmp.Or(
			cmp.Compare(a.Kind, b.Kind),
			cmp.Compare(a.Title, b.Title),
		)
	})
}

// GetGrafanaReceiverMap returns a map that associates UUIDs to grafana receivers
func (c *AMConfigV1) GetGrafanaReceiverMap() map[string]*PostableGrafanaReceiver {
	UIDs := make(map[string]*PostableGrafanaReceiver)
	for _, r := range c.AlertmanagerConfig.Receivers {
		for _, gr := range r.GrafanaManagedReceivers {
			UIDs[gr.UID] = gr
		}
	}
	return UIDs
}

type ManagedRoutes map[string]*Route

type ExtraConfiguration struct {
	Identifier         string
	TemplateFiles      map[string]string
	AlertmanagerConfig string
}

// GetAlertmanagerConfig parses the stored Prometheus/Mimir alertmanager YAML and converts it
// to Grafana's PostableApiAlertingConfig, including route wrapping and receiver format conversion.
func (c *ExtraConfiguration) GetAlertmanagerConfig() (PostableApiAlertingConfig, error) {
	prometheusConfig, err := c.parsePrometheusConfig()
	if err != nil {
		return PostableApiAlertingConfig{}, err
	}
	cfg, _, err := alertmanagerConfigFromPrometheus(prometheusConfig)
	return cfg, err
}

// alertmanagerConfigFromPrometheus converts a parsed Prometheus/Mimir config to
// Grafana's PostableApiAlertingConfig. It also returns the intermediate
// definition-format receivers (index-aligned) so callers can reuse the conversion.
func alertmanagerConfigFromPrometheus(prometheusConfig config.Config) (PostableApiAlertingConfig, []definition.Receiver, error) {
	config := PostableApiAlertingConfig{
		Config: Config{
			Global:            prometheusConfig.Global,
			Route:             RouteToModel(definition.AsGrafanaRoute(prometheusConfig.Route)),
			InhibitRules:      prometheusConfig.InhibitRules,
			TimeIntervals:     TimeIntervalsToModel(prometheusConfig.TimeIntervals),
			MuteTimeIntervals: MuteTimeIntervalsToModel(prometheusConfig.MuteTimeIntervals),
			Templates:         prometheusConfig.Templates,
		},
		Receivers: make([]*PostableApiReceiver, 0, len(prometheusConfig.Receivers)),
	}
	defs := make([]definition.Receiver, 0, len(prometheusConfig.Receivers))
	for _, receiver := range prometheusConfig.Receivers {
		def := compat.UpstreamReceiverToDefinitionReceiver(receiver)
		defs = append(defs, def)
		grafana, err := PostableMimirReceiverToPostableGrafanaReceiver(&PostableApiReceiver{Receiver: def})
		if err != nil {
			return PostableApiAlertingConfig{}, nil, fmt.Errorf("failed to convert Mimir receiver %s to Grafana receiver: %w", def.Name, err)
		}
		config.Receivers = append(config.Receivers, grafana)
	}
	return config, defs, nil
}

func (c *ExtraConfiguration) parsePrometheusConfig() (config.Config, error) {
	if c.AlertmanagerConfig == "" {
		return config.Config{}, fmt.Errorf("no alertmanager configuration available")
	}

	var prometheusConfig config.Config
	if err := yaml.Unmarshal([]byte(c.AlertmanagerConfig), &prometheusConfig); err != nil {
		return config.Config{}, fmt.Errorf("failed to parse alertmanager config: %w", err)
	}

	return prometheusConfig, nil
}

// GetSanitizedAlertmanagerConfigYAML returns the alertmanager configuration as a YAML string
// with secrets masked and global settings removed for mimirtool compatibility.
func (c *ExtraConfiguration) GetSanitizedAlertmanagerConfigYAML() (string, error) {
	prometheusConfig, err := c.parsePrometheusConfig()
	if err != nil {
		return "", err
	}

	configYAML, err := yaml.Marshal(prometheusConfig)
	if err != nil {
		return "", fmt.Errorf("failed to marshal sanitized configuration: %w", err)
	}

	return string(configYAML), nil
}

func (c ExtraConfiguration) Validate() error {
	if c.Identifier == "" {
		return errors.New("identifier is required")
	}

	prometheusConfig, err := c.parsePrometheusConfig()
	if err != nil {
		return errInvalidExtraConfiguration(fmt.Errorf("failed to parse alertmanager config: %w", err))
	}

	cfg, defs, err := alertmanagerConfigFromPrometheus(prometheusConfig)
	if err != nil {
		return errInvalidExtraConfiguration(fmt.Errorf("failed to parse alertmanager config: %w", err))
	}

	// Reject fields Grafana can't represent (e.g. *_file / *_ref) that conversion
	// would silently drop. Collect across all receivers to report them at once.
	var unsupported []unsupportedReceiverFields
	for i, def := range defs {
		fields, err := findUnsupportedReceiverFields(prometheusConfig.Receivers[i], def)
		if err != nil {
			return errInvalidExtraConfiguration(err)
		}
		if len(fields) > 0 {
			unsupported = append(unsupported, unsupportedReceiverFields{Receiver: def.Name, Fields: fields})
		}
	}
	if len(unsupported) > 0 {
		return errUnsupportedReceiverFields(unsupported)
	}
	err = cfg.Validate()
	if err != nil {
		return errInvalidExtraConfiguration(fmt.Errorf("invalid alertmanager config: %w", err))
	}
	return nil
}

type PostableApiAlertingConfig struct {
	Config
	Receivers []*PostableApiReceiver
}

func (c *PostableApiAlertingConfig) GetReceivers() []*PostableApiReceiver {
	return c.Receivers
}

func (c *PostableApiAlertingConfig) GetMuteTimeIntervals() []MuteTimeInterval {
	return c.MuteTimeIntervals
}

func (c *PostableApiAlertingConfig) GetTimeIntervals() []TimeInterval { return c.TimeIntervals }

func (c *PostableApiAlertingConfig) GetRoute() *Route {
	return c.Route
}

// Validate ensures that the two routing trees use the correct receiver types.
func (c *PostableApiAlertingConfig) Validate() error {
	receivers := make(map[string]struct{}, len(c.Receivers))

	for _, r := range c.Receivers {
		receivers[r.Name] = struct{}{}
	}

	// Taken from https://github.com/prometheus/alertmanager/blob/14cbe6301c732658d6fe877ec55ad5b738abcf06/config/config.go#L171-L192
	// Check if we have a root route. We cannot check for it in the
	// UnmarshalYAML method because it won't be called if the input is empty
	// (e.g. the config file is empty or only contains whitespace).
	if c.Route == nil {
		return fmt.Errorf("no route provided in config")
	}

	// Check if continue in root route.
	if c.Route.Continue {
		return fmt.Errorf("cannot have continue in root route")
	}

	for _, receiver := range AllReceivers(c.Route) {
		_, ok := receivers[receiver]
		if !ok {
			return fmt.Errorf("unexpected receiver (%s) is undefined", receiver)
		}
	}

	return definition.ValidateAlertmanagerConfig(c)
}

// AllReceivers will recursively walk a routing tree and return a list of all the
// referenced receiver names.
func AllReceivers(route *Route) (res []string) {
	if route == nil {
		return res
	}

	if route.Receiver != "" {
		res = append(res, route.Receiver)
	}

	for _, subRoute := range route.Routes {
		res = append(res, AllReceivers(subRoute)...)
	}
	return res
}

type Config struct {
	Global       *config.GlobalConfig
	Route        *Route
	InhibitRules []config.InhibitRule

	// MuteTimeIntervals is deprecated and will be removed before Alertmanager 1.0.
	MuteTimeIntervals []MuteTimeInterval
	TimeIntervals     []TimeInterval
	Templates         []string
}

type ObjectMatchers labels.Matchers

type Route struct {
	Receiver string

	GroupByStr []string
	GroupBy    []model.LabelName
	GroupByAll bool

	// Deprecated. Remove before v1.0 release.
	Match map[string]string
	// Deprecated. Remove before v1.0 release.
	MatchRE             config.MatchRegexps
	Matchers            config.Matchers
	ObjectMatchers      ObjectMatchers
	MuteTimeIntervals   []string
	ActiveTimeIntervals []string
	Continue            bool
	Routes              []*Route

	GroupWait      *model.Duration
	GroupInterval  *model.Duration
	RepeatInterval *model.Duration

	Provenance Provenance
}

func (r *Route) AllMatchers() (config.Matchers, error) {
	matchers := make(config.Matchers, 0, len(r.Matchers)+len(r.ObjectMatchers)+len(r.Match)+len(r.MatchRE))
	for ln, lv := range r.Match {
		matcher, err := labels.NewMatcher(labels.MatchEqual, ln, lv)
		if err != nil {
			return nil, err
		}
		matchers = append(matchers, matcher)
	}
	for ln, lv := range r.MatchRE {
		matcher, err := labels.NewMatcher(labels.MatchRegexp, ln, lv.String())
		if err != nil {
			return nil, err
		}
		matchers = append(matchers, matcher)
	}
	matchers = append(matchers, append(r.Matchers, r.ObjectMatchers...)...)
	return matchers, nil
}

func (r *Route) ValidateChild() error {
	r.GroupBy = nil
	r.GroupByAll = false
	for _, l := range r.GroupByStr {
		if l == models.GroupByAll {
			r.GroupByAll = true
		} else {
			r.GroupBy = append(r.GroupBy, model.LabelName(l))
		}
	}

	if len(r.GroupBy) > 0 && r.GroupByAll {
		return fmt.Errorf("cannot have wildcard group_by (`...`) and other other labels at the same time")
	}

	groupBy := map[model.LabelName]struct{}{}
	for _, ln := range r.GroupBy {
		if _, ok := groupBy[ln]; ok {
			return fmt.Errorf("duplicated label %q in group_by, %s %s", ln, r.Receiver, r.GroupBy)
		}
		groupBy[ln] = struct{}{}
	}

	if r.GroupInterval != nil && time.Duration(*r.GroupInterval) == 0 {
		return fmt.Errorf("group_interval cannot be zero")
	}
	if r.RepeatInterval != nil && time.Duration(*r.RepeatInterval) == 0 {
		return fmt.Errorf("repeat_interval cannot be zero")
	}

	for _, child := range r.Routes {
		if err := child.ValidateChild(); err != nil {
			return err
		}
	}
	return nil
}

func (r *Route) Validate() error {
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
	return r.ValidateChild()
}

func (r *Route) ValidateReceivers(receivers map[string]struct{}) error {
	if _, exists := receivers[r.Receiver]; !exists {
		return fmt.Errorf("receiver '%s' does not exist", r.Receiver)
	}
	for _, children := range r.Routes {
		err := children.ValidateReceivers(receivers)
		if err != nil {
			return err
		}
	}
	return nil
}

// ValidateMuteTimes validates that all mute time intervals referenced by the route exist.
// TODO: Can be removed once grafana/grafan uses ValidateTimeIntervals instead.
func (r *Route) ValidateMuteTimes(timeIntervals map[string]struct{}) error {
	for _, name := range r.MuteTimeIntervals {
		if _, exists := timeIntervals[name]; !exists {
			return fmt.Errorf("mute time interval '%s' does not exist", name)
		}
	}
	for _, child := range r.Routes {
		err := child.ValidateMuteTimes(timeIntervals)
		if err != nil {
			return err
		}
	}
	return nil
}

// ValidateTimeIntervals checks that all time intervals referenced by the route exist in the provided map.
func (r *Route) ValidateTimeIntervals(timeIntervals map[string]struct{}) error {
	for _, name := range r.MuteTimeIntervals {
		if _, exists := timeIntervals[name]; !exists {
			return fmt.Errorf("mute time interval '%s' does not exist", name)
		}
	}
	for _, name := range r.ActiveTimeIntervals {
		if _, exists := timeIntervals[name]; !exists {
			return fmt.Errorf("active time interval '%s' does not exist", name)
		}
	}
	for _, child := range r.Routes {
		err := child.ValidateTimeIntervals(timeIntervals)
		if err != nil {
			return err
		}
	}
	return nil
}

func (r *Route) ResourceType() string {
	return "route"
}

func (r *Route) ResourceID() string {
	return ""
}

type Provenance string

type MuteTimeInterval struct {
	Name          string
	TimeIntervals []timeinterval.TimeInterval
}

func (mt *MuteTimeInterval) ResourceType() string {
	return "muteTimeInterval"
}

func (mt *MuteTimeInterval) ResourceID() string {
	return mt.Name
}

type TimeInterval struct {
	Name          string
	TimeIntervals []timeinterval.TimeInterval
}

type PostableApiReceiver struct {
	definition.Receiver
	PostableGrafanaReceivers
}

type PostableGrafanaReceivers struct {
	GrafanaManagedReceivers []*PostableGrafanaReceiver
}

type PostableGrafanaReceiver definition.PostableGrafanaReceiver

func (r *PostableApiReceiver) HasMimirIntegrations() bool {
	cpy := r.Receiver
	cpy.Name = ""
	return !reflect.ValueOf(cpy).IsZero()
}

func (r *PostableApiReceiver) HasGrafanaIntegrations() bool {
	return len(r.GrafanaManagedReceivers) > 0
}

func (r *PostableApiReceiver) GetName() string {
	return r.Name
}
