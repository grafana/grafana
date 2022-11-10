package definitions

import (
	"encoding/json"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/prometheus/common/model"
)

// swagger:route GET /api/v1/provisioning/alert-rules provisioning stable RouteGetAlertRules
//
// Get all the alert rules.
//
//     Responses:
//       200: ProvisionedAlertRules

// swagger:route GET /api/v1/provisioning/alert-rules/{UID} provisioning stable RouteGetAlertRule
//
// Get a specific alert rule by UID.
//
//     Responses:
//       200: ProvisionedAlertRule
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

// swagger:parameters RouteGetAlertRule RoutePutAlertRule RouteDeleteAlertRule
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
	ID  int64  `json:"id"`
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
	// example: [{"refId":"A","queryType":"","relativeTimeRange":{"from":0,"to":0},"datasourceUid":"-100","model":{"conditions":[{"evaluator":{"params":[0,0],"type":"gt"},"operator":{"type":"and"},"query":{"params":[]},"reducer":{"params":[],"type":"avg"},"type":"query"}],"datasource":{"type":"__expr__","uid":"__expr__"},"expression":"1 == 1","hide":false,"intervalMs":1000,"maxDataPoints":43200,"refId":"A","type":"math"}}]
	Data []models.AlertQuery `json:"data"`
	// readonly: true
	Updated time.Time `json:"updated,omitempty"`
	// required: true
	NoDataState models.NoDataState `json:"noDataState"`
	// required: true
	ExecErrState models.ExecutionErrorState `json:"execErrState"`
	// required: true
	For model.Duration `json:"for"`
	// example: {"runbook_url": "https://supercoolrunbook.com/page/13"}
	Annotations map[string]string `json:"annotations,omitempty"`
	// example: {"team": "sre-team-1"}
	Labels map[string]string `json:"labels,omitempty"`
	// readonly: true
	Provenance models.Provenance `json:"provenance,omitempty"`
}

func (a *ProvisionedAlertRule) UpstreamModel() (models.AlertRule, error) {
	return models.AlertRule{
		ID:           a.ID,
		UID:          a.UID,
		OrgID:        a.OrgID,
		NamespaceUID: a.FolderUID,
		RuleGroup:    a.RuleGroup,
		Title:        a.Title,
		Condition:    a.Condition,
		Data:         a.Data,
		Updated:      a.Updated,
		NoDataState:  a.NoDataState,
		ExecErrState: a.ExecErrState,
		For:          time.Duration(a.For),
		Annotations:  a.Annotations,
		Labels:       a.Labels,
	}, nil
}

func NewAlertRule(rule models.AlertRule, provenance models.Provenance) ProvisionedAlertRule {
	return ProvisionedAlertRule{
		ID:           rule.ID,
		UID:          rule.UID,
		OrgID:        rule.OrgID,
		FolderUID:    rule.NamespaceUID,
		RuleGroup:    rule.RuleGroup,
		Title:        rule.Title,
		For:          model.Duration(rule.For),
		Condition:    rule.Condition,
		Data:         rule.Data,
		Updated:      rule.Updated,
		NoDataState:  rule.NoDataState,
		ExecErrState: rule.ExecErrState,
		Annotations:  rule.Annotations,
		Labels:       rule.Labels,
		Provenance:   provenance,
	}
}

func NewAlertRules(rules []*models.AlertRule) ProvisionedAlertRules {
	result := make([]ProvisionedAlertRule, 0, len(rules))
	for _, r := range rules {
		result = append(result, NewAlertRule(*r, models.ProvenanceNone))
	}
	return result
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
// Export a rule group in provisioning file format.
//
//     Produces:
//     - application/json
//     - application/yaml
//     - text/yaml
//
//     Responses:
//       200: AlertRuleGroupExport
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

// swagger:parameters RouteGetAlertRuleGroupExport
type ExportQueryParams struct {
	// Whether to initiate a download of the file or not.
	// in: query
	// required: false
	// default: false
	Download bool `json:"download"`
}

// swagger:model
type AlertRuleGroup struct {
	Title     string                 `json:"title"`
	FolderUID string                 `json:"folderUid"`
	Interval  int64                  `json:"interval"`
	Rules     []ProvisionedAlertRule `json:"rules"`
}

// AlertRuleGroupExport is the provisioned export of models.AlertRuleGroup.
// swagger:model
type AlertRuleGroupExport struct {
	OrgID    int64             `json:"orgId" yaml:"orgId"`
	Name     string            `json:"name" yaml:"name"`
	Folder   string            `json:"folder" yaml:"folder"`
	Interval model.Duration    `json:"interval" yaml:"interval"`
	Rules    []AlertRuleExport `json:"rules" yaml:"rules"`
}

// AlertRuleExport is the provisioned export of models.AlertRule.
// swagger:model
type AlertRuleExport struct {
	UID          string                     `json:"uid" yaml:"uid"`
	Title        string                     `json:"title" yaml:"title"`
	Condition    string                     `json:"condition" yaml:"condition"`
	Data         []AlertQueryExport         `json:"data" yaml:"data"`
	DashboardUID string                     `json:"dasboardUid,omitempty" yaml:"dashboardUid,omitempty"`
	PanelID      int64                      `json:"panelId,omitempty" yaml:"panelId,omitempty"`
	NoDataState  models.NoDataState         `json:"noDataState" yaml:"noDataState"`
	ExecErrState models.ExecutionErrorState `json:"execErrState" yaml:"execErrState"`
	For          model.Duration             `json:"for" yaml:"for"`
	Annotations  map[string]string          `json:"annotations,omitempty" yaml:"annotations,omitempty"`
	Labels       map[string]string          `json:"labels,omitempty" yaml:"labels,omitempty"`
}

// AlertQueryExport is the provisioned export of models.AlertQuery.
// swagger:model
type AlertQueryExport struct {
	RefID             string                   `json:"refId" yaml:"refId"`
	QueryType         string                   `json:"queryType,omitempty" yaml:"queryType,omitempty"`
	RelativeTimeRange models.RelativeTimeRange `json:"relativeTimeRange,omitempty" yaml:"relativeTimeRange,omitempty"`
	DatasourceUID     string                   `json:"datasourceUid" yaml:"datasourceUid"`
	Model             map[string]interface{}   `json:"model" yaml:"model"`
}

func (a *AlertRuleGroup) ToModel() (models.AlertRuleGroup, error) {
	ruleGroup := models.AlertRuleGroup{
		Title:     a.Title,
		FolderUID: a.FolderUID,
		Interval:  a.Interval,
	}
	for i := range a.Rules {
		converted, err := a.Rules[i].UpstreamModel()
		if err != nil {
			return models.AlertRuleGroup{}, err
		}
		ruleGroup.Rules = append(ruleGroup.Rules, converted)
	}
	return ruleGroup, nil
}

// NewAlertRuleGroupExport creates a AlertRuleGroupExport DTO from models.AlertRuleGroup.
func NewAlertRuleGroupExport(orgId int64, folderName string, d models.AlertRuleGroup) (AlertRuleGroupExport, error) {
	rules := make([]AlertRuleExport, 0, len(d.Rules))
	for i := range d.Rules {
		alert, err := NewAlertRuleExport(d.Rules[i])
		if err != nil {
			return AlertRuleGroupExport{}, err
		}
		rules = append(rules, alert)
	}
	return AlertRuleGroupExport{
		OrgID:    orgId,
		Name:     d.Title,
		Folder:   folderName,
		Interval: model.Duration(time.Duration(d.Interval) * time.Second),
		Rules:    rules,
	}, nil
}

// NewAlertRuleExport creates a AlertRuleExport DTO from models.AlertRule.
func NewAlertRuleExport(rule models.AlertRule) (AlertRuleExport, error) {
	data := make([]AlertQueryExport, 0, len(rule.Data))
	for i := range rule.Data {
		query, err := NewAlertQueryExport(rule.Data[i])
		if err != nil {
			return AlertRuleExport{}, err
		}
		data = append(data, query)
	}

	var dashboardUID string
	if rule.DashboardUID != nil {
		dashboardUID = *rule.DashboardUID
	}

	var panelID int64
	if rule.PanelID != nil {
		panelID = *rule.PanelID
	}

	return AlertRuleExport{
		UID:          rule.UID,
		Title:        rule.Title,
		For:          model.Duration(rule.For),
		Condition:    rule.Condition,
		Data:         data,
		DashboardUID: dashboardUID,
		PanelID:      panelID,
		NoDataState:  rule.NoDataState,
		ExecErrState: rule.ExecErrState,
		Annotations:  rule.Annotations,
		Labels:       rule.Labels,
	}, nil
}

// NewAlertQueryExport creates a AlertQueryExport DTO from models.AlertQuery.
func NewAlertQueryExport(query models.AlertQuery) (AlertQueryExport, error) {
	// We unmarshal the json.RawMessage model into a map in order to facilitate yaml marshalling.
	var mdl map[string]interface{}
	err := json.Unmarshal(query.Model, &mdl)
	if err != nil {
		return AlertQueryExport{}, err
	}
	return AlertQueryExport{
		RefID:             query.RefID,
		QueryType:         query.QueryType,
		RelativeTimeRange: query.RelativeTimeRange,
		DatasourceUID:     query.DatasourceUID,
		Model:             mdl,
	}, nil
}

func NewAlertRuleGroupFromModel(d models.AlertRuleGroup) AlertRuleGroup {
	rules := make([]ProvisionedAlertRule, 0, len(d.Rules))
	for i := range d.Rules {
		rules = append(rules, NewAlertRule(d.Rules[i], d.Provenance))
	}
	return AlertRuleGroup{
		Title:     d.Title,
		FolderUID: d.FolderUID,
		Interval:  d.Interval,
		Rules:     rules,
	}
}
