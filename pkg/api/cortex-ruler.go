package api

import (
	"github.com/prometheus/common/model"
	"github.com/prometheus/prometheus/pkg/rulefmt"
	"gopkg.in/yaml.v3"
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
//       202: RuleGroupConfigResponse

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
	Name     string             `yaml:"name"`
	Interval model.Duration     `yaml:"interval,omitempty"`
	Rules    []ExtendedRuleNode `yaml:"rules"`
}

type ExtendedRuleNode struct {
	rulefmt.RuleNode
	GrafanaManagedAlert yaml.Node `yaml:"alert,omitempty"`
}
