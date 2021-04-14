package api

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/prometheus/common/model"
)

// swagger:route Get /api/ruler/{Recipient}/api/v1/rules ruler RouteGetRulesConfig
//
// List rule groups
//
//     Produces:
//     - application/json
//
//     Responses:
//       202: NamespaceConfigResponse

// swagger:route POST /api/ruler/{Recipient}/api/v1/rules/{Namespace} ruler RoutePostNameRulesConfig
//
// Creates or updates a rule group
//
//     Consumes:
//     - application/json
//     - application/yaml
//
//     Responses:
//       202: Ack

// swagger:route Get /api/ruler/{Recipient}/api/v1/rules/{Namespace} ruler RouteGetNamespaceRulesConfig
//
// Get rule groups by namespace
//
//     Produces:
//     - application/json
//
//     Responses:
//       202: NamespaceConfigResponse

// swagger:route Delete /api/ruler/{Recipient}/api/v1/rules/{Namespace} ruler RouteDeleteNamespaceRulesConfig
//
// Delete namespace
//
//     Responses:
//       202: Ack

// swagger:route Get /api/ruler/{Recipient}/api/v1/rules/{Namespace}/{Groupname} ruler RouteGetRulegGroupConfig
//
// Get rule group
//
//     Produces:
//     - application/json
//
//     Responses:
//       202: RuleGroupConfigResponse

// swagger:route Delete /api/ruler/{Recipient}/api/v1/rules/{Namespace}/{Groupname} ruler RouteDeleteRuleGroupConfig
//
// Delete rule group
//
//     Responses:
//       202: Ack

// swagger:parameters RoutePostNameRulesConfig
type NamespaceConfig struct {
	// in:path
	Namespace string
	// in:body
	Body PostableRuleGroupConfig
}

// swagger:parameters RouteGetNamespaceRulesConfig RouteDeleteNamespaceRulesConfig
type PathNamespaceConfig struct {
	// in: path
	Namespace string
}

// swagger:parameters RouteGetRulegGroupConfig RouteDeleteRuleGroupConfig
type PathRouleGroupConfig struct {
	// in: path
	Namespace string
	// in: path
	Groupname string
}

// swagger:model
type RuleGroupConfigResponse struct {
	GettableRuleGroupConfig
}

// swagger:model
type NamespaceConfigResponse map[string][]GettableRuleGroupConfig

// swagger:model
type PostableRuleGroupConfig struct {
	Name     string                     `yaml:"name" json:"name"`
	Interval model.Duration             `yaml:"interval,omitempty" json:"interval,omitempty"`
	Rules    []PostableExtendedRuleNode `yaml:"rules" json:"rules"`
}

func (c *PostableRuleGroupConfig) UnmarshalJSON(b []byte) error {
	type plain PostableRuleGroupConfig
	if err := json.Unmarshal(b, (*plain)(c)); err != nil {
		return err
	}

	return c.validate()
}

// Type requires validate has been called and just checks the first rule type
func (c *PostableRuleGroupConfig) Type() (backend Backend, err error) {
	for _, rule := range c.Rules {
		b, err := rule.Type()
		if err != nil {
			return backend, err
		}
		switch b {
		case GrafanaManagedRule:
			return GrafanaBackend, nil
		case LoTexManagedRule:
			return LoTexRulerBackend, nil
		}
	}
	return
}

func (c *PostableRuleGroupConfig) validate() error {
	var hasGrafRules, hasLotexRules bool
	for _, rule := range c.Rules {
		b, err := rule.Type()
		if err != nil {
			return err
		}
		switch b {
		case GrafanaManagedRule:
			hasGrafRules = true
		case LoTexManagedRule:
			hasLotexRules = true
		}
	}

	if hasGrafRules && hasLotexRules {
		return fmt.Errorf("cannot mix Grafana & Prometheus style rules")
	}
	return nil
}

// swagger:model
type GettableRuleGroupConfig struct {
	Name     string                     `yaml:"name" json:"name"`
	Interval model.Duration             `yaml:"interval,omitempty" json:"interval,omitempty"`
	Rules    []GettableExtendedRuleNode `yaml:"rules" json:"rules"`
}

func (c *GettableRuleGroupConfig) UnmarshalJSON(b []byte) error {
	type plain GettableRuleGroupConfig
	if err := json.Unmarshal(b, (*plain)(c)); err != nil {
		return err
	}

	return c.validate()
}

// Type requires validate has been called and just checks the first rule type
func (c *GettableRuleGroupConfig) Type() (backend Backend, err error) {
	for _, rule := range c.Rules {
		b, err := rule.Type()
		if err != nil {
			return backend, err
		}
		switch b {
		case GrafanaManagedRule:
			return GrafanaBackend, nil
		case LoTexManagedRule:
			return LoTexRulerBackend, nil
		}
	}
	return
}

func (c *GettableRuleGroupConfig) validate() error {
	var hasGrafRules, hasLotexRules bool
	for _, rule := range c.Rules {
		b, err := rule.Type()
		if err != nil {
			return err
		}
		switch b {
		case GrafanaManagedRule:
			hasGrafRules = true
		case LoTexManagedRule:
			hasLotexRules = true
		}
	}

	if hasGrafRules && hasLotexRules {
		return fmt.Errorf("cannot mix Grafana & Prometheus style rules")
	}
	return nil
}

// ApiDuration extends model.Duration
// for handling JSON serialization/deserialization
type ApiDuration model.Duration

func (d ApiDuration) String() string {
	return model.Duration(d).String()
}

// MarshalYAML implements the yaml.Marshaler interface.
func (d ApiDuration) MarshalYAML() (interface{}, error) {
	return model.Duration(d).MarshalYAML()
}

// UnmarshalYAML implements the yaml.Unmarshaler interface.
func (d *ApiDuration) UnmarshalYAML(unmarshal func(interface{}) error) error {
	var md model.Duration
	if err := (&md).UnmarshalYAML(unmarshal); err != nil {
		return err
	}
	*d = ApiDuration(md)
	return nil
}

// MarshalJSON implements the json.Marshaler interface.
func (d ApiDuration) MarshalJSON() ([]byte, error) {
	return json.Marshal(d.String())
}

// UnmarshalJSON implements the json.Unmarshaler interface.
func (d *ApiDuration) UnmarshalJSON(b []byte) error {
	// strip trailing and leading quotes
	dur := strings.Trim(string(b), `"`)
	md, err := model.ParseDuration(dur)
	if err != nil {
		return err
	}
	*d = ApiDuration(md)
	return nil
}

type ApiRuleNode struct {
	Record string `yaml:"record,omitempty" json:"record,omitempty"`
	Alert  string `yaml:"alert,omitempty" json:"alert,omitempty"`
	Expr   string `yaml:"expr" json:"expr"`
	// Example: 1m
	For         ApiDuration       `yaml:"for,omitempty" json:"for,omitempty"`
	Labels      map[string]string `yaml:"labels,omitempty" json:"labels,omitempty"`
	Annotations map[string]string `yaml:"annotations,omitempty" json:"annotations,omitempty"`
}

type RuleType int

const (
	GrafanaManagedRule RuleType = iota
	LoTexManagedRule
)

type PostableExtendedRuleNode struct {
	// note: this works with yaml v3 but not v2 (the inline tag isn't accepted on pointers in v2)
	*ApiRuleNode `yaml:",inline"`
	//GrafanaManagedAlert yaml.Node `yaml:"grafana_alert,omitempty"`
	GrafanaManagedAlert *PostableGrafanaRule `yaml:"grafana_alert,omitempty" json:"grafana_alert,omitempty"`
}

func (n *PostableExtendedRuleNode) Type() (RuleType, error) {
	if n.ApiRuleNode == nil && n.GrafanaManagedAlert == nil {
		return 0, fmt.Errorf("cannot have empty rule")
	}

	if n.GrafanaManagedAlert != nil {
		if n.ApiRuleNode != nil && (n.ApiRuleNode.Expr != "" || n.ApiRuleNode.Record != "") {
			return 0, fmt.Errorf("cannot have both Prometheus style rules and Grafana rules together")
		}
		return GrafanaManagedRule, nil
	}
	return LoTexManagedRule, nil
}

func (n *PostableExtendedRuleNode) UnmarshalJSON(b []byte) error {
	type plain PostableExtendedRuleNode
	if err := json.Unmarshal(b, (*plain)(n)); err != nil {
		return err
	}

	_, err := n.Type()
	return err
}

type GettableExtendedRuleNode struct {
	// note: this works with yaml v3 but not v2 (the inline tag isn't accepted on pointers in v2)
	*ApiRuleNode `yaml:",inline"`
	//GrafanaManagedAlert yaml.Node `yaml:"grafana_alert,omitempty"`
	GrafanaManagedAlert *GettableGrafanaRule `yaml:"grafana_alert,omitempty" json:"grafana_alert,omitempty"`
}

func (n *GettableExtendedRuleNode) Type() (RuleType, error) {
	if n.ApiRuleNode == nil && n.GrafanaManagedAlert == nil {
		return 0, fmt.Errorf("cannot have empty rule")
	}

	if n.GrafanaManagedAlert != nil {
		if n.ApiRuleNode != nil && n.ApiRuleNode.Expr != "" {
			return 0, fmt.Errorf("cannot have both Prometheus style rules and Grafana rules together")
		}
		return GrafanaManagedRule, nil
	}
	return LoTexManagedRule, nil
}

func (n *GettableExtendedRuleNode) UnmarshalJSON(b []byte) error {
	type plain GettableExtendedRuleNode
	if err := json.Unmarshal(b, (*plain)(n)); err != nil {
		return err
	}

	_, err := n.Type()
	return err
}

// swagger:enum NoDataState
type NoDataState string

const (
	Alerting      NoDataState = "Alerting"
	NoData        NoDataState = "NoData"
	KeepLastState NoDataState = "KeepLastState"
	OK            NoDataState = "OK"
)

// swagger:enum ExecutionErrorState
type ExecutionErrorState string

const (
	AlertingErrState      ExecutionErrorState = "Alerting"
	KeepLastStateErrState ExecutionErrorState = "KeepLastState"
)

// swagger:model
type PostableGrafanaRule struct {
	OrgID        int64               `json:"-" yaml:"-"`
	Title        string              `json:"title" yaml:"title"`
	Condition    string              `json:"condition" yaml:"condition"`
	Data         []models.AlertQuery `json:"data" yaml:"data"`
	UID          string              `json:"uid" yaml:"uid"`
	NoDataState  NoDataState         `json:"no_data_state" yaml:"no_data_state"`
	ExecErrState ExecutionErrorState `json:"exec_err_state" yaml:"exec_err_state"`
}

// swagger:model
type GettableGrafanaRule struct {
	ID              int64               `json:"id" yaml:"id"`
	OrgID           int64               `json:"orgId" yaml:"orgId"`
	Title           string              `json:"title" yaml:"title"`
	Condition       string              `json:"condition" yaml:"condition"`
	Data            []models.AlertQuery `json:"data" yaml:"data"`
	Updated         time.Time           `json:"updated" yaml:"updated"`
	IntervalSeconds int64               `json:"intervalSeconds" yaml:"intervalSeconds"`
	Version         int64               `json:"version" yaml:"version"`
	UID             string              `json:"uid" yaml:"uid"`
	NamespaceUID    string              `json:"namespace_uid" yaml:"namespace_uid"`
	NamespaceID     int64               `json:"namespace_id" yaml:"namespace_id"`
	RuleGroup       string              `json:"rule_group" yaml:"rule_group"`
	NoDataState     NoDataState         `json:"no_data_state" yaml:"no_data_state"`
	ExecErrState    ExecutionErrorState `json:"exec_err_state" yaml:"exec_err_state"`
}
