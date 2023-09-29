package definitions

import (
	"time"

	"github.com/prometheus/common/model"
)

// swagger:route GET /api/v1/provisioning/alert-rules provisioning stable RouteGetAlertRules
//
// Get all the alert rules.
//
//     Responses:
//       200: ProvisionedAlertRules

// swagger:route GET /api/v1/provisioning/alert-rules/export provisioning stable RouteGetAlertRulesExport
//
// Export all alert rules in provisioning file format.
//
//     Responses:
//       200: AlertingFileExport
//       404: description: Not found.

// swagger:route GET /api/v1/provisioning/alert-rules/{UID} provisioning stable RouteGetAlertRule
//
// Get a specific alert rule by UID.
//
//     Responses:
//       200: ProvisionedAlertRule
//       404: description: Not found.

// swagger:route GET /api/v1/provisioning/alert-rules/{UID}/export provisioning stable RouteGetAlertRuleExport
//
// Export an alert rule in provisioning file format.
//
//     Produces:
//     - application/json
//     - application/yaml
//     - text/yaml
//
//     Responses:
//       200: AlertingFileExport
//       404: description: Not found.

// swagger:route POST /api/v1/provisioning/alert-rules provisioning stable RoutePostAlertRule
//
// Create a new alert rule.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       201: ProvisionedAlertRule
//       400: ValidationError

// swagger:route PUT /api/v1/provisioning/alert-rules/{UID} provisioning stable RoutePutAlertRule
//
// Update an existing alert rule.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       200: ProvisionedAlertRule
//       400: ValidationError

// swagger:route DELETE /api/v1/provisioning/alert-rules/{UID} provisioning stable RouteDeleteAlertRule
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

// swagger:parameters RoutePostAlertRule RoutePutAlertRule
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
	For model.Duration `json:"for"`
	// example: {"runbook_url": "https://supercoolrunbook.com/page/13"}
	Annotations map[string]string `json:"annotations,omitempty"`
	// example: {"team": "sre-team-1"}
	Labels map[string]string `json:"labels,omitempty"`
	// readonly: true
	Provenance Provenance `json:"provenance,omitempty"`
	// example: false
	IsPaused bool `json:"isPaused"`
}

// swagger:route GET /api/v1/provisioning/folder/{FolderUID}/rule-groups/{Group} provisioning stable RouteGetAlertRuleGroup
//
// Get a rule group.
//
//     Responses:
//       200: AlertRuleGroup
//       404: description: Not found.

// swagger:route GET /api/v1/provisioning/folder/{FolderUID}/rule-groups/{Group}/export provisioning stable RouteGetAlertRuleGroupExport
//
// Export an alert rule group in provisioning file format.
//
//     Produces:
//     - application/json
//     - application/yaml
//     - text/yaml
//
//     Responses:
//       200: AlertingFileExport
//       404: description: Not found.

// swagger:route PUT /api/v1/provisioning/folder/{FolderUID}/rule-groups/{Group} provisioning stable RoutePutAlertRuleGroup
//
// Update the interval of a rule group.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       200: AlertRuleGroup
//       400: ValidationError

// swagger:parameters RouteGetAlertRuleGroup RoutePutAlertRuleGroup RouteGetAlertRuleGroupExport
type FolderUIDPathParam struct {
	// in:path
	FolderUID string `json:"FolderUID"`
}

// swagger:parameters RouteGetAlertRuleGroup RoutePutAlertRuleGroup RouteGetAlertRuleGroupExport
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
	UID          string              `json:"uid,omitempty" yaml:"uid,omitempty"`
	Title        string              `json:"title" yaml:"title" hcl:"name"`
	Condition    string              `json:"condition" yaml:"condition" hcl:"condition"`
	Data         []AlertQueryExport  `json:"data" yaml:"data" hcl:"data,block"`
	DashboardUID string              `json:"dasboardUid,omitempty" yaml:"dashboardUid,omitempty"`
	PanelID      int64               `json:"panelId,omitempty" yaml:"panelId,omitempty"`
	NoDataState  NoDataState         `json:"noDataState" yaml:"noDataState" hcl:"no_data_state"`
	ExecErrState ExecutionErrorState `json:"execErrState" yaml:"execErrState" hcl:"exec_err_state"`
	For          model.Duration      `json:"for" yaml:"for"`
	ForSeconds   int64               `json:"-" yaml:"-" hcl:"for"`
	Annotations  map[string]string   `json:"annotations,omitempty" yaml:"annotations,omitempty" hcl:"annotations"`
	Labels       map[string]string   `json:"labels,omitempty" yaml:"labels,omitempty" hcl:"labels"`
	IsPaused     bool                `json:"isPaused" yaml:"isPaused" hcl:"is_paused"`
}

// AlertQueryExport is the provisioned export of models.AlertQuery.
type AlertQueryExport struct {
	RefID             string                  `json:"refId" yaml:"refId" hcl:"ref_id"`
	QueryType         string                  `json:"queryType,omitempty" yaml:"queryType,omitempty" hcl:"query_type"`
	RelativeTimeRange RelativeTimeRangeExport `json:"relativeTimeRange,omitempty" yaml:"relativeTimeRange,omitempty" hcl:"relative_time_range,block"`
	DatasourceUID     string                  `json:"datasourceUid" yaml:"datasourceUid" hcl:"datasource_uid"`
	Model             map[string]any          `json:"model" yaml:"model"`
	ModelString       string                  `json:"-" yaml:"-" hcl:"model"`
}

type RelativeTimeRangeExport struct {
	FromSeconds int64 `json:"from" yaml:"from" hcl:"from"`
	ToSeconds   int64 `json:"to" yaml:"to" hcl:"to"`
}
