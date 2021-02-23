package api

import (
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/prometheus/alertmanager/config"
)

// swagger:route Get /api/v1/receiver/test testing RouteTestReceiverConfig
//
// Test receiver
//
//     Consumes:
//     - application/json
//
//     Produces:
//     - application/json
//
//     Responses:
//       200: Success
//		 412: SmtpNotEnabled
//		 500: Failure

// swagger:route Get /api/v1/rule/test testing RouteTestRuleConfig
//
// Test rule
//
//     Consumes:
//     - application/json
//
//     Produces:
//     - application/json
//
//     Responses:
//       200: TestRuleResponse

// swagger:parameters RouteTestReceiverConfig
type TestReceiverRequest struct {
	// in:body
	Body ExtendedReceiver
}

// swagger:parameters RouteTestRuleConfig
type TestRuleRequest struct {
	// in:body
	Body TestRulePayload
}

// swagger:model
type TestRulePayload struct {
	Expr LotexQuery `json:"expr,omitempty"`
	// GrafanaManagedCondition for grafana alerts
	GrafanaManagedCondition EvalAlertConditionCommand `json:"grafana_condition,omitempty"`
}

// swagger:model
type LotexQuery struct {
	// Example: (node_filesystem_avail_bytes{fstype!="",job="integrations/node_exporter"} node_filesystem_size_bytes{fstype!="",job="integrations/node_exporter"} * 100 < 5 and node_filesystem_readonly{fstype!="",job="integrations/node_exporter"} == 0)
	Expr string
	// DatasourceUID is required if the query will be sent to grafana to be executed
	DatasourceUID string `json:"datasourceUid,omitempty"`
}

// swagger:model
type EvalAlertConditionCommand struct {
	Condition string            `json:"condition"`
	Data      []eval.AlertQuery `json:"data"`
	Now       time.Time         `json:"now"`
}

// swagger:model
type TestRuleResponse struct {
	Alerts                interface{}            `json:"alerts"`
	GrafanaAlertInstances AlertInstancesResponse `json:"grafana_alert_instances"`
}

// swagger:model
type AlertInstancesResponse struct {
	// Instances is an array of arrow encoded dataframes
	// each frame has a single row, and a column for each instance (alert identified by unique labels) with a boolean value (firing/not firing)
	Instances [][]byte `json:"instances"`
}

// swagger:model
type ExtendedReceiver struct {
	EmailConfigs     config.EmailConfig     `yaml:"email_configs,omitempty" json:"email_configs,omitempty"`
	PagerdutyConfigs config.PagerdutyConfig `yaml:"pagerduty_configs,omitempty" json:"pagerduty_configs,omitempty"`
	SlackConfigs     config.SlackConfig     `yaml:"slack_configs,omitempty" json:"slack_configs,omitempty"`
	WebhookConfigs   config.WebhookConfig   `yaml:"webhook_configs,omitempty" json:"webhook_configs,omitempty"`
	OpsGenieConfigs  config.OpsGenieConfig  `yaml:"opsgenie_configs,omitempty" json:"opsgenie_configs,omitempty"`
	WechatConfigs    config.WechatConfig    `yaml:"wechat_configs,omitempty" json:"wechat_configs,omitempty"`
	PushoverConfigs  config.PushoverConfig  `yaml:"pushover_configs,omitempty" json:"pushover_configs,omitempty"`
	VictorOpsConfigs config.VictorOpsConfig `yaml:"victorops_configs,omitempty" json:"victorops_configs,omitempty"`
	GrafanaReceiver  GrafanaReceiver        `yaml:"grafana_managed_receiver,omitempty" json:"grafana_managed_receiver,omitempty"`
}

// swagger:model
type Success ResponseDetails

// swagger:model
type SmtpNotEnabled ResponseDetails

// swagger:model
type Failure ResponseDetails

// swagger:model
type ResponseDetails struct {
	Msg string `json:"msg"`
}
