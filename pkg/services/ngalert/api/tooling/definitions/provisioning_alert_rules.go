package definitions

import (
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/prometheus/common/model"
)

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
	forDur, err := time.ParseDuration(a.For.String())
	if err != nil {
		return models.AlertRule{}, err
	}
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
		For:          forDur,
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

// swagger:route GET /api/v1/provisioning/folder/{FolderUID}/rule-groups/{Group} provisioning stable RouteGetAlertRuleGroup
//
// Get a rule group.
//
//     Responses:
//       200: AlertRuleGroup
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

// swagger:parameters RouteGetAlertRuleGroup RoutePutAlertRuleGroup
type FolderUIDPathParam struct {
	// in:path
	FolderUID string `json:"FolderUID"`
}

// swagger:parameters RouteGetAlertRuleGroup RoutePutAlertRuleGroup
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
