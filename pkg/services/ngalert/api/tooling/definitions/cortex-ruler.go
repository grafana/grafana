package definitions

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/prometheus/common/model"
)

// swagger:route Get /api/ruler/grafana/api/v1/rules ruler RouteGetGrafanaRulesConfig
//
// List rule groups
//
//     Produces:
//     - application/json
//
//     Responses:
//       202: NamespaceConfigResponse
//

// swagger:route Get /api/ruler/{DatasourceUID}/api/v1/rules ruler RouteGetRulesConfig
//
// List rule groups
//
//     Produces:
//     - application/json
//
//     Responses:
//       202: NamespaceConfigResponse
//       404: NotFound

// swagger:route POST /api/ruler/grafana/api/v1/rules/{Namespace} ruler RoutePostNameGrafanaRulesConfig
//
// Creates or updates a rule group
//
//     Consumes:
//     - application/json
//     - application/yaml
//
//     Responses:
//       202: Ack
//

// swagger:route POST /api/ruler/{DatasourceUID}/api/v1/rules/{Namespace} ruler RoutePostNameRulesConfig
//
// Creates or updates a rule group
//
//     Consumes:
//     - application/json
//     - application/yaml
//
//     Responses:
//       202: Ack
//       404: NotFound

// swagger:route Get /api/ruler/grafana/api/v1/rules/{Namespace} ruler RouteGetNamespaceGrafanaRulesConfig
//
// Get rule groups by namespace
//
//     Produces:
//     - application/json
//
//     Responses:
//       202: NamespaceConfigResponse

// swagger:route Get /api/ruler/{DatasourceUID}/api/v1/rules/{Namespace} ruler RouteGetNamespaceRulesConfig
//
// Get rule groups by namespace
//
//     Produces:
//     - application/json
//
//     Responses:
//       202: NamespaceConfigResponse
//       404: NotFound

// swagger:route Delete /api/ruler/grafana/api/v1/rules/{Namespace} ruler RouteDeleteNamespaceGrafanaRulesConfig
//
// Delete namespace
//
//     Responses:
//       202: Ack

// swagger:route Delete /api/ruler/{DatasourceUID}/api/v1/rules/{Namespace} ruler RouteDeleteNamespaceRulesConfig
//
// Delete namespace
//
//     Responses:
//       202: Ack
//       404: NotFound

// swagger:route Get /api/ruler/grafana/api/v1/rules/{Namespace}/{Groupname} ruler RouteGetGrafanaRuleGroupConfig
//
// Get rule group
//
//     Produces:
//     - application/json
//
//     Responses:
//       202: RuleGroupConfigResponse

// swagger:route Get /api/ruler/{DatasourceUID}/api/v1/rules/{Namespace}/{Groupname} ruler RouteGetRulegGroupConfig
//
// Get rule group
//
//     Produces:
//     - application/json
//
//     Responses:
//       202: RuleGroupConfigResponse
//       404: NotFound

// swagger:route Delete /api/ruler/grafana/api/v1/rules/{Namespace}/{Groupname} ruler RouteDeleteGrafanaRuleGroupConfig
//
// Delete rule group
//
//     Responses:
//       202: Ack

// swagger:route Delete /api/ruler/{DatasourceUID}/api/v1/rules/{Namespace}/{Groupname} ruler RouteDeleteRuleGroupConfig
//
// Delete rule group
//
//     Responses:
//       202: Ack
//       404: NotFound

// swagger:parameters RoutePostNameRulesConfig RoutePostNameGrafanaRulesConfig
type NamespaceConfig struct {
	// in:path
	Namespace string
	// in:body
	Body PostableRuleGroupConfig
}

// swagger:parameters RouteGetNamespaceRulesConfig RouteDeleteNamespaceRulesConfig RouteGetNamespaceGrafanaRulesConfig RouteDeleteNamespaceGrafanaRulesConfig
type PathNamespaceConfig struct {
	// in: path
	Namespace string
}

// swagger:parameters RouteGetRulegGroupConfig RouteDeleteRuleGroupConfig RouteGetGrafanaRuleGroupConfig RouteDeleteGrafanaRuleGroupConfig
type PathRouleGroupConfig struct {
	// in: path
	Namespace string
	// in: path
	Groupname string
}

// swagger:parameters RouteGetRulesConfig RouteGetGrafanaRulesConfig
type PathGetRulesParams struct {
	// in: query
	DashboardUID string
	// in: query
	PanelID int64
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
func (c *PostableRuleGroupConfig) Type() (backend Backend) {
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

func (c *PostableRuleGroupConfig) validate() error {
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

// swagger:model
type GettableRuleGroupConfig struct {
	Name          string                     `yaml:"name" json:"name"`
	Interval      model.Duration             `yaml:"interval,omitempty" json:"interval,omitempty"`
	SourceTenants []string                   `yaml:"source_tenants,omitempty" json:"source_tenants,omitempty"`
	Rules         []GettableExtendedRuleNode `yaml:"rules" json:"rules"`
}

func (c *GettableRuleGroupConfig) UnmarshalJSON(b []byte) error {
	type plain GettableRuleGroupConfig
	if err := json.Unmarshal(b, (*plain)(c)); err != nil {
		return err
	}

	return c.validate()
}

// Type requires validate has been called and just checks the first rule type
func (c *GettableRuleGroupConfig) Type() (backend Backend) {
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

func (c *GettableRuleGroupConfig) validate() error {
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
	For         *model.Duration   `yaml:"for,omitempty" json:"for,omitempty"`
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

func (n *PostableExtendedRuleNode) Type() RuleType {
	if n.GrafanaManagedAlert != nil {
		return GrafanaManagedRule
	}

	return LoTexManagedRule
}

func (n *PostableExtendedRuleNode) UnmarshalJSON(b []byte) error {
	type plain PostableExtendedRuleNode
	if err := json.Unmarshal(b, (*plain)(n)); err != nil {
		return err
	}

	return n.validate()
}

func (n *PostableExtendedRuleNode) validate() error {
	if n.ApiRuleNode == nil && n.GrafanaManagedAlert == nil {
		return fmt.Errorf("cannot have empty rule")
	}

	if n.GrafanaManagedAlert != nil {
		if n.ApiRuleNode != nil && (n.ApiRuleNode.Expr != "" || n.ApiRuleNode.Record != "") {
			return fmt.Errorf("cannot have both Prometheus style rules and Grafana rules together")
		}
	}
	return nil
}

type GettableExtendedRuleNode struct {
	// note: this works with yaml v3 but not v2 (the inline tag isn't accepted on pointers in v2)
	*ApiRuleNode `yaml:",inline"`
	//GrafanaManagedAlert yaml.Node `yaml:"grafana_alert,omitempty"`
	GrafanaManagedAlert *GettableGrafanaRule `yaml:"grafana_alert,omitempty" json:"grafana_alert,omitempty"`
}

func (n *GettableExtendedRuleNode) Type() RuleType {
	if n.GrafanaManagedAlert != nil {
		return GrafanaManagedRule
	}
	return LoTexManagedRule
}

func (n *GettableExtendedRuleNode) UnmarshalJSON(b []byte) error {
	type plain GettableExtendedRuleNode
	if err := json.Unmarshal(b, (*plain)(n)); err != nil {
		return err
	}

	return n.validate()
}

func (n *GettableExtendedRuleNode) validate() error {
	if n.ApiRuleNode == nil && n.GrafanaManagedAlert == nil {
		return fmt.Errorf("cannot have empty rule")
	}

	if n.GrafanaManagedAlert != nil {
		if n.ApiRuleNode != nil && (n.ApiRuleNode.Expr != "" || n.ApiRuleNode.Record != "") {
			return fmt.Errorf("cannot have both Prometheus style rules and Grafana rules together")
		}
	}
	return nil
}

// swagger:enum NoDataState
type NoDataState string

const (
	Alerting NoDataState = "Alerting"
	NoData   NoDataState = "NoData"
	OK       NoDataState = "OK"
)

// swagger:enum ExecutionErrorState
type ExecutionErrorState string

const (
	OkErrState       ExecutionErrorState = "OK"
	AlertingErrState ExecutionErrorState = "Alerting"
	ErrorErrState    ExecutionErrorState = "Error"
)

// swagger:model
type PostableGrafanaRule struct {
	Title        string              `json:"title" yaml:"title"`
	Condition    string              `json:"condition" yaml:"condition"`
	Data         []AlertQuery        `json:"data" yaml:"data"`
	UID          string              `json:"uid" yaml:"uid"`
	NoDataState  NoDataState         `json:"no_data_state" yaml:"no_data_state"`
	ExecErrState ExecutionErrorState `json:"exec_err_state" yaml:"exec_err_state"`
	IsPaused     *bool               `json:"is_paused" yaml:"is_paused"`
}

// swagger:model
type GettableGrafanaRule struct {
	ID              int64               `json:"id" yaml:"id"`
	OrgID           int64               `json:"orgId" yaml:"orgId"`
	Title           string              `json:"title" yaml:"title"`
	Condition       string              `json:"condition" yaml:"condition"`
	Data            []AlertQuery        `json:"data" yaml:"data"`
	Updated         time.Time           `json:"updated" yaml:"updated"`
	IntervalSeconds int64               `json:"intervalSeconds" yaml:"intervalSeconds"`
	Version         int64               `json:"version" yaml:"version"`
	UID             string              `json:"uid" yaml:"uid"`
	NamespaceUID    string              `json:"namespace_uid" yaml:"namespace_uid"`
	NamespaceID     int64               `json:"namespace_id" yaml:"namespace_id"`
	RuleGroup       string              `json:"rule_group" yaml:"rule_group"`
	NoDataState     NoDataState         `json:"no_data_state" yaml:"no_data_state"`
	ExecErrState    ExecutionErrorState `json:"exec_err_state" yaml:"exec_err_state"`
	Provenance      Provenance          `json:"provenance,omitempty" yaml:"provenance,omitempty"`
	IsPaused        bool                `json:"is_paused" yaml:"is_paused"`
}

// AlertQuery represents a single query associated with an alert definition.
type AlertQuery struct {
	// RefID is the unique identifier of the query, set by the frontend call.
	RefID string `json:"refId"`
	// QueryType is an optional identifier for the type of query.
	// It can be used to distinguish different types of queries.
	QueryType string `json:"queryType"`
	// RelativeTimeRange is the relative Start and End of the query as sent by the frontend.
	RelativeTimeRange RelativeTimeRange `json:"relativeTimeRange"`

	// Grafana data source unique identifier; it should be '__expr__' for a Server Side Expression operation.
	DatasourceUID string `json:"datasourceUid"`

	// JSON is the raw JSON query and includes the above properties as well as custom properties.
	Model json.RawMessage `json:"model"`
}

// RelativeTimeRange is the per query start and end time
// for requests.
type RelativeTimeRange struct {
	From Duration `json:"from" yaml:"from"`
	To   Duration `json:"to" yaml:"to"`
}

// Duration is a type used for marshalling durations.
type Duration time.Duration

func (d Duration) String() string {
	return time.Duration(d).String()
}

func (d Duration) MarshalJSON() ([]byte, error) {
	return json.Marshal(time.Duration(d).Seconds())
}

func (d *Duration) UnmarshalJSON(b []byte) error {
	var v interface{}
	if err := json.Unmarshal(b, &v); err != nil {
		return err
	}
	switch value := v.(type) {
	case float64:
		*d = Duration(time.Duration(value) * time.Second)
		return nil
	default:
		return fmt.Errorf("invalid duration %v", v)
	}
}

func (d Duration) MarshalYAML() (interface{}, error) {
	return time.Duration(d).Seconds(), nil
}

func (d *Duration) UnmarshalYAML(unmarshal func(interface{}) error) error {
	var v interface{}
	if err := unmarshal(&v); err != nil {
		return err
	}
	switch value := v.(type) {
	case int:
		*d = Duration(time.Duration(value) * time.Second)
		return nil
	default:
		return fmt.Errorf("invalid duration %v", v)
	}
}
