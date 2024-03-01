package definitions

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/go-openapi/strfmt"
	"github.com/grafana/alerting/definition"
	amv2 "github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/common/model"
	"gopkg.in/yaml.v3"
)

// swagger:route POST /alertmanager/grafana/config/api/v1/alerts alertmanager RoutePostGrafanaAlertingConfig
//
// sets an Alerting config
//
//     Responses:
//       201: Ack
//       400: ValidationError

// swagger:route POST /alertmanager/{DatasourceUID}/config/api/v1/alerts alertmanager RoutePostAlertingConfig
//
// sets an Alerting config
//
//     Responses:
//       201: Ack
//       400: ValidationError
//       404: NotFound

// swagger:route GET /alertmanager/grafana/config/api/v1/alerts alertmanager RouteGetGrafanaAlertingConfig
//
// gets an Alerting config
//
//     Responses:
//       200: GettableUserConfig
//       400: ValidationError

// swagger:route GET /alertmanager/{DatasourceUID}/config/api/v1/alerts alertmanager RouteGetAlertingConfig
//
// gets an Alerting config
//
//     Responses:
//       200: GettableUserConfig
//       400: ValidationError
//       404: NotFound

// swagger:route GET /alertmanager/grafana/config/history alertmanager RouteGetGrafanaAlertingConfigHistory
//
// gets Alerting configurations that were successfully applied in the past
//
//     Responses:
//       200: GettableHistoricUserConfigs

// swagger:route POST /alertmanager/grafana/config/history/{id}/_activate alertmanager RoutePostGrafanaAlertingConfigHistoryActivate
//
// revert Alerting configuration to the historical configuration specified by the given id
//
//     Responses:
//       202: Ack
//       400: ValidationError
//       404: NotFound

// swagger:route DELETE /alertmanager/grafana/config/api/v1/alerts alertmanager RouteDeleteGrafanaAlertingConfig
//
// deletes the Alerting config for a tenant
//
//     Responses:
//       200: Ack
//       400: ValidationError

// swagger:route DELETE /alertmanager/{DatasourceUID}/config/api/v1/alerts alertmanager RouteDeleteAlertingConfig
//
// deletes the Alerting config for a tenant
//
//     Responses:
//       200: Ack
//       400: ValidationError
//       404: NotFound

// swagger:route GET /alertmanager/grafana/api/v2/status alertmanager RouteGetGrafanaAMStatus
//
// get alertmanager status and configuration
//
//     Responses:
//       200: GettableStatus
//       400: ValidationError

// swagger:route GET /alertmanager/{DatasourceUID}/api/v2/status alertmanager RouteGetAMStatus
//
// get alertmanager status and configuration
//
//     Responses:
//       200: GettableStatus
//       400: ValidationError
//       404: NotFound

// swagger:route GET /alertmanager/grafana/api/v2/alerts alertmanager RouteGetGrafanaAMAlerts
//
// get alertmanager alerts
//
//     Responses:
//       200: gettableAlerts
//       400: ValidationError

// swagger:route GET /alertmanager/{DatasourceUID}/api/v2/alerts alertmanager RouteGetAMAlerts
//
// get alertmanager alerts
//
//     Responses:
//       200: gettableAlerts
//       400: ValidationError
//       404: NotFound

// swagger:route POST /alertmanager/{DatasourceUID}/api/v2/alerts alertmanager RoutePostAMAlerts
//
// create alertmanager alerts
//
//     Responses:
//       200: Ack
//       400: ValidationError
//       404: NotFound

// swagger:route GET /alertmanager/grafana/api/v2/alerts/groups alertmanager RouteGetGrafanaAMAlertGroups
//
// get alertmanager alerts
//
//     Responses:
//       200: alertGroups
//       400: ValidationError

// swagger:route GET /alertmanager/{DatasourceUID}/api/v2/alerts/groups alertmanager RouteGetAMAlertGroups
//
// get alertmanager alerts
//
//     Responses:
//       200: alertGroups
//       400: ValidationError
//       404: NotFound

// swagger:route GET /alertmanager/grafana/config/api/v1/receivers alertmanager RouteGetGrafanaReceivers
//
// Get a list of all receivers
//
//     Responses:
//       200: receiversResponse

// swagger:route POST /alertmanager/grafana/config/api/v1/receivers/test alertmanager RoutePostTestGrafanaReceivers
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

// swagger:route POST /alertmanager/grafana/config/api/v1/templates/test alertmanager RoutePostTestGrafanaTemplates
//
// Test Grafana managed templates without saving them.
//     Produces:
//     - application/json
//
//     Responses:
//
//       200: TestTemplatesResults
//       400: ValidationError
//       403: PermissionDenied
//       409: AlertManagerNotReady

// swagger:route GET /alertmanager/grafana/api/v2/silences alertmanager RouteGetGrafanaSilences
//
// get silences
//
//     Responses:
//       200: gettableSilences
//       400: ValidationError

// swagger:route GET /alertmanager/{DatasourceUID}/api/v2/silences alertmanager RouteGetSilences
//
// get silences
//
//     Responses:
//       200: gettableSilences
//       400: ValidationError
//       404: NotFound

// swagger:route POST /alertmanager/grafana/api/v2/silences alertmanager RouteCreateGrafanaSilence
//
// create silence
//
//     Responses:
//       202: postSilencesOKBody
//       400: ValidationError

// swagger:route POST /alertmanager/{DatasourceUID}/api/v2/silences alertmanager RouteCreateSilence
//
// create silence
//
//     Responses:
//       201: postSilencesOKBody
//       400: ValidationError
//       404: NotFound

// swagger:route GET /alertmanager/grafana/api/v2/silence/{SilenceId} alertmanager RouteGetGrafanaSilence
//
// get silence
//
//     Responses:
//       200: gettableSilence
//       400: ValidationError

// swagger:route GET /alertmanager/{DatasourceUID}/api/v2/silence/{SilenceId} alertmanager RouteGetSilence
//
// get silence
//
//     Responses:
//       200: gettableSilence
//       400: ValidationError
//       404: NotFound

// swagger:route DELETE /alertmanager/grafana/api/v2/silence/{SilenceId} alertmanager RouteDeleteGrafanaSilence
//
// delete silence
//
//     Responses:
//       200: Ack
//       400: ValidationError

// swagger:route DELETE /alertmanager/{DatasourceUID}/api/v2/silence/{SilenceId} alertmanager RouteDeleteSilence
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
	Alert     *TestReceiversConfigAlertParams   `yaml:"alert,omitempty" json:"alert,omitempty"`
	Receivers []*definition.PostableApiReceiver `yaml:"receivers,omitempty" json:"receivers,omitempty"`
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

// swagger:parameters RoutePostTestGrafanaTemplates
type TestTemplatesConfigParams struct {
	// in:body
	Body TestTemplatesConfigBodyParams
}

type TestTemplatesConfigBodyParams struct {
	// Alerts to use as data when testing the template.
	Alerts []*amv2.PostableAlert `json:"alerts"`

	// Template string to test.
	Template string `json:"template"`

	// Name of the template file.
	Name string `json:"name"`
}

// swagger:model
type TestTemplatesResults struct {
	Results []TestTemplatesResult      `json:"results,omitempty"`
	Errors  []TestTemplatesErrorResult `json:"errors,omitempty"`
}

type TestTemplatesResult struct {
	// Name of the associated template definition for this result.
	Name string `json:"name"`

	// Interpolated value of the template.
	Text string `json:"text"`
}

type TestTemplatesErrorResult struct {
	// Name of the associated template for this error. Will be empty if the Kind is "invalid_template".
	Name string `json:"name,omitempty"`

	// Kind of template error that occurred.
	Kind TemplateErrorKind `json:"kind"`

	// Error message.
	Message string `json:"message"`
}

// swagger:enum TemplateErrorKind
type TemplateErrorKind string

const (
	InvalidTemplate TemplateErrorKind = "invalid_template"
	ExecutionError  TemplateErrorKind = "execution_error"
)

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
	Config *definition.PostableApiAlertingConfig `json:"config"`

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
	s.Config = &definition.PostableApiAlertingConfig{Config: definition.Config{
		Global:       c.Global,
		Route:        definition.AsGrafanaRoute(c.Route),
		InhibitRules: c.InhibitRules,
		Templates:    c.Templates,
	}}
	s.Uptime = amStatus.Uptime
	s.VersionInfo = amStatus.VersionInfo

	type overrides struct {
		Receivers *[]*definition.PostableApiReceiver `yaml:"receivers,omitempty" json:"receivers,omitempty"`
	}

	if err := yaml.Unmarshal([]byte(*amStatus.Config.Original), &overrides{Receivers: &s.Config.Receivers}); err != nil {
		return err
	}

	return nil
}

func NewGettableStatus(cfg *definition.PostableApiAlertingConfig) *GettableStatus {
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

// swagger:parameters RoutePostGrafanaAlertingConfigHistoryActivate
type HistoricalConfigId struct {
	// Id should be the id of the GettableHistoricUserConfig
	// in:path
	Id int64 `json:"id"`
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
	TemplateFiles      map[string]string                    `yaml:"template_files" json:"template_files"`
	AlertmanagerConfig definition.PostableApiAlertingConfig `yaml:"alertmanager_config" json:"alertmanager_config"`
	amSimple           map[string]interface{}               `yaml:"-" json:"-"`
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
func (c *PostableUserConfig) GetGrafanaReceiverMap() map[string]*definition.PostableGrafanaReceiver {
	UIDs := make(map[string]*definition.PostableGrafanaReceiver)
	for _, r := range c.AlertmanagerConfig.Receivers {
		switch r.Type() {
		case definition.GrafanaReceiverType:
			for _, gr := range r.PostableGrafanaReceivers.GrafanaManagedReceivers {
				UIDs[gr.UID] = gr
			}
		default:
		}
	}
	return UIDs
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
		case definition.GrafanaReceiverType:
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
	definition.Config   `yaml:",inline"`
	MuteTimeProvenances map[string]Provenance `yaml:"muteTimeProvenances,omitempty" json:"muteTimeProvenances,omitempty"`
	// Override with our superset receiver type
	Receivers []*GettableApiReceiver `yaml:"receivers,omitempty" json:"receivers,omitempty"`
}

func (c *GettableApiAlertingConfig) GetReceivers() []*GettableApiReceiver {
	return c.Receivers
}

func (c *GettableApiAlertingConfig) GetMuteTimeIntervals() []config.MuteTimeInterval {
	return c.MuteTimeIntervals
}

func (c *GettableApiAlertingConfig) GetTimeIntervals() []config.TimeInterval { return c.TimeIntervals }

func (c *GettableApiAlertingConfig) GetRoute() *definition.Route {
	return c.Route
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
		case definition.GrafanaReceiverType:
			hasGrafReceivers = true
		case definition.AlertmanagerReceiverType:
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

// AllReceivers will recursively walk a routing tree and return a list of all the
// referenced receiver names.
func AllReceivers(route *config.Route) (res []string) {
	if route == nil {
		return res
	}
	// TODO: Consider removing this check when new resource-specific AM APIs are implemented.
	// Skip autogenerated routes. This helps cover the case where an admin POSTs the autogenerated route back to us.
	// For example, when deleting a contact point that is unused but still referenced in the autogenerated route.
	if isAutogeneratedRoot(route) {
		return nil
	}

	if route.Receiver != "" {
		res = append(res, route.Receiver)
	}

	for _, subRoute := range route.Routes {
		res = append(res, AllReceivers(subRoute)...)
	}
	return res
}

// autogeneratedRouteLabel a label name used to distinguish alerts that are supposed to be handled by the autogenerated policy. Only expected value is `true`.
const autogeneratedRouteLabel = "__grafana_autogenerated__"

// isAutogeneratedRoot returns true if the route is the root of an autogenerated route.
func isAutogeneratedRoot(route *config.Route) bool {
	return len(route.Matchers) == 1 && route.Matchers[0].Name == autogeneratedRouteLabel
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

func (r *GettableApiReceiver) Type() definition.ReceiverType {
	if len(r.GettableGrafanaReceivers.GrafanaManagedReceivers) > 0 {
		return definition.GrafanaReceiverType
	}
	return definition.AlertmanagerReceiverType
}

func (r *GettableApiReceiver) GetName() string {
	return r.Receiver.Name
}

type GettableGrafanaReceivers struct {
	GrafanaManagedReceivers []*GettableGrafanaReceiver `yaml:"grafana_managed_receiver_configs,omitempty" json:"grafana_managed_receiver_configs,omitempty"`
}

type EncryptFn func(ctx context.Context, payload []byte) ([]byte, error)

// ObjectMatcher is a matcher that can be used to filter alerts.
// swagger:model ObjectMatcher
type ObjectMatcherAPIModel [3]string

// ObjectMatchers is a list of matchers that can be used to filter alerts.
// swagger:model ObjectMatchers
type ObjectMatchersAPIModel []ObjectMatcherAPIModel

// swagger:ignore
// ObjectMatchers is Matchers with a different Unmarshal and Marshal methods that accept matchers as objects
// that have already been parsed.
type ObjectMatchers labels.Matchers

// UnmarshalYAML implements the yaml.Unmarshaler interface for Matchers.
func (m *ObjectMatchers) UnmarshalYAML(unmarshal func(interface{}) error) error {
	var rawMatchers ObjectMatchersAPIModel
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
	var rawMatchers ObjectMatchersAPIModel
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
	result := make(ObjectMatchersAPIModel, len(m))
	for i, matcher := range m {
		result[i] = ObjectMatcherAPIModel{matcher.Name, matcher.Type.String(), matcher.Value}
	}
	return result, nil
}

// MarshalJSON implements the json.Marshaler interface for Matchers.
func (m ObjectMatchers) MarshalJSON() ([]byte, error) {
	if len(m) == 0 {
		return nil, nil
	}
	result := make(ObjectMatchersAPIModel, len(m))
	for i, matcher := range m {
		result[i] = ObjectMatcherAPIModel{matcher.Name, matcher.Type.String(), matcher.Value}
	}
	return json.Marshal(result)
}
