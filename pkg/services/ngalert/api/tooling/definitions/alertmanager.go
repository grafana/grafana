package definitions

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"reflect"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/prometheus/alertmanager/config"
	"gopkg.in/yaml.v3"

	amv2 "github.com/prometheus/alertmanager/api/v2/models"
)

// swagger:route POST /api/alertmanager/{Recipient}/config/api/v1/alerts alertmanager RoutePostAlertingConfig
//
// sets an Alerting config
//
//     Responses:
//       201: Ack
//       400: ValidationError

// swagger:route GET /api/alertmanager/{Recipient}/config/api/v1/alerts alertmanager RouteGetAlertingConfig
//
// gets an Alerting config
//
//     Responses:
//       200: GettableUserConfig
//       400: ValidationError

// swagger:route DELETE /api/alertmanager/{Recipient}/config/api/v1/alerts alertmanager RouteDeleteAlertingConfig
//
// deletes the Alerting config for a tenant
//
//     Responses:
//       200: Ack
//       400: ValidationError

// swagger:route GET /api/alertmanager/{Recipient}/api/v2/alerts alertmanager RouteGetAMAlerts
//
// get alertmanager alerts
//
//     Responses:
//       200: GettableAlerts
//       400: ValidationError

// swagger:route POST /api/alertmanager/{Recipient}/api/v2/alerts alertmanager RoutePostAMAlerts
//
// create alertmanager alerts
//
//     Responses:
//       200: Ack
//       400: ValidationError

// swagger:route GET /api/alertmanager/{Recipient}/api/v2/alerts/groups alertmanager RouteGetAMAlertGroups
//
// get alertmanager alerts
//
//     Responses:
//       200: AlertGroups
//       400: ValidationError

// swagger:route GET /api/alertmanager/{Recipient}/api/v2/silences alertmanager RouteGetSilences
//
// get silences
//
//     Responses:
//       200: GettableSilences
//       400: ValidationError

// swagger:route POST /api/alertmanager/{Recipient}/api/v2/silences alertmanager RouteCreateSilence
//
// create silence
//
//     Responses:
//       201: GettableSilence
//       400: ValidationError

// swagger:route GET /api/alertmanager/{Recipient}/api/v2/silence/{SilenceId} alertmanager RouteGetSilence
//
// get silence
//
//     Responses:
//       200: GettableSilence
//       400: ValidationError

// swagger:route DELETE /api/alertmanager/{Recipient}/api/v2/silence/{SilenceId} alertmanager RouteDeleteSilence
//
// delete silence
//
//     Responses:
//       200: Ack
//       400: ValidationError

// swagger:parameters RouteCreateSilence
type CreateSilenceParams struct {
	// in:body
	Silence PostableSilence
}

// swagger:parameters RouteGetSilence RouteDeleteSilence
type GetDeleteSilenceParams struct {
	// in:path
	SilenceId string
}

// swagger:parameters RouteGetSilences
type GetSilencesParams struct {
	// in:query
	Filter []string `json:"filter"`
}

// swagger:model
type PostableSilence = amv2.PostableSilence

// swagger:model
type GettableSilences = amv2.GettableSilences

// swagger:model
type GettableSilence = amv2.GettableSilence

// swagger:model
type GettableAlerts = amv2.GettableAlerts

// swagger:model
type GettableAlert = amv2.GettableAlert

// swagger:model
type AlertGroups = amv2.AlertGroups

// swagger:model
type AlertGroup = amv2.AlertGroup

// swagger:model
type Receiver = amv2.Receiver

// swagger:parameters RouteGetAMAlerts RouteGetAMAlertGroups
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

// swagger:parameters RoutePostAlertingConfig
type BodyAlertingConfig struct {
	// in:body
	Body PostableUserConfig
}

// alertmanager routes
// swagger:parameters RoutePostAlertingConfig RouteGetAlertingConfig RouteDeleteAlertingConfig RouteGetAMAlerts RoutePostAMAlerts RouteGetAMAlertGroups RouteGetSilences RouteCreateSilence RouteGetSilence RouteDeleteSilence RoutePostAlertingConfig
// ruler routes
// swagger:parameters RouteGetRulesConfig RoutePostNameRulesConfig RouteGetNamespaceRulesConfig RouteDeleteNamespaceRulesConfig RouteGetRulegGroupConfig RouteDeleteRuleGroupConfig
// prom routes
// swagger:parameters RouteGetRuleStatuses RouteGetAlertStatuses
// testing routes
// swagger:parameters RouteTestReceiverConfig RouteTestRuleConfig
type DatasourceReference struct {
	// Recipient should be "grafana" for requests to be handled by grafana
	// and the numeric datasource id for requests to be forwarded to a datasource
	// in:path
	Recipient string
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

func (c *PostableUserConfig) EncryptSecureSettings() error {
	// encrypt secure settings for storing them in DB
	for _, r := range c.AlertmanagerConfig.Receivers {
		switch r.Type() {
		case GrafanaReceiverType:
			for _, gr := range r.PostableGrafanaReceivers.GrafanaManagedReceivers {
				for k, v := range gr.SecureSettings {
					encryptedData, err := util.Encrypt([]byte(v), setting.SecretKey)
					if err != nil {
						return fmt.Errorf("failed to encrypt secure settings: %w", err)
					}
					gr.SecureSettings[k] = base64.StdEncoding.EncodeToString(encryptedData)
				}
			}
		default:
		}
	}
	return nil
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

// swagger:model
type GettableUserConfig struct {
	TemplateFiles      map[string]string         `yaml:"template_files" json:"template_files"`
	AlertmanagerConfig GettableApiAlertingConfig `yaml:"alertmanager_config" json:"alertmanager_config"`

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

type GettableApiAlertingConfig struct {
	Config `yaml:",inline"`

	// Override with our superset receiver type
	Receivers []*GettableApiReceiver `yaml:"receivers,omitempty" json:"receivers,omitempty"`
}

func (c *GettableApiAlertingConfig) UnmarshalJSON(b []byte) error {
	type plain GettableApiAlertingConfig
	if err := json.Unmarshal(b, (*plain)(c)); err != nil {
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

	for _, receiver := range AllReceivers(c.Route) {
		_, ok := receivers[receiver]
		if !ok {
			return fmt.Errorf("unexpected receiver (%s) is undefined", receiver)
		}
	}

	return nil
}

// Config is the top-level configuration for Alertmanager's config files.
type Config struct {
	Global       *config.GlobalConfig  `yaml:"global,omitempty" json:"global,omitempty"`
	Route        *config.Route         `yaml:"route,omitempty" json:"route,omitempty"`
	InhibitRules []*config.InhibitRule `yaml:"inhibit_rules,omitempty" json:"inhibit_rules,omitempty"`
	Receivers    []*config.Receiver    `yaml:"-" json:"receivers,omitempty"`
	Templates    []string              `yaml:"templates" json:"templates"`
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

	for _, receiver := range AllReceivers(c.Route) {
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

type GettableGrafanaReceiver dtos.AlertNotification
type PostableGrafanaReceiver models.CreateAlertNotificationCommand

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

// MatchesBackend determines if a config payload can be sent to a particular backend type
func (r ReceiverType) MatchesBackend(backend Backend) error {
	msg := func(backend Backend, receiver ReceiverType) error {
		return fmt.Errorf(
			"unexpected backend type (%s) for receiver type (%s)",
			backend.String(),
			receiver.String(),
		)
	}
	var ok bool
	switch backend {
	case GrafanaBackend:
		ok = r.Can(GrafanaReceiverType)
	case AlertmanagerBackend:
		ok = r.Can(AlertmanagerReceiverType)
	default:
	}
	if !ok {
		return msg(backend, r)
	}
	return nil
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
