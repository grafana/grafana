package definitions

import (
	"time"

	"github.com/prometheus/common/model"
)

// swagger:route GET /v1/provisioning/alert-rules provisioning stable RouteGetAlertRules
//
// Get all the alert rules.
//
//     Responses:
//       200: ProvisionedAlertRules

// swagger:route GET /v1/provisioning/alert-rules/export provisioning stable RouteGetAlertRulesExport
//
// Export all alert rules in provisioning file format.
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
//       404: description: Not found.

// swagger:route GET /v1/provisioning/alert-rules/{UID} provisioning stable RouteGetAlertRule
//
// Get a specific alert rule by UID.
//
//     Responses:
//       200: ProvisionedAlertRule
//       404: description: Not found.

// swagger:route GET /v1/provisioning/alert-rules/{UID}/export provisioning stable RouteGetAlertRuleExport
//
// Export an alert rule in provisioning file format.
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
//       404: description: Not found.

// swagger:route POST /v1/provisioning/alert-rules provisioning stable RoutePostAlertRule
//
// Create a new alert rule.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       201: ProvisionedAlertRule
//       400: ValidationError

// swagger:route PUT /v1/provisioning/alert-rules/{UID} provisioning stable RoutePutAlertRule
//
// Update an existing alert rule.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       200: ProvisionedAlertRule
//       400: ValidationError

// swagger:route DELETE /v1/provisioning/alert-rules/{UID} provisioning stable RouteDeleteAlertRule
//
// Delete a specific alert rule by UID.
//
//     Responses:
//       204: description: The alert rule was deleted successfully.

// swagger:parameters RouteGetAlertRulesExport RouteGetRulesForExport
type AlertRulesExportParameters struct {
	ExportQueryParams
	// UIDs of folders from which to export rules
	// in:query
	// required:false
	FolderUID []string `json:"folderUid"`

	// Name of group of rules to export. Must be specified only together with a single folder UID
	// in:query
	// required: false
	GroupName string `json:"group"`

	// UID of alert rule to export. If specified, parameters folderUid and group must be empty.
	// in:query
	// required: false
	RuleUID string `json:"ruleUid"`
}

// swagger:parameters RouteGetAlertRule RoutePutAlertRule RouteDeleteAlertRule RouteGetAlertRuleExport
type AlertRuleUIDReference struct {
	// Alert rule UID
	// in:path
	UID string
}

// swagger:parameters RoutePostAlertRule RoutePutAlertRule
type AlertRulePayload struct {
	// in:body
	Body ProvisionedAlertRule
}

// swagger:parameters RoutePostAlertRule RoutePutAlertRule RouteDeleteAlertRule RoutePutAlertRuleGroup
type AlertRuleHeaders struct {
	// in:header
	XDisableProvenance string `json:"X-Disable-Provenance"`
}

// swagger:model
type ProvisionedAlertRules []ProvisionedAlertRule

type ProvisionedAlertRule struct {
	ID int64 `json:"id"`
	// required: false
	// minLength: 1
	// maxLength: 40
	// pattern: ^[a-zA-Z0-9-_]+$
	UID string `json:"uid"`
	// required: true
	OrgID int64 `json:"orgID"`
	// required: true
	// example: project_x
	FolderUID string `json:"folderUID"`
	// required: true
	// minLength: 1
	// maxLength: 190
	// example: eval_group_1
	RuleGroup string `json:"ruleGroup"`
	// required: true
	// minLength: 1
	// maxLength: 190
	// example: Always firing
	Title string `json:"title"`
	// required: true
	// example: A
	Condition string `json:"condition"`
	// required: true
	// example: [{"refId":"A","queryType":"","relativeTimeRange":{"from":0,"to":0},"datasourceUid":"__expr__","model":{"conditions":[{"evaluator":{"params":[0,0],"type":"gt"},"operator":{"type":"and"},"query":{"params":[]},"reducer":{"params":[],"type":"avg"},"type":"query"}],"datasource":{"type":"__expr__","uid":"__expr__"},"expression":"1 == 1","hide":false,"intervalMs":1000,"maxDataPoints":43200,"refId":"A","type":"math"}}]
	Data []AlertQuery `json:"data"`
	// readonly: true
	Updated time.Time `json:"updated,omitempty"`
	// required: true
	NoDataState NoDataState `json:"noDataState"`
	// required: true
	ExecErrState ExecutionErrorState `json:"execErrState"`
	// required: true
	// swagger:strfmt duration
	For model.Duration `json:"for"`
	// required: false
	// swagger:strfmt duration
	KeepFiringFor model.Duration `json:"keep_firing_for"`
	// example: {"runbook_url": "https://supercoolrunbook.com/page/13"}
	Annotations map[string]string `json:"annotations,omitempty"`
	// example: {"team": "sre-team-1"}
	Labels map[string]string `json:"labels,omitempty"`
	// readonly: true
	Provenance Provenance `json:"provenance,omitempty"`
	// example: false
	IsPaused bool `json:"isPaused"`
	// example: {"receiver":"email","group_by":["alertname","grafana_folder","cluster"],"group_wait":"30s","group_interval":"1m","repeat_interval":"4d","mute_time_intervals":["Weekends","Holidays"]}
	NotificationSettings *AlertRuleNotificationSettings `json:"notification_settings"`
	// example: {"metric":"grafana_alerts_ratio", "from":"A"}
	Record *Record `json:"record"`
	// example: 2
	MissingSeriesEvalsToResolve *int `json:"missingSeriesEvalsToResolve,omitempty"`
}

// swagger:route GET /v1/provisioning/folder/{FolderUID}/rule-groups/{Group} provisioning stable RouteGetAlertRuleGroup
//
// Get a rule group.
//
//     Responses:
//       200: AlertRuleGroup
//       404: description: Not found.

// swagger:route DELETE /v1/provisioning/folder/{FolderUID}/rule-groups/{Group} provisioning stable RouteDeleteAlertRuleGroup
//
// Delete rule group
//
//     Responses:
//       204: description: The alert rule group was deleted successfully.
//       403: ForbiddenError
//       404: NotFound

// swagger:route GET /v1/provisioning/folder/{FolderUID}/rule-groups/{Group}/export provisioning stable RouteGetAlertRuleGroupExport
//
// Export an alert rule group in provisioning file format.
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
//       404: description: Not found.

// swagger:route PUT /v1/provisioning/folder/{FolderUID}/rule-groups/{Group} provisioning stable RoutePutAlertRuleGroup
//
// Create or update alert rule group.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       200: AlertRuleGroup
//       400: ValidationError

// swagger:parameters RouteGetAlertRuleGroup RoutePutAlertRuleGroup RouteGetAlertRuleGroupExport RouteDeleteAlertRuleGroup
type FolderUIDPathParam struct {
	// in:path
	FolderUID string `json:"FolderUID"`
}

// swagger:parameters RouteGetAlertRuleGroup RoutePutAlertRuleGroup RouteGetAlertRuleGroupExport RouteDeleteAlertRuleGroup
type RuleGroupPathParam struct {
	// in:path
	Group string `json:"Group"`
}

// swagger:parameters RoutePutAlertRuleGroup
type AlertRuleGroupPayload struct {
	// in:body
	Body AlertRuleGroup
}

// swagger:model
type AlertRuleGroupMetadata struct {
	Interval int64 `json:"interval"`
}

// swagger:model
type AlertRuleGroup struct {
	Title     string                 `json:"title"`
	FolderUID string                 `json:"folderUid"`
	Interval  int64                  `json:"interval"`
	Rules     []ProvisionedAlertRule `json:"rules"`
}

// AlertRuleGroupExport is the provisioned file export of AlertRuleGroupV1.
type AlertRuleGroupExport struct {
	OrgID           int64             `json:"orgId" yaml:"orgId" hcl:"org_id"`
	Name            string            `json:"name" yaml:"name" hcl:"name"`
	Folder          string            `json:"folder" yaml:"folder"`
	FolderUID       string            `json:"-" yaml:"-" hcl:"folder_uid"`
	Interval        model.Duration    `json:"interval" yaml:"interval"`
	IntervalSeconds int64             `json:"-" yaml:"-" hcl:"interval_seconds"`
	Rules           []AlertRuleExport `json:"rules" yaml:"rules" hcl:"rule,block"`
}

// AlertRuleExport is the provisioned file export of models.AlertRule.
type AlertRuleExport struct {
	UID           string               `json:"uid,omitempty" yaml:"uid,omitempty"`
	Title         string               `json:"title" yaml:"title" hcl:"name"`
	Condition     *string              `json:"condition,omitempty" yaml:"condition,omitempty" hcl:"condition"`
	Data          []AlertQueryExport   `json:"data" yaml:"data" hcl:"data,block"`
	DashboardUID  *string              `json:"dashboardUid,omitempty" yaml:"dashboardUid,omitempty"`
	PanelID       *int64               `json:"panelId,omitempty" yaml:"panelId,omitempty"`
	NoDataState   *NoDataState         `json:"noDataState,omitempty" yaml:"noDataState,omitempty" hcl:"no_data_state"`
	ExecErrState  *ExecutionErrorState `json:"execErrState,omitempty" yaml:"execErrState,omitempty" hcl:"exec_err_state"`
	For           model.Duration       `json:"for,omitempty" yaml:"for,omitempty"`
	KeepFiringFor model.Duration       `json:"keepFiringFor,omitempty" yaml:"keepFiringFor,omitempty"`
	// ForString and KeepFiringForString are used to:
	// - Only export the for field for HCL if it is non-zero.
	// - Format the Prometheus model.Duration type properly for HCL.
	ForString                   *string                              `json:"-" yaml:"-" hcl:"for"`
	KeepFiringForString         *string                              `json:"-" yaml:"-" hcl:"keep_firing_for"`
	Annotations                 *map[string]string                   `json:"annotations,omitempty" yaml:"annotations,omitempty" hcl:"annotations"`
	Labels                      *map[string]string                   `json:"labels,omitempty" yaml:"labels,omitempty" hcl:"labels"`
	IsPaused                    bool                                 `json:"isPaused" yaml:"isPaused" hcl:"is_paused"`
	NotificationSettings        *AlertRuleNotificationSettingsExport `json:"notification_settings,omitempty" yaml:"notification_settings,omitempty" hcl:"notification_settings,block"`
	Record                      *AlertRuleRecordExport               `json:"record,omitempty" yaml:"record,omitempty" hcl:"record,block"`
	MissingSeriesEvalsToResolve *int                                 `json:"missing_series_evals_to_resolve,omitempty" yaml:"missing_series_evals_to_resolve,omitempty" hcl:"missing_series_evals_to_resolve"`
}

// AlertQueryExport is the provisioned export of models.AlertQuery.
type AlertQueryExport struct {
	RefID             string                  `json:"refId" yaml:"refId" hcl:"ref_id"`
	QueryType         *string                 `json:"queryType,omitempty" yaml:"queryType,omitempty" hcl:"query_type"`
	RelativeTimeRange RelativeTimeRangeExport `json:"relativeTimeRange,omitempty" yaml:"relativeTimeRange,omitempty" hcl:"relative_time_range,block"`
	DatasourceUID     string                  `json:"datasourceUid" yaml:"datasourceUid" hcl:"datasource_uid"`
	Model             map[string]any          `json:"model" yaml:"model"`
	ModelString       string                  `json:"-" yaml:"-" hcl:"model"`
}

type RelativeTimeRangeExport struct {
	FromSeconds int64 `json:"from" yaml:"from" hcl:"from"`
	ToSeconds   int64 `json:"to" yaml:"to" hcl:"to"`
}

// AlertRuleNotificationSettingsExport is the provisioned export of models.NotificationSettings.
type AlertRuleNotificationSettingsExport struct {
	// Field name mismatches with Terraform provider schema are noted where applicable.

	Receiver            string   `yaml:"receiver,omitempty" json:"receiver,omitempty" hcl:"contact_point"` // TF -> `contact_point`
	GroupBy             []string `yaml:"group_by,omitempty" json:"group_by,omitempty" hcl:"group_by"`
	GroupWait           *string  `yaml:"group_wait,omitempty" json:"group_wait,omitempty" hcl:"group_wait,optional"`
	GroupInterval       *string  `yaml:"group_interval,omitempty" json:"group_interval,omitempty" hcl:"group_interval,optional"`
	RepeatInterval      *string  `yaml:"repeat_interval,omitempty" json:"repeat_interval,omitempty" hcl:"repeat_interval,optional"`
	MuteTimeIntervals   []string `yaml:"mute_time_intervals,omitempty" json:"mute_time_intervals,omitempty" hcl:"mute_timings"`       // TF -> `mute_timings`
	ActiveTimeIntervals []string `yaml:"active_time_intervals,omitempty" json:"active_time_intervals,omitempty" hcl:"active_timings"` // TF -> `active_timings`
}

// Record is the provisioned export of models.Record.
type AlertRuleRecordExport struct {
	Metric              string  `json:"metric" yaml:"metric" hcl:"metric"`
	From                string  `json:"from" yaml:"from" hcl:"from"`
	TargetDatasourceUID *string `json:"targetDatasourceUid,omitempty" yaml:"targetDatasourceUid,omitempty" hcl:"target_datasource_uid,optional"`
}
