package definitions

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"reflect"
	"sort"
	"strings"
	"time"

	"github.com/go-openapi/strfmt"
	amv2 "github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/common/model"
	"gopkg.in/yaml.v3"

	"github.com/grafana/grafana/pkg/util"
)

// swagger:route POST /api/alertmanager/grafana/config/api/v1/alerts alertmanager RoutePostGrafanaAlertingConfig
//
// sets an Alerting config
//
//     Responses:
//       201: Ack
//       400: ValidationError

// swagger:route POST /api/alertmanager/{DatasourceUID}/config/api/v1/alerts alertmanager RoutePostAlertingConfig
//
// sets an Alerting config
//
//     Responses:
//       201: Ack
//       400: ValidationError
//       404: NotFound

// swagger:route GET /api/alertmanager/grafana/config/api/v1/alerts alertmanager RouteGetGrafanaAlertingConfig
//
// gets an Alerting config
//
//     Responses:
//       200: GettableUserConfig
//       400: ValidationError

// swagger:route GET /api/alertmanager/{DatasourceUID}/config/api/v1/alerts alertmanager RouteGetAlertingConfig
//
// gets an Alerting config
//
//     Responses:
//       200: GettableUserConfig
//       400: ValidationError
//       404: NotFound

// swagger:route GET /api/alertmanager/grafana/config/history alertmanager RouteGetGrafanaAlertingConfigHistory
//
// gets Alerting configurations that were successfully applied in the past
//
//     Responses:
//       200: GettableHistoricUserConfigs

// swagger:route DELETE /api/alertmanager/grafana/config/api/v1/alerts alertmanager RouteDeleteGrafanaAlertingConfig
//
// deletes the Alerting config for a tenant
//
//     Responses:
//       200: Ack
//       400: ValidationError

// swagger:route DELETE /api/alertmanager/{DatasourceUID}/config/api/v1/alerts alertmanager RouteDeleteAlertingConfig
//
// deletes the Alerting config for a tenant
//
//     Responses:
//       200: Ack
//       400: ValidationError
//       404: NotFound

// swagger:route GET /api/alertmanager/grafana/api/v2/status alertmanager RouteGetGrafanaAMStatus
//
// get alertmanager status and configuration
//
//     Responses:
//       200: GettableStatus
//       400: ValidationError

// swagger:route GET /api/alertmanager/{DatasourceUID}/api/v2/status alertmanager RouteGetAMStatus
//
// get alertmanager status and configuration
//
//     Responses:
//       200: GettableStatus
//       400: ValidationError
//       404: NotFound

// swagger:route GET /api/alertmanager/grafana/api/v2/alerts alertmanager RouteGetGrafanaAMAlerts
//
// get alertmanager alerts
//
//     Responses:
//       200: gettableAlerts
//       400: ValidationError

// swagger:route GET /api/alertmanager/{DatasourceUID}/api/v2/alerts alertmanager RouteGetAMAlerts
//
// get alertmanager alerts
//
//     Responses:
//       200: gettableAlerts
//       400: ValidationError
//       404: NotFound

// swagger:route POST /api/alertmanager/{DatasourceUID}/api/v2/alerts alertmanager RoutePostAMAlerts
//
// create alertmanager alerts
//
//     Responses:
//       200: Ack
//       400: ValidationError
//       404: NotFound

// swagger:route GET /api/alertmanager/grafana/api/v2/alerts/groups alertmanager RouteGetGrafanaAMAlertGroups
//
// get alertmanager alerts
//
//     Responses:
//       200: alertGroups
//       400: ValidationError

// swagger:route GET /api/alertmanager/{DatasourceUID}/api/v2/alerts/groups alertmanager RouteGetAMAlertGroups
//
// get alertmanager alerts
//
//     Responses:
//       200: alertGroups
//       400: ValidationError
//       404: NotFound

// swagger:route GET /api/alertmanager/grafana/config/api/v1/receivers alertmanager RouteGetGrafanaReceivers
//
// Get a list of all receivers
//
//     Responses:
//       200: receiversResponse

// swagger:route POST /api/alertmanager/grafana/config/api/v1/receivers/test alertmanager RoutePostTestGrafanaReceivers
//
// Test Grafana managed receivers without saving them.
//
//     Responses:
//
//       200: Ack
//       207: MultiStatus
//       400: ValidationError
//       403: PermissionDenied
//       404: NotFound
//       408: Failure
//       409: AlertManagerNotReady

// swagger:route GET /api/alertmanager/grafana/api/v2/silences alertmanager RouteGetGrafanaSilences
//
// get silences
//
//     Responses:
//       200: gettableSilences
//       400: ValidationError

// swagger:route GET /api/alertmanager/{DatasourceUID}/api/v2/silences alertmanager RouteGetSilences
//
// get silences
//
//     Responses:
//       200: gettableSilences
//       400: ValidationError
//       404: NotFound

// swagger:route POST /api/alertmanager/grafana/api/v2/silences alertmanager RouteCreateGrafanaSilence
//
// create silence
//
//     Responses:
//       201: postSilencesOKBody
//       400: ValidationError

// swagger:route POST /api/alertmanager/{DatasourceUID}/api/v2/silences alertmanager RouteCreateSilence
//
// create silence
//
//     Responses:
//       201: postSilencesOKBody
//       400: ValidationError
//       404: NotFound

// swagger:route GET /api/alertmanager/grafana/api/v2/silence/{SilenceId} alertmanager RouteGetGrafanaSilence
//
// get silence
//
//     Responses:
//       200: gettableSilence
//       400: ValidationError

// swagger:route GET /api/alertmanager/{DatasourceUID}/api/v2/silence/{SilenceId} alertmanager RouteGetSilence
//
// get silence
//
//     Responses:
//       200: gettableSilence
//       400: ValidationError
//       404: NotFound

// swagger:route DELETE /api/alertmanager/grafana/api/v2/silence/{SilenceId} alertmanager RouteDeleteGrafanaSilence
//
// delete silence
//
//     Responses:
//       200: Ack
//       400: ValidationError

// swagger:route DELETE /api/alertmanager/{DatasourceUID}/api/v2/silence/{SilenceId} alertmanager RouteDeleteSilence
//
// delete silence
//
//     Responses:
//       200: Ack
//       400: ValidationError
//       404: NotFound

// swagger:model
type PermissionDenied struct{}

// swagger:model
type AlertManagerNotReady struct{}

// swagger:model
type MultiStatus struct{}

// swagger:parameters RouteGetGrafanaAlertingConfigHistory
type RouteGetGrafanaAlertingConfigHistoryParams struct {
	// Limit response to n historic configurations.
	// in:query
	Limit int `json:"limit"`
}

// swagger:parameters RoutePostTestGrafanaReceivers
type TestReceiversConfigParams struct {
	// in:body
	Body TestReceiversConfigBodyParams
}

type TestReceiversConfigBodyParams struct {
	Alert     *TestReceiversConfigAlertParams `yaml:"alert,omitempty" json:"alert,omitempty"`
	Receivers []*PostableApiReceiver          `yaml:"receivers,omitempty" json:"receivers,omitempty"`
}

func (c *TestReceiversConfigBodyParams) ProcessConfig(encrypt EncryptFn) error {
	return processReceiverConfigs(c.Receivers, encrypt)
}

type TestReceiversConfigAlertParams struct {
	Annotations model.LabelSet `yaml:"annotations,omitempty" json:"annotations,omitempty"`
	Labels      model.LabelSet `yaml:"labels,omitempty" json:"labels,omitempty"`
}

// swagger:model
type TestReceiversResult struct {
	Alert      TestReceiversConfigAlertParams `json:"alert"`
	Receivers  []TestReceiverResult           `json:"receivers"`
	NotifiedAt time.Time                      `json:"notified_at"`
}

// swagger:model
type TestReceiverResult struct {
	Name    string                     `json:"name"`
	Configs []TestReceiverConfigResult `json:"grafana_managed_receiver_configs"`
}

// swagger:model
type TestReceiverConfigResult struct {
	Name   string `json:"name"`
	UID    string `json:"uid"`
	Status string `json:"status"`
	Error  string `json:"error,omitempty"`
}

// swagger:parameters RouteCreateSilence RouteCreateGrafanaSilence
type CreateSilenceParams struct {
	// in:body
	Silence PostableSilence
}

// swagger:parameters RouteGetSilence RouteDeleteSilence RouteGetGrafanaSilence RouteDeleteGrafanaSilence
type GetDeleteSilenceParams struct {
	// in:path
	SilenceId string
}

// swagger:parameters RouteGetSilences RouteGetGrafanaSilences
type GetSilencesParams struct {
	// in:query
	Filter []string `json:"filter"`
}

// swagger:model
type GettableStatus struct {
	// cluster
	// Required: true
	Cluster *amv2.ClusterStatus `json:"cluster"`

	// config
	// Required: true
	Config *PostableApiAlertingConfig `json:"config"`

	// uptime
	// Required: true
	// Format: date-time
	Uptime *strfmt.DateTime `json:"uptime"`

	// version info
	// Required: true
	VersionInfo *amv2.VersionInfo `json:"versionInfo"`
}

func (s *GettableStatus) UnmarshalJSON(b []byte) error {
	amStatus := amv2.AlertmanagerStatus{}
	if err := json.Unmarshal(b, &amStatus); err != nil {
		return err
	}

	c := config.Config{}
	if err := yaml.Unmarshal([]byte(*amStatus.Config.Original), &c); err != nil {
		return err
	}

	s.Cluster = amStatus.Cluster
	s.Config = &PostableApiAlertingConfig{Config: Config{
		Global:       c.Global,
		Route:        AsGrafanaRoute(c.Route),
		InhibitRules: c.InhibitRules,
		Templates:    c.Templates,
	}}
	s.Uptime = amStatus.Uptime
	s.VersionInfo = amStatus.VersionInfo

	type overrides struct {
		Receivers *[]*PostableApiReceiver `yaml:"receivers,omitempty" json:"receivers,omitempty"`
	}

	if err := yaml.Unmarshal([]byte(*amStatus.Config.Original), &overrides{Receivers: &s.Config.Receivers}); err != nil {
		return err
	}

	return nil
}

func NewGettableStatus(cfg *PostableApiAlertingConfig) *GettableStatus {
	// In Grafana, the only field we support is Config.
	cs := amv2.ClusterStatusStatusDisabled
	na := "N/A"
	return &GettableStatus{
		Cluster: &amv2.ClusterStatus{
			Status: &cs,
			Peers:  []*amv2.PeerStatus{},
		},
		VersionInfo: &amv2.VersionInfo{
			Branch:    &na,
			BuildDate: &na,
			BuildUser: &na,
			GoVersion: &na,
			Revision:  &na,
			Version:   &na,
		},
		Config: cfg,
	}
}

// swagger:model postableSilence
type PostableSilence = amv2.PostableSilence

// swagger:model postSilencesOKBody
type PostSilencesOKBody struct { // vendored from "github.com/prometheus/alertmanager/api/v2/restapi/operations/silence/PostSilencesOKBody" because import brings too many other things
	// silence ID
	SilenceID string `json:"silenceID,omitempty"`
}

// swagger:model gettableSilences
type GettableSilences = amv2.GettableSilences

// swagger:model gettableSilence
type GettableSilence = amv2.GettableSilence

// swagger:model gettableAlerts
type GettableAlerts = amv2.GettableAlerts

// swagger:model gettableAlert
type GettableAlert = amv2.GettableAlert

// swagger:model alertGroups
type AlertGroups = amv2.AlertGroups

// swagger:model alertGroup
type AlertGroup = amv2.AlertGroup

// swagger:model receiver
type Receiver = amv2.Receiver

// swagger:response receiversResponse
type ReceiversResponse struct {
	// in:body
	Body []amv2.Receiver
}

// swagger:model integration
type Integration = amv2.Integration

// swagger:parameters RouteGetAMAlerts RouteGetAMAlertGroups RouteGetGrafanaAMAlerts RouteGetGrafanaAMAlertGroups
type AlertsParams struct {

	// Show active alerts
	// in: query
	// required: false
	// default: true
	Active bool `json:"active"`

	// Show silenced alerts
	// in: query
	// required: false
	// default: true
	Silenced bool `json:"silenced"`

	// Show inhibited alerts
	// in: query
	// required: false
	// default: true
	Inhibited bool `json:"inhibited"`

	// A list of matchers to filter alerts by
	// in: query
	// required: false
	Matchers []string `json:"filter"`

	// A regex matching receivers to filter alerts by
	// in: query
	// required: false
	Receivers string `json:"receiver"`
}

// swagger:parameters RoutePostAMAlerts
type PostableAlerts struct {
	// in:body
	PostableAlerts []amv2.PostableAlert `yaml:"" json:""`
}

// swagger:parameters RoutePostAlertingConfig RoutePostGrafanaAlertingConfig
type BodyAlertingConfig struct {
	// in:body
	Body PostableUserConfig
}

// alertmanager routes
// swagger:parameters RoutePostAlertingConfig RouteGetAlertingConfig RouteDeleteAlertingConfig RouteGetAMStatus RouteGetAMAlerts RoutePostAMAlerts RouteGetAMAlertGroups RouteGetSilences RouteCreateSilence RouteGetSilence RouteDeleteSilence RoutePostAlertingConfig
// testing routes
// swagger:parameters RouteTestRuleConfig
// prom routes
// swagger:parameters RouteGetRuleStatuses RouteGetAlertStatuses
// ruler routes
// swagger:parameters RouteGetRulesConfig RoutePostNameRulesConfig RouteGetNamespaceRulesConfig RouteDeleteNamespaceRulesConfig RouteGetRulegGroupConfig RouteDeleteRuleGroupConfig
type DatasourceUIDReference struct {
	// DatasoureUID should be the datasource UID identifier
	// in:path
	DatasourceUID string
}

// swagger:model
type PostableUserConfig struct {
	TemplateFiles      map[string]string         `yaml:"template_files" json:"template_files"`
	AlertmanagerConfig PostableApiAlertingConfig `yaml:"alertmanager_config" json:"alertmanager_config"`
	amSimple           map[string]interface{}    `yaml:"-" json:"-"`
}

func (c *PostableUserConfig) UnmarshalJSON(b []byte) error {
	type plain PostableUserConfig
	if err := json.Unmarshal(b, (*plain)(c)); err != nil {
		return err
	}

	// validate first
	if err := c.validate(); err != nil {
		return err
	}

	type intermediate struct {
		AlertmanagerConfig map[string]interface{} `yaml:"alertmanager_config" json:"alertmanager_config"`
	}

	var tmp intermediate
	if err := json.Unmarshal(b, &tmp); err != nil {
		return err
	}
	// store the map[string]interface{} variant for re-encoding later without redaction
	c.amSimple = tmp.AlertmanagerConfig

	return nil
}

func (c *PostableUserConfig) validate() error {
	// Taken from https://github.com/prometheus/alertmanager/blob/master/config/config.go#L170-L191
	// Check if we have a root route. We cannot check for it in the
	// UnmarshalYAML method because it won't be called if the input is empty
	// (e.g. the config file is empty or only contains whitespace).
	if c.AlertmanagerConfig.Route == nil {
		return fmt.Errorf("no route provided in config")
	}

	// Check if continue in root route.
	if c.AlertmanagerConfig.Route.Continue {
		return fmt.Errorf("cannot have continue in root route")
	}

	return nil
}

// GetGrafanaReceiverMap returns a map that associates UUIDs to grafana receivers
func (c *PostableUserConfig) GetGrafanaReceiverMap() map[string]*PostableGrafanaReceiver {
	UIDs := make(map[string]*PostableGrafanaReceiver)
	for _, r := range c.AlertmanagerConfig.Receivers {
		switch r.Type() {
		case GrafanaReceiverType:
			for _, gr := range r.PostableGrafanaReceivers.GrafanaManagedReceivers {
				UIDs[gr.UID] = gr
			}
		default:
		}
	}
	return UIDs
}

// ProcessConfig parses grafana receivers, encrypts secrets and assigns UUIDs (if they are missing)
func (c *PostableUserConfig) ProcessConfig(encrypt EncryptFn) error {
	return processReceiverConfigs(c.AlertmanagerConfig.Receivers, encrypt)
}

// MarshalYAML implements yaml.Marshaller.
func (c *PostableUserConfig) MarshalYAML() (interface{}, error) {
	yml, err := yaml.Marshal(c.amSimple)
	if err != nil {
		return nil, err
	}
	// cortex/loki actually pass the AM config as a string.
	cortexPostableUserConfig := struct {
		TemplateFiles      map[string]string `yaml:"template_files" json:"template_files"`
		AlertmanagerConfig string            `yaml:"alertmanager_config" json:"alertmanager_config"`
	}{
		TemplateFiles:      c.TemplateFiles,
		AlertmanagerConfig: string(yml),
	}
	return cortexPostableUserConfig, nil
}

func (c *PostableUserConfig) UnmarshalYAML(value *yaml.Node) error {
	// cortex/loki actually pass the AM config as a string.
	type cortexPostableUserConfig struct {
		TemplateFiles      map[string]string `yaml:"template_files" json:"template_files"`
		AlertmanagerConfig string            `yaml:"alertmanager_config" json:"alertmanager_config"`
	}

	var tmp cortexPostableUserConfig

	if err := value.Decode(&tmp); err != nil {
		return err
	}

	if err := yaml.Unmarshal([]byte(tmp.AlertmanagerConfig), &c.AlertmanagerConfig); err != nil {
		return err
	}

	c.TemplateFiles = tmp.TemplateFiles
	return nil
}

type Provenance string

// swagger:model
type GettableUserConfig struct {
	TemplateFiles           map[string]string         `yaml:"template_files" json:"template_files"`
	TemplateFileProvenances map[string]Provenance     `yaml:"template_file_provenances,omitempty" json:"template_file_provenances,omitempty"`
	AlertmanagerConfig      GettableApiAlertingConfig `yaml:"alertmanager_config" json:"alertmanager_config"`

	// amSimple stores a map[string]interface of the decoded alertmanager config.
	// This enables circumventing the underlying alertmanager secret type
	// which redacts itself during encoding.
	amSimple map[string]interface{} `yaml:"-" json:"-"`
}

func (c *GettableUserConfig) UnmarshalYAML(value *yaml.Node) error {
	// cortex/loki actually pass the AM config as a string.
	type cortexGettableUserConfig struct {
		TemplateFiles      map[string]string `yaml:"template_files" json:"template_files"`
		AlertmanagerConfig string            `yaml:"alertmanager_config" json:"alertmanager_config"`
	}

	var tmp cortexGettableUserConfig

	if err := value.Decode(&tmp); err != nil {
		return err
	}

	if err := yaml.Unmarshal([]byte(tmp.AlertmanagerConfig), &c.AlertmanagerConfig); err != nil {
		return err
	}

	if err := yaml.Unmarshal([]byte(tmp.AlertmanagerConfig), &c.amSimple); err != nil {
		return err
	}

	c.TemplateFiles = tmp.TemplateFiles
	return nil
}

func (c *GettableUserConfig) MarshalJSON() ([]byte, error) {
	type plain struct {
		TemplateFiles      map[string]string      `yaml:"template_files" json:"template_files"`
		AlertmanagerConfig map[string]interface{} `yaml:"alertmanager_config" json:"alertmanager_config"`
	}

	tmp := plain{
		TemplateFiles:      c.TemplateFiles,
		AlertmanagerConfig: c.amSimple,
	}

	return json.Marshal(tmp)
}

// GetGrafanaReceiverMap returns a map that associates UUIDs to grafana receivers
func (c *GettableUserConfig) GetGrafanaReceiverMap() map[string]*GettableGrafanaReceiver {
	UIDs := make(map[string]*GettableGrafanaReceiver)
	for _, r := range c.AlertmanagerConfig.Receivers {
		switch r.Type() {
		case GrafanaReceiverType:
			for _, gr := range r.GettableGrafanaReceivers.GrafanaManagedReceivers {
				UIDs[gr.UID] = gr
			}
		default:
		}
	}
	return UIDs
}

type GettableHistoricUserConfig struct {
	ID                      int64                     `yaml:"id" json:"id"`
	TemplateFiles           map[string]string         `yaml:"template_files" json:"template_files"`
	TemplateFileProvenances map[string]Provenance     `yaml:"template_file_provenances,omitempty" json:"template_file_provenances,omitempty"`
	AlertmanagerConfig      GettableApiAlertingConfig `yaml:"alertmanager_config" json:"alertmanager_config"`
	LastApplied             *strfmt.DateTime          `yaml:"last_applied,omitempty" json:"last_applied,omitempty"`
}

// swagger:response GettableHistoricUserConfigs
type GettableHistoricUserConfigs struct {
	// in:body
	Body []GettableHistoricUserConfig
}

type GettableApiAlertingConfig struct {
	Config              `yaml:",inline"`
	MuteTimeProvenances map[string]Provenance `yaml:"muteTimeProvenances,omitempty" json:"muteTimeProvenances,omitempty"`
	// Override with our superset receiver type
	Receivers []*GettableApiReceiver `yaml:"receivers,omitempty" json:"receivers,omitempty"`
}

func (c *GettableApiAlertingConfig) UnmarshalJSON(b []byte) error {
	type plain GettableApiAlertingConfig
	if err := json.Unmarshal(b, (*plain)(c)); err != nil {
		return err
	}

	// Since Config implements json.Unmarshaler, we must handle _all_ other fields independently.
	// Otherwise, the json decoder will detect this and only use the embedded type.
	// Additionally, we'll use pointers to slices in order to reference the intended target.
	type overrides struct {
		Receivers *[]*GettableApiReceiver `yaml:"receivers,omitempty" json:"receivers,omitempty"`
	}

	if err := json.Unmarshal(b, &overrides{Receivers: &c.Receivers}); err != nil {
		return err
	}

	return c.validate()
}

// validate ensures that the two routing trees use the correct receiver types.
func (c *GettableApiAlertingConfig) validate() error {
	receivers := make(map[string]struct{}, len(c.Receivers))

	var hasGrafReceivers, hasAMReceivers bool
	for _, r := range c.Receivers {
		receivers[r.Name] = struct{}{}
		switch r.Type() {
		case GrafanaReceiverType:
			hasGrafReceivers = true
		case AlertmanagerReceiverType:
			hasAMReceivers = true
		default:
			continue
		}
	}

	if hasGrafReceivers && hasAMReceivers {
		return fmt.Errorf("cannot mix Alertmanager & Grafana receiver types")
	}

	for _, receiver := range AllReceivers(c.Route.AsAMRoute()) {
		_, ok := receivers[receiver]
		if !ok {
			return fmt.Errorf("unexpected receiver (%s) is undefined", receiver)
		}
	}

	return nil
}

// Config is the top-level configuration for Alertmanager's config files.
type Config struct {
	Global            *config.GlobalConfig      `yaml:"global,omitempty" json:"global,omitempty"`
	Route             *Route                    `yaml:"route,omitempty" json:"route,omitempty"`
	InhibitRules      []config.InhibitRule      `yaml:"inhibit_rules,omitempty" json:"inhibit_rules,omitempty"`
	MuteTimeIntervals []config.MuteTimeInterval `yaml:"mute_time_intervals,omitempty" json:"mute_time_intervals,omitempty"`
	Templates         []string                  `yaml:"templates" json:"templates"`
}

// A Route is a node that contains definitions of how to handle alerts. This is modified
// from the upstream alertmanager in that it adds the ObjectMatchers property.
type Route struct {
	Receiver string `yaml:"receiver,omitempty" json:"receiver,omitempty"`

	GroupByStr []string          `yaml:"group_by,omitempty" json:"group_by,omitempty"`
	GroupBy    []model.LabelName `yaml:"-" json:"-"`
	GroupByAll bool              `yaml:"-" json:"-"`
	// Deprecated. Remove before v1.0 release.
	Match map[string]string `yaml:"match,omitempty" json:"match,omitempty"`
	// Deprecated. Remove before v1.0 release.
	MatchRE           config.MatchRegexps `yaml:"match_re,omitempty" json:"match_re,omitempty"`
	Matchers          config.Matchers     `yaml:"matchers,omitempty" json:"matchers,omitempty"`
	ObjectMatchers    ObjectMatchers      `yaml:"object_matchers,omitempty" json:"object_matchers,omitempty"`
	MuteTimeIntervals []string            `yaml:"mute_time_intervals,omitempty" json:"mute_time_intervals,omitempty"`
	Continue          bool                `yaml:"continue" json:"continue,omitempty"`
	Routes            []*Route            `yaml:"routes,omitempty" json:"routes,omitempty"`

	GroupWait      *model.Duration `yaml:"group_wait,omitempty" json:"group_wait,omitempty"`
	GroupInterval  *model.Duration `yaml:"group_interval,omitempty" json:"group_interval,omitempty"`
	RepeatInterval *model.Duration `yaml:"repeat_interval,omitempty" json:"repeat_interval,omitempty"`

	Provenance Provenance `yaml:"provenance,omitempty" json:"provenance,omitempty"`
}

// UnmarshalYAML implements the yaml.Unmarshaler interface for Route. This is a copy of alertmanager's upstream except it removes validation on the label key.
func (r *Route) UnmarshalYAML(unmarshal func(interface{}) error) error {
	type plain Route
	if err := unmarshal((*plain)(r)); err != nil {
		return err
	}

	return r.validateChild()
}

// AsAMRoute returns an Alertmanager route from a Grafana route. The ObjectMatchers are converted to Matchers.
func (r *Route) AsAMRoute() *config.Route {
	amRoute := &config.Route{
		Receiver:          r.Receiver,
		GroupByStr:        r.GroupByStr,
		GroupBy:           r.GroupBy,
		GroupByAll:        r.GroupByAll,
		Match:             r.Match,
		MatchRE:           r.MatchRE,
		Matchers:          append(r.Matchers, r.ObjectMatchers...),
		MuteTimeIntervals: r.MuteTimeIntervals,
		Continue:          r.Continue,

		GroupWait:      r.GroupWait,
		GroupInterval:  r.GroupInterval,
		RepeatInterval: r.RepeatInterval,

		Routes: make([]*config.Route, 0, len(r.Routes)),
	}
	for _, rt := range r.Routes {
		amRoute.Routes = append(amRoute.Routes, rt.AsAMRoute())
	}

	return amRoute
}

// AsGrafanaRoute returns a Grafana route from an Alertmanager route. The Matchers are converted to ObjectMatchers.
func AsGrafanaRoute(r *config.Route) *Route {
	gRoute := &Route{
		Receiver:          r.Receiver,
		GroupByStr:        r.GroupByStr,
		GroupBy:           r.GroupBy,
		GroupByAll:        r.GroupByAll,
		Match:             r.Match,
		MatchRE:           r.MatchRE,
		ObjectMatchers:    ObjectMatchers(r.Matchers),
		MuteTimeIntervals: r.MuteTimeIntervals,
		Continue:          r.Continue,

		GroupWait:      r.GroupWait,
		GroupInterval:  r.GroupInterval,
		RepeatInterval: r.RepeatInterval,

		Routes: make([]*Route, 0, len(r.Routes)),
	}
	for _, rt := range r.Routes {
		gRoute.Routes = append(gRoute.Routes, AsGrafanaRoute(rt))
	}

	return gRoute
}

func (r *Route) ResourceType() string {
	return "route"
}

func (r *Route) ResourceID() string {
	return ""
}

// Config is the entrypoint for the embedded Alertmanager config with the exception of receivers.
// Prometheus historically uses yaml files as the method of configuration and thus some
// post-validation is included in the UnmarshalYAML method. Here we simply run this with
// a noop unmarshaling function in order to benefit from said validation.
func (c *Config) UnmarshalJSON(b []byte) error {
	type plain Config
	if err := json.Unmarshal(b, (*plain)(c)); err != nil {
		return err
	}

	noopUnmarshal := func(_ interface{}) error { return nil }

	if c.Global != nil {
		if err := c.Global.UnmarshalYAML(noopUnmarshal); err != nil {
			return err
		}
	}

	if c.Route == nil {
		return fmt.Errorf("no routes provided")
	}

	err := c.Route.Validate()
	if err != nil {
		return err
	}

	for _, r := range c.InhibitRules {
		if err := r.UnmarshalYAML(noopUnmarshal); err != nil {
			return err
		}
	}

	tiNames := make(map[string]struct{})
	for _, mt := range c.MuteTimeIntervals {
		if mt.Name == "" {
			return fmt.Errorf("missing name in mute time interval")
		}
		if _, ok := tiNames[mt.Name]; ok {
			return fmt.Errorf("mute time interval %q is not unique", mt.Name)
		}
		tiNames[mt.Name] = struct{}{}
	}
	return checkTimeInterval(c.Route, tiNames)
}

func checkTimeInterval(r *Route, timeIntervals map[string]struct{}) error {
	for _, sr := range r.Routes {
		if err := checkTimeInterval(sr, timeIntervals); err != nil {
			return err
		}
	}
	if len(r.MuteTimeIntervals) == 0 {
		return nil
	}
	for _, mt := range r.MuteTimeIntervals {
		if _, ok := timeIntervals[mt]; !ok {
			return fmt.Errorf("undefined time interval %q used in route", mt)
		}
	}
	return nil
}

type PostableApiAlertingConfig struct {
	Config `yaml:",inline"`

	// Override with our superset receiver type
	Receivers []*PostableApiReceiver `yaml:"receivers,omitempty" json:"receivers,omitempty"`
}

func (c *PostableApiAlertingConfig) UnmarshalJSON(b []byte) error {
	type plain PostableApiAlertingConfig
	if err := json.Unmarshal(b, (*plain)(c)); err != nil {
		return err
	}

	// Since Config implements json.Unmarshaler, we must handle _all_ other fields independently.
	// Otherwise, the json decoder will detect this and only use the embedded type.
	// Additionally, we'll use pointers to slices in order to reference the intended target.
	type overrides struct {
		Receivers *[]*PostableApiReceiver `yaml:"receivers,omitempty" json:"receivers,omitempty"`
	}

	if err := json.Unmarshal(b, &overrides{Receivers: &c.Receivers}); err != nil {
		return err
	}

	return c.validate()
}

// validate ensures that the two routing trees use the correct receiver types.
func (c *PostableApiAlertingConfig) validate() error {
	receivers := make(map[string]struct{}, len(c.Receivers))

	var hasGrafReceivers, hasAMReceivers bool
	for _, r := range c.Receivers {
		receivers[r.Name] = struct{}{}
		switch r.Type() {
		case GrafanaReceiverType:
			hasGrafReceivers = true
		case AlertmanagerReceiverType:
			hasAMReceivers = true
		default:
			continue
		}
	}

	if hasGrafReceivers && hasAMReceivers {
		return fmt.Errorf("cannot mix Alertmanager & Grafana receiver types")
	}

	if hasGrafReceivers {
		// Taken from https://github.com/prometheus/alertmanager/blob/master/config/config.go#L170-L191
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
	}

	for _, receiver := range AllReceivers(c.Route.AsAMRoute()) {
		_, ok := receivers[receiver]
		if !ok {
			return fmt.Errorf("unexpected receiver (%s) is undefined", receiver)
		}
	}

	return nil
}

// Type requires validate has been called and just checks the first receiver type
func (c *PostableApiAlertingConfig) ReceiverType() ReceiverType {
	for _, r := range c.Receivers {
		switch r.Type() {
		case GrafanaReceiverType:
			return GrafanaReceiverType
		case AlertmanagerReceiverType:
			return AlertmanagerReceiverType
		default:
			continue
		}
	}
	return EmptyReceiverType
}

// AllReceivers will recursively walk a routing tree and return a list of all the
// referenced receiver names.
func AllReceivers(route *config.Route) (res []string) {
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

type RawMessage json.RawMessage // This type alias adds YAML marshaling to the json.RawMessage.

// MarshalJSON returns m as the JSON encoding of m.
func (r RawMessage) MarshalJSON() ([]byte, error) {
	return json.Marshal(json.RawMessage(r))
}

func (r *RawMessage) UnmarshalJSON(data []byte) error {
	var raw json.RawMessage
	err := json.Unmarshal(data, &raw)
	if err != nil {
		return err
	}
	*r = RawMessage(raw)
	return nil
}

func (r *RawMessage) UnmarshalYAML(unmarshal func(interface{}) error) error {
	var data interface{}
	if err := unmarshal(&data); err != nil {
		return err
	}
	bytes, err := json.Marshal(data)
	if err != nil {
		return err
	}
	*r = bytes
	return nil
}

func (r RawMessage) MarshalYAML() (interface{}, error) {
	if r == nil {
		return nil, nil
	}
	var d interface{}
	err := json.Unmarshal(r, &d)
	if err != nil {
		return nil, err
	}
	return d, nil
}

type GettableGrafanaReceiver struct {
	UID                   string          `json:"uid"`
	Name                  string          `json:"name"`
	Type                  string          `json:"type"`
	DisableResolveMessage bool            `json:"disableResolveMessage"`
	Settings              RawMessage      `json:"settings,omitempty"`
	SecureFields          map[string]bool `json:"secureFields"`
	Provenance            Provenance      `json:"provenance,omitempty"`
}

type PostableGrafanaReceiver struct {
	UID                   string            `json:"uid"`
	Name                  string            `json:"name"`
	Type                  string            `json:"type"`
	DisableResolveMessage bool              `json:"disableResolveMessage"`
	Settings              RawMessage        `json:"settings,omitempty"`
	SecureSettings        map[string]string `json:"secureSettings"`
}

type ReceiverType int

const (
	GrafanaReceiverType ReceiverType = 1 << iota
	AlertmanagerReceiverType
	EmptyReceiverType = GrafanaReceiverType | AlertmanagerReceiverType
)

func (r ReceiverType) String() string {
	switch r {
	case GrafanaReceiverType:
		return "grafana"
	case AlertmanagerReceiverType:
		return "alertmanager"
	case EmptyReceiverType:
		return "empty"
	default:
		return "unknown"
	}
}

// Can determines whether a receiver type can implement another receiver type.
// This is useful as receivers with just names but no contact points
// are valid in all backends.
func (r ReceiverType) Can(other ReceiverType) bool { return r&other != 0 }

type GettableApiReceiver struct {
	config.Receiver          `yaml:",inline"`
	GettableGrafanaReceivers `yaml:",inline"`
}

func (r *GettableApiReceiver) UnmarshalJSON(b []byte) error {
	type plain GettableApiReceiver
	if err := json.Unmarshal(b, (*plain)(r)); err != nil {
		return err
	}

	hasGrafanaReceivers := len(r.GettableGrafanaReceivers.GrafanaManagedReceivers) > 0

	if hasGrafanaReceivers {
		if len(r.EmailConfigs) > 0 {
			return fmt.Errorf("cannot have both Alertmanager EmailConfigs & Grafana receivers together")
		}
		if len(r.PagerdutyConfigs) > 0 {
			return fmt.Errorf("cannot have both Alertmanager PagerdutyConfigs & Grafana receivers together")
		}
		if len(r.SlackConfigs) > 0 {
			return fmt.Errorf("cannot have both Alertmanager SlackConfigs & Grafana receivers together")
		}
		if len(r.WebhookConfigs) > 0 {
			return fmt.Errorf("cannot have both Alertmanager WebhookConfigs & Grafana receivers together")
		}
		if len(r.OpsGenieConfigs) > 0 {
			return fmt.Errorf("cannot have both Alertmanager OpsGenieConfigs & Grafana receivers together")
		}
		if len(r.WechatConfigs) > 0 {
			return fmt.Errorf("cannot have both Alertmanager WechatConfigs & Grafana receivers together")
		}
		if len(r.PushoverConfigs) > 0 {
			return fmt.Errorf("cannot have both Alertmanager PushoverConfigs & Grafana receivers together")
		}
		if len(r.VictorOpsConfigs) > 0 {
			return fmt.Errorf("cannot have both Alertmanager VictorOpsConfigs & Grafana receivers together")
		}
	}

	return nil
}

func (r *GettableApiReceiver) Type() ReceiverType {
	if len(r.GettableGrafanaReceivers.GrafanaManagedReceivers) > 0 {
		return GrafanaReceiverType
	}
	return AlertmanagerReceiverType
}

type PostableApiReceiver struct {
	config.Receiver          `yaml:",inline"`
	PostableGrafanaReceivers `yaml:",inline"`
}

func (r *PostableApiReceiver) UnmarshalYAML(unmarshal func(interface{}) error) error {
	if err := unmarshal(&r.PostableGrafanaReceivers); err != nil {
		return err
	}

	if err := unmarshal(&r.Receiver); err != nil {
		return err
	}

	return nil
}

func (r *PostableApiReceiver) UnmarshalJSON(b []byte) error {
	type plain PostableApiReceiver
	if err := json.Unmarshal(b, (*plain)(r)); err != nil {
		return err
	}

	hasGrafanaReceivers := len(r.PostableGrafanaReceivers.GrafanaManagedReceivers) > 0

	if hasGrafanaReceivers {
		if len(r.EmailConfigs) > 0 {
			return fmt.Errorf("cannot have both Alertmanager EmailConfigs & Grafana receivers together")
		}
		if len(r.PagerdutyConfigs) > 0 {
			return fmt.Errorf("cannot have both Alertmanager PagerdutyConfigs & Grafana receivers together")
		}
		if len(r.SlackConfigs) > 0 {
			return fmt.Errorf("cannot have both Alertmanager SlackConfigs & Grafana receivers together")
		}
		if len(r.WebhookConfigs) > 0 {
			return fmt.Errorf("cannot have both Alertmanager WebhookConfigs & Grafana receivers together")
		}
		if len(r.OpsGenieConfigs) > 0 {
			return fmt.Errorf("cannot have both Alertmanager OpsGenieConfigs & Grafana receivers together")
		}
		if len(r.WechatConfigs) > 0 {
			return fmt.Errorf("cannot have both Alertmanager WechatConfigs & Grafana receivers together")
		}
		if len(r.PushoverConfigs) > 0 {
			return fmt.Errorf("cannot have both Alertmanager PushoverConfigs & Grafana receivers together")
		}
		if len(r.VictorOpsConfigs) > 0 {
			return fmt.Errorf("cannot have both Alertmanager VictorOpsConfigs & Grafana receivers together")
		}
	}
	return nil
}

func (r *PostableApiReceiver) Type() ReceiverType {
	if len(r.PostableGrafanaReceivers.GrafanaManagedReceivers) > 0 {
		return GrafanaReceiverType
	}

	cpy := r.Receiver
	cpy.Name = ""
	if reflect.ValueOf(cpy).IsZero() {
		return EmptyReceiverType
	}

	return AlertmanagerReceiverType
}

type GettableGrafanaReceivers struct {
	GrafanaManagedReceivers []*GettableGrafanaReceiver `yaml:"grafana_managed_receiver_configs,omitempty" json:"grafana_managed_receiver_configs,omitempty"`
}

type PostableGrafanaReceivers struct {
	GrafanaManagedReceivers []*PostableGrafanaReceiver `yaml:"grafana_managed_receiver_configs,omitempty" json:"grafana_managed_receiver_configs,omitempty"`
}

type EncryptFn func(ctx context.Context, payload []byte) ([]byte, error)

func processReceiverConfigs(c []*PostableApiReceiver, encrypt EncryptFn) error {
	seenUIDs := make(map[string]struct{})
	// encrypt secure settings for storing them in DB
	for _, r := range c {
		switch r.Type() {
		case GrafanaReceiverType:
			for _, gr := range r.PostableGrafanaReceivers.GrafanaManagedReceivers {
				for k, v := range gr.SecureSettings {
					encryptedData, err := encrypt(context.Background(), []byte(v))
					if err != nil {
						return fmt.Errorf("failed to encrypt secure settings: %w", err)
					}
					gr.SecureSettings[k] = base64.StdEncoding.EncodeToString(encryptedData)
				}
				if gr.UID == "" {
					retries := 5
					for i := 0; i < retries; i++ {
						gen := util.GenerateShortUID()
						_, ok := seenUIDs[gen]
						if !ok {
							gr.UID = gen
							break
						}
					}
					if gr.UID == "" {
						return fmt.Errorf("all %d attempts to generate UID for receiver have failed; please retry", retries)
					}
				}
				seenUIDs[gr.UID] = struct{}{}
			}
		default:
		}
	}
	return nil
}

// ObjectMatchers is Matchers with a different Unmarshal and Marshal methods that accept matchers as objects
// that have already been parsed.
type ObjectMatchers labels.Matchers

// UnmarshalYAML implements the yaml.Unmarshaler interface for Matchers.
func (m *ObjectMatchers) UnmarshalYAML(unmarshal func(interface{}) error) error {
	var rawMatchers [][3]string
	if err := unmarshal(&rawMatchers); err != nil {
		return err
	}
	for _, rawMatcher := range rawMatchers {
		var matchType labels.MatchType
		switch rawMatcher[1] {
		case "=":
			matchType = labels.MatchEqual
		case "!=":
			matchType = labels.MatchNotEqual
		case "=~":
			matchType = labels.MatchRegexp
		case "!~":
			matchType = labels.MatchNotRegexp
		default:
			return fmt.Errorf("unsupported match type %q in matcher", rawMatcher[1])
		}

		// When Prometheus serializes a matcher, the value gets wrapped in quotes:
		// https://github.com/prometheus/alertmanager/blob/main/pkg/labels/matcher.go#L77
		// Remove these quotes so that we are matching against the right value.
		//
		// This is a stop-gap solution which will be superceded by https://github.com/grafana/grafana/issues/50040.
		//
		// The ngalert migration converts matchers into the Prom-style, quotes included.
		// The UI then stores the quotes into ObjectMatchers without removing them.
		// This approach allows these extra quotes to be stored in the database, and fixes them at read time.
		// This works because the database stores matchers as JSON text.
		//
		// There is a subtle bug here, where users might intentionally add quotes to matchers. This method can remove such quotes.
		// Since ObjectMatchers will be deprecated entirely, this bug will go away naturally with time.
		rawMatcher[2] = strings.TrimPrefix(rawMatcher[2], "\"")
		rawMatcher[2] = strings.TrimSuffix(rawMatcher[2], "\"")

		matcher, err := labels.NewMatcher(matchType, rawMatcher[0], rawMatcher[2])
		if err != nil {
			return err
		}
		*m = append(*m, matcher)
	}
	sort.Sort(labels.Matchers(*m))
	return nil
}

// UnmarshalJSON implements the json.Unmarshaler interface for Matchers.
func (m *ObjectMatchers) UnmarshalJSON(data []byte) error {
	var rawMatchers [][3]string
	if err := json.Unmarshal(data, &rawMatchers); err != nil {
		return err
	}
	for _, rawMatcher := range rawMatchers {
		var matchType labels.MatchType
		switch rawMatcher[1] {
		case "=":
			matchType = labels.MatchEqual
		case "!=":
			matchType = labels.MatchNotEqual
		case "=~":
			matchType = labels.MatchRegexp
		case "!~":
			matchType = labels.MatchNotRegexp
		default:
			return fmt.Errorf("unsupported match type %q in matcher", rawMatcher[1])
		}

		rawMatcher[2] = strings.TrimPrefix(rawMatcher[2], "\"")
		rawMatcher[2] = strings.TrimSuffix(rawMatcher[2], "\"")

		matcher, err := labels.NewMatcher(matchType, rawMatcher[0], rawMatcher[2])
		if err != nil {
			return err
		}
		*m = append(*m, matcher)
	}
	sort.Sort(labels.Matchers(*m))
	return nil
}

// MarshalYAML implements the yaml.Marshaler interface for Matchers.
func (m ObjectMatchers) MarshalYAML() (interface{}, error) {
	result := make([][3]string, len(m))
	for i, matcher := range m {
		result[i] = [3]string{matcher.Name, matcher.Type.String(), matcher.Value}
	}
	return result, nil
}

// MarshalJSON implements the json.Marshaler interface for Matchers.
func (m ObjectMatchers) MarshalJSON() ([]byte, error) {
	if len(m) == 0 {
		return nil, nil
	}
	result := make([][3]string, len(m))
	for i, matcher := range m {
		result[i] = [3]string{matcher.Name, matcher.Type.String(), matcher.Value}
	}
	return json.Marshal(result)
}
