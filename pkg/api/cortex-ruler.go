package api

import (
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/prometheus/common/model"
)

// swagger:route Get /ruler/{Recipient}/api/v1/rules ruler RouteGetRulesConfig
//
// List rule groups
//
//     Produces:
//     - application/json
//
//     Responses:
//       202: NamespaceConfigResponse

// swagger:route POST /ruler/{Recipient}/api/v1/rules/{Namespace} ruler RoutePostNameRulesConfig
//
// Creates or updates a rule group
//
//     Consumes:
//     - application/json
//     - application/yaml
//
//     Responses:
//       202: Ack

// swagger:route Get /ruler/{Recipient}/api/v1/rules/{Namespace} ruler RouteGetNamespaceRulesConfig
//
// Get rule groups by namespace
//
//     Produces:
//     - application/json
//
//     Responses:
//       202: NamespaceConfigResponse

// swagger:route Delete /ruler/{Recipient}/api/v1/rules/{Namespace} ruler RouteDeleteNamespaceRulesConfig
//
// Delete namespace
//
//     Responses:
//       202: Ack

// swagger:route Get /ruler/{Recipient}/api/v1/rules/{Namespace}/{Groupname} ruler RouteGetRulegGroupConfig
//
// Get rule group
//
//     Produces:
//     - application/json
//
//     Responses:
//       202: RuleGroupConfigResponse

// swagger:route Delete /ruler/{Recipient}/api/v1/rules/{Namespace}/{Groupname} ruler RouteDeleteRuleGroupConfig
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
	Body RuleGroupConfig
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
	RuleGroupConfig
}

// swagger:model
type NamespaceConfigResponse map[string][]RuleGroupConfig

// swagger:model
type RuleGroupConfig struct {
	Name     string             `yaml:"name" json:"name"`
	Interval model.Duration     `yaml:"interval,omitempty" json:"interval,omitempty"`
	Rules    []ExtendedRuleNode `yaml:"rules" json:"rules"`
}

func (c *RuleGroupConfig) UnmarshalJSON(b []byte) error {
	type plain RuleGroupConfig
	if err := json.Unmarshal(b, (*plain)(c)); err != nil {
		return err
	}

	return c.validate()
}

// Type requires validate has been called and just checks the first rule type
func (c *RuleGroupConfig) Type() (backend Backend) {
	for _, rule := range c.Rules {
		switch rule.Type() {
		case GrafanaManagedRule:
			return GrafanaBackend
		case LoTexManagedRule:
			return LoTexRulerBackend
		}
	}
	return
}

func (c *RuleGroupConfig) validate() error {
	var hasGrafRules, hasLotexRules bool
	for _, rule := range c.Rules {
		switch rule.Type() {
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

type ApiRuleNode struct {
	Record      string            `yaml:"record,omitempty" json:"record,omitempty"`
	Alert       string            `yaml:"alert,omitempty" json:"alert,omitempty"`
	Expr        string            `yaml:"expr" json:"expr"`
	For         model.Duration    `yaml:"for,omitempty" json:"for,omitempty"`
	Labels      map[string]string `yaml:"labels,omitempty" json:"labels,omitempty"`
	Annotations map[string]string `yaml:"annotations,omitempty" json:"annotations,omitempty"`
}

type RuleType int

const (
	GrafanaManagedRule RuleType = iota
	LoTexManagedRule
)

type ExtendedRuleNode struct {
	// note: this works with yaml v3 but not v2 (the inline tag isn't accepted on pointers in v2)
	*ApiRuleNode `yaml:",inline"`
	//GrafanaManagedAlert yaml.Node `yaml:"grafana_alert,omitempty"`
	GrafanaManagedAlert *ExtendedUpsertAlertDefinitionCommand `yaml:"grafana_alert,omitempty" json:"grafana_alert,omitempty"`
}

func (n *ExtendedRuleNode) Type() RuleType {
	if n.ApiRuleNode != nil {
		return LoTexManagedRule
	}
	return GrafanaManagedRule
}

func (n *ExtendedRuleNode) UnmarshalJSON(b []byte) error {
	type plain ExtendedRuleNode
	if err := json.Unmarshal(b, (*plain)(n)); err != nil {
		return err
	}

	if n.ApiRuleNode != nil && n.GrafanaManagedAlert != nil {
		return fmt.Errorf("cannot have both Prometheus style rules and Grafana rules together")
	}
	if n.ApiRuleNode == nil && n.GrafanaManagedAlert == nil {
		return fmt.Errorf("cannot have empty rule")
	}

	return nil
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

// ExtendedUpsertAlertDefinitionCommand extends UpsertAlertDefinitionCommand
// with properties of grafana dashboard alerts
// swagger:model
type ExtendedUpsertAlertDefinitionCommand struct {
	models.UpdateAlertDefinitionCommand
	NoDataState         NoDataState            `json:"no_data_state" yaml:"no_data_state"`
	ExecutionErrorState ExecutionErrorState    `json:"exec_err_state" yaml:"exec_err_state"`
	Settings            map[string]interface{} `json:"settings" yaml:"settings"`
	// Receivers are optional and used for migrating notification channels of existing alerts
	Receivers []string `json:"receivers" yaml:"receivers"`
	// internal state
	FolderUID      string   `json:"-" yaml:"-"`
	DatasourceUIDs []string `json:"-" yaml:"-"`
	RuleGroupUID   string   `json:"-" yaml:"-"`
}
