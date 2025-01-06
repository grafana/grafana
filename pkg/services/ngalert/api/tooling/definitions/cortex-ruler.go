package definitions

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/prometheus/common/model"
)

// swagger:route Get /ruler/grafana/api/v1/rule/{RuleUID} ruler RouteGetRuleByUID
//
// Get rule by UID
//
//     Produces:
//     - application/json
//
//     Responses:
//       202: GettableExtendedRuleNode
//       403: ForbiddenError
//       404: description: Not found.

// swagger:route Get /ruler/grafana/api/v1/rules ruler RouteGetGrafanaRulesConfig
//
// List rule groups
//
//     Produces:
//     - application/json
//
//     Responses:
//       202: NamespaceConfigResponse
//       403: ForbiddenError
//

// swagger:route Get /ruler/grafana/api/v1/export/rules ruler RouteGetRulesForExport
//
// List rules in provisioning format
//
//     Produces:
//     - application/json
//     - application/yaml
//     - application/terraform+hcl
//     - text/yaml
//     - text/hcl
//
//     Responses:
//       200: AlertingFileExport
//       403: ForbiddenError
//       404: description: Not found.

// swagger:route Get /ruler/{DatasourceUID}/api/v1/rules ruler RouteGetRulesConfig
//
// List rule groups
//
//     Produces:
//     - application/json
//
//     Responses:
//       202: NamespaceConfigResponse
//       403: ForbiddenError
//       404: NotFound

// swagger:route POST /ruler/grafana/api/v1/rules/{Namespace} ruler RoutePostNameGrafanaRulesConfig
//
// Creates or updates a rule group
//
//     Consumes:
//     - application/json
//     - application/yaml
//
//     Responses:
//       202: UpdateRuleGroupResponse
//       403: ForbiddenError
//

// swagger:route POST /ruler/grafana/api/v1/rules/{Namespace}/export ruler RoutePostRulesGroupForExport
//
// Converts submitted rule group to provisioning format
//
//     Consumes:
//     - application/json
//
//     Produces:
//     - application/json
//     - application/yaml
//     - application/terraform+hcl
//     - text/yaml
//     - text/hcl
//
//     Responses:
//       200: AlertingFileExport
//       403: ForbiddenError
//       404: description: Not found.

// swagger:route POST /ruler/{DatasourceUID}/api/v1/rules/{Namespace} ruler RoutePostNameRulesConfig
//
// Creates or updates a rule group
//
//     Consumes:
//     - application/json
//     - application/yaml
//
//     Responses:
//       202: Ack
//       403: ForbiddenError
//       404: NotFound

// swagger:route Get /ruler/grafana/api/v1/rules/{Namespace} ruler RouteGetNamespaceGrafanaRulesConfig
//
// Get rule groups by namespace
//
//     Produces:
//     - application/json
//
//     Responses:
//       403: ForbiddenError
//       202: NamespaceConfigResponse

// swagger:route Get /ruler/{DatasourceUID}/api/v1/rules/{Namespace} ruler RouteGetNamespaceRulesConfig
//
// Get rule groups by namespace
//
//     Produces:
//     - application/json
//
//     Responses:
//       202: NamespaceConfigResponse
//       403: ForbiddenError
//       404: NotFound

// swagger:route Delete /ruler/grafana/api/v1/rules/{Namespace} ruler RouteDeleteNamespaceGrafanaRulesConfig
//
// Delete namespace
//
//     Responses:
//       202: Ack
//       403: ForbiddenError

// swagger:route Delete /ruler/{DatasourceUID}/api/v1/rules/{Namespace} ruler RouteDeleteNamespaceRulesConfig
//
// Delete namespace
//
//     Responses:
//       202: Ack
//       403: ForbiddenError
//       404: NotFound

// swagger:route Get /ruler/grafana/api/v1/rules/{Namespace}/{Groupname} ruler RouteGetGrafanaRuleGroupConfig
//
// Get rule group
//
//     Produces:
//     - application/json
//
//     Responses:
//       202: RuleGroupConfigResponse
//       403: ForbiddenError

// swagger:route Get /ruler/{DatasourceUID}/api/v1/rules/{Namespace}/{Groupname} ruler RouteGetRulegGroupConfig
//
// Get rule group
//
//     Produces:
//     - application/json
//
//     Responses:
//       202: RuleGroupConfigResponse
//       403: ForbiddenError
//       404: NotFound

// swagger:route Delete /ruler/grafana/api/v1/rules/{Namespace}/{Groupname} ruler RouteDeleteGrafanaRuleGroupConfig
//
// Delete rule group
//
//     Responses:
//       202: Ack
//       403: ForbiddenError

// swagger:route Delete /ruler/{DatasourceUID}/api/v1/rules/{Namespace}/{Groupname} ruler RouteDeleteRuleGroupConfig
//
// Delete rule group
//
//     Responses:
//       202: Ack
//       403: ForbiddenError
//       404: NotFound

// swagger:parameters RoutePostNameRulesConfig RoutePostNameGrafanaRulesConfig RoutePostRulesGroupForExport
type NamespaceConfig struct {
	// The UID of the rule folder
	// in:path
	Namespace string
	// in:body
	Body PostableRuleGroupConfig
}

// swagger:parameters RouteGetNamespaceRulesConfig RouteDeleteNamespaceRulesConfig RouteGetNamespaceGrafanaRulesConfig RouteDeleteNamespaceGrafanaRulesConfig
type PathNamespaceConfig struct {
	// The UID of the rule folder
	// in: path
	Namespace string
}

// swagger:parameters RouteGetRulegGroupConfig RouteDeleteRuleGroupConfig RouteGetGrafanaRuleGroupConfig RouteDeleteGrafanaRuleGroupConfig
type PathRouleGroupConfig struct {
	// The UID of the rule folder
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

// swagger:parameters RouteGetRuleByUID
type PathGetRuleByUIDParams struct {
	// in: path
	RuleUID string
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

	// fields below are used by Mimir/Loki rulers

	SourceTenants                 []string        `yaml:"source_tenants,omitempty" json:"source_tenants,omitempty"`
	EvaluationDelay               *model.Duration `yaml:"evaluation_delay,omitempty" json:"evaluation_delay,omitempty"`
	QueryOffset                   *model.Duration `yaml:"query_offset,omitempty" json:"query_offset,omitempty"`
	AlignEvaluationTimeOnInterval bool            `yaml:"align_evaluation_time_on_interval,omitempty" json:"align_evaluation_time_on_interval,omitempty"`
	Limit                         int             `yaml:"limit,omitempty" json:"limit,omitempty"`
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

	if hasGrafRules && (len(c.SourceTenants) > 0 || c.EvaluationDelay != nil || c.QueryOffset != nil || c.AlignEvaluationTimeOnInterval || c.Limit > 0) {
		return fmt.Errorf("fields source_tenants, evaluation_delay, query_offset, align_evaluation_time_on_interval and limit are not supported for Grafana rules")
	}
	return nil
}

// swagger:model
type GettableRuleGroupConfig struct {
	Name     string                     `yaml:"name" json:"name"`
	Interval model.Duration             `yaml:"interval,omitempty" json:"interval,omitempty"`
	Rules    []GettableExtendedRuleNode `yaml:"rules" json:"rules"`

	// fields below are used by Mimir/Loki rulers

	SourceTenants                 []string        `yaml:"source_tenants,omitempty" json:"source_tenants,omitempty"`
	EvaluationDelay               *model.Duration `yaml:"evaluation_delay,omitempty" json:"evaluation_delay,omitempty"`
	QueryOffset                   *model.Duration `yaml:"query_offset,omitempty" json:"query_offset,omitempty"`
	AlignEvaluationTimeOnInterval bool            `yaml:"align_evaluation_time_on_interval,omitempty" json:"align_evaluation_time_on_interval,omitempty"`
	Limit                         int             `yaml:"limit,omitempty" json:"limit,omitempty"`
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
	Record        string            `yaml:"record,omitempty" json:"record,omitempty"`
	Alert         string            `yaml:"alert,omitempty" json:"alert,omitempty"`
	Expr          string            `yaml:"expr" json:"expr"`
	For           *model.Duration   `yaml:"for,omitempty" json:"for,omitempty"`
	KeepFiringFor *model.Duration   `yaml:"keep_firing_for,omitempty" json:"keep_firing_for,omitempty"`
	Labels        map[string]string `yaml:"labels,omitempty" json:"labels,omitempty"`
	Annotations   map[string]string `yaml:"annotations,omitempty" json:"annotations,omitempty"`
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
type AlertRuleMetadata struct {
	EditorSettings AlertRuleEditorSettings `json:"editor_settings" yaml:"editor_settings"`
}

// swagger:model
type AlertRuleEditorSettings struct {
	SimplifiedQueryAndExpressionsSection bool `json:"simplified_query_and_expressions_section" yaml:"simplified_query_and_expressions_section"`
	SimplifiedNotificationsSection       bool `json:"simplified_notifications_section" yaml:"simplified_notifications_section"`
}

// swagger:model
type AlertRuleNotificationSettings struct {
	// Name of the receiver to send notifications to.
	// required: true
	// example: grafana-default-email
	Receiver string `json:"receiver"`

	// Optional settings

	// Override the labels by which incoming alerts are grouped together. For example, multiple alerts coming in for
	// cluster=A and alertname=LatencyHigh would be batched into a single group. To aggregate by all possible labels
	// use the special value '...' as the sole label name.
	// This effectively disables aggregation entirely, passing through all alerts as-is. This is unlikely to be what
	// you want, unless you have a very low alert volume or your upstream notification system performs its own grouping.
	// Must include 'alertname' and 'grafana_folder' if not using '...'.
	// default: ["alertname", "grafana_folder"]
	// example: ["alertname", "grafana_folder", "cluster"]
	GroupBy []string `json:"group_by,omitempty"`

	// Override how long to initially wait to send a notification for a group of alerts. Allows to wait for an
	// inhibiting alert to arrive or collect more initial alerts for the same group. (Usually ~0s to few minutes.)
	// example: 30s
	GroupWait *model.Duration `json:"group_wait,omitempty"`

	// Override how long to wait before sending a notification about new alerts that are added to a group of alerts for
	// which an initial notification has already been sent. (Usually ~5m or more.)
	// example: 5m
	GroupInterval *model.Duration `json:"group_interval,omitempty"`

	// Override how long to wait before sending a notification again if it has already been sent successfully for an
	// alert. (Usually ~3h or more).
	// Note that this parameter is implicitly bound by Alertmanager's `--data.retention` configuration flag.
	// Notifications will be resent after either repeat_interval or the data retention period have passed, whichever
	// occurs first. `repeat_interval` should not be less than `group_interval`.
	// example: 4h
	RepeatInterval *model.Duration `json:"repeat_interval,omitempty"`

	// Override the times when notifications should be muted. These must match the name of a mute time interval defined
	// in the alertmanager configuration mute_time_intervals section. When muted it will not send any notifications, but
	// otherwise acts normally.
	// example: ["maintenance"]
	MuteTimeIntervals []string `json:"mute_time_intervals,omitempty"`
}

// swagger:model
type Record struct {
	// Name of the recorded metric.
	// required: true
	// example: grafana_alerts_ratio
	Metric string `json:"metric" yaml:"metric"`
	// Which expression node should be used as the input for the recorded metric.
	// required: true
	// example: A
	From string `json:"from" yaml:"from"`
}

// swagger:model
type PostableGrafanaRule struct {
	Title                string                         `json:"title" yaml:"title"`
	Condition            string                         `json:"condition" yaml:"condition"`
	Data                 []AlertQuery                   `json:"data" yaml:"data"`
	UID                  string                         `json:"uid" yaml:"uid"`
	NoDataState          NoDataState                    `json:"no_data_state" yaml:"no_data_state"`
	ExecErrState         ExecutionErrorState            `json:"exec_err_state" yaml:"exec_err_state"`
	IsPaused             *bool                          `json:"is_paused" yaml:"is_paused"`
	NotificationSettings *AlertRuleNotificationSettings `json:"notification_settings" yaml:"notification_settings"`
	Record               *Record                        `json:"record" yaml:"record"`
	Metadata             *AlertRuleMetadata             `json:"metadata,omitempty" yaml:"metadata,omitempty"`
}

// swagger:model
type GettableGrafanaRule struct {
	ID                   int64                          `json:"id" yaml:"id"`
	OrgID                int64                          `json:"orgId" yaml:"orgId"`
	Title                string                         `json:"title" yaml:"title"`
	Condition            string                         `json:"condition" yaml:"condition"`
	Data                 []AlertQuery                   `json:"data" yaml:"data"`
	Updated              time.Time                      `json:"updated" yaml:"updated"`
	IntervalSeconds      int64                          `json:"intervalSeconds" yaml:"intervalSeconds"`
	Version              int64                          `json:"version" yaml:"version"`
	UID                  string                         `json:"uid" yaml:"uid"`
	NamespaceUID         string                         `json:"namespace_uid" yaml:"namespace_uid"`
	RuleGroup            string                         `json:"rule_group" yaml:"rule_group"`
	NoDataState          NoDataState                    `json:"no_data_state" yaml:"no_data_state"`
	ExecErrState         ExecutionErrorState            `json:"exec_err_state" yaml:"exec_err_state"`
	Provenance           Provenance                     `json:"provenance,omitempty" yaml:"provenance,omitempty"`
	IsPaused             bool                           `json:"is_paused" yaml:"is_paused"`
	NotificationSettings *AlertRuleNotificationSettings `json:"notification_settings,omitempty" yaml:"notification_settings,omitempty"`
	Record               *Record                        `json:"record,omitempty" yaml:"record,omitempty"`
	Metadata             *AlertRuleMetadata             `json:"metadata,omitempty" yaml:"metadata,omitempty"`
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
	var v any
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

func (d Duration) MarshalYAML() (any, error) {
	return time.Duration(d).Seconds(), nil
}

func (d *Duration) UnmarshalYAML(unmarshal func(any) error) error {
	var v any
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

// swagger:model
type UpdateRuleGroupResponse struct {
	Message string   `json:"message"`
	Created []string `json:"created,omitempty"`
	Updated []string `json:"updated,omitempty"`
	Deleted []string `json:"deleted,omitempty"`
}
