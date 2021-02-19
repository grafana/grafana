package api

import (
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/prometheus/common/model"
	"github.com/prometheus/prometheus/pkg/rulefmt"
)

// swagger:route Get /api/v1/rules RulerConfig RouteGetRulesConfig
//
// List rule groups
//
//     Produces:
//     - application/yaml
//
//     Responses:
//       202: NamespaceConfigResponse

// swagger:route POST /api/v1/rules/{Namespace} RulerConfig RoutePostNameRulesConfig
//
// Creates or updates a rule group
//
//     Consumes:
//     - application/yaml
//
//     Responses:
//       202: Ack

// swagger:route Get /api/v1/rules/{Namespace} RulerConfig RouteGetNamespaceRulesConfig
//
// Get rule groups by namespace
//
//     Produces:
//     - application/yaml
//
//     Responses:
//       202: NamespaceConfigResponse

// swagger:route Delete /api/v1/rules/{Namespace} RulerConfig RouteDeleteNamespaceRulesConfig
//
// Delete namespace
//
//     Responses:
//       202: Ack

// swagger:route Get /api/v1/rules/{Namespace}/{Groupname} RulerConfig RouteGetRulegGroupConfig
//
// Get rule group
//
//     Produces:
//     - application/yaml
//
//     Responses:
//       202: RuleGroupConfigResponse

// swagger:route Delete /api/v1/rules/{Namespace}/{Groupname} RulerConfig RouteDeleteRuleGroupConfig
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
type NamespaceConfigResponse map[string]RuleGroupConfig

// swagger:model
type RuleGroupConfig struct {
	Name     string             `yaml:"name" json:"name"`
	Interval model.Duration     `yaml:"interval,omitempty" json:"interval,omitempty"`
	Rules    []ExtendedRuleNode `yaml:"rules" json:"rules"`
}

type ExtendedRuleNode struct {
	rulefmt.RuleNode
	//GrafanaManagedAlert yaml.Node `yaml:"grafana_alert,omitempty"`
	GrafanaManagedAlert ExtendedUpsertAlertDefinitionCommand `yaml:"grafana_alert,omitempty" json:"grafana_alert,omitempty"`
}

// UpsertAlertDefinitionCommand is copy of the unexported struct:
https://github.com/grafana/grafana/blob/debb82e12417e82a0e2bd09e1a450065f884c1bc/pkg/services/ngalert/models.go#L85
type UpsertAlertDefinitionCommand struct {
	Title           string            `json:"title" yaml:"title"`
	// OrgID is an obsolete field (it will derive from the x-grafana-org-id header)
	OrgID           int64             `json:"-" yaml:"-"`
	// Condition is the refID of the query or expression to be evaluated
	Condition       string            `json:"condition" yaml:"condition"`
	// Data is an array of the queries and expressions
	Data            []eval.AlertQuery `json:"data" yaml:"data"`
	// IntervalSeconds is an obsolete field (it will derive from the ruleGroup interval)
	IntervalSeconds *int64            `json:"-" yaml:"-"`
	// UID is set only for existing definitions
	UID string `json:"uid" yaml:"uid"`

	Result *ngalert.AlertDefinition `json:"-" yaml:"-"`
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
	UpsertAlertDefinitionCommand
	NoDataState         NoDataState            `json:"no_data_state" yaml:"no_data_state"`
	ExecutionErrorState ExecutionErrorState    `json:"exec_err_state" yaml:"exec_err_state"`
	Settings            map[string]interface{} `json:"settings" yaml:"settings"`
	// internal state
	FolderUID string `json:"-" yaml:"-"`
	DatasourceUIDs []string `json:"-" yaml:"-"`
	RuleGroupUID string `json:"-" yaml:"-"`
}
