package definitions

import (
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// swagger:route GET /api/v1/provisioning/alert-rules/{UID} provisioning stable RouteGetAlertRule
//
// Get a specific alert rule by UID.
//
//     Responses:
//       200: AlertRule
//       400: ValidationError

// swagger:route POST /api/v1/provisioning/alert-rules provisioning stable RoutePostAlertRule
//
// Create a new alert rule.
//
//     Responses:
//       201: AlertRule
//       400: ValidationError

// swagger:route PUT /api/v1/provisioning/alert-rules/{UID} provisioning stable RoutePutAlertRule
//
// Update an existing alert rule.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       200: AlertRule
//       400: ValidationError

// swagger:route DELETE /api/v1/provisioning/alert-rules/{UID} provisioning stable RouteDeleteAlertRule
//
// Delete a specific alert rule by UID.
//
//     Responses:
//       204: description: The alert rule was deleted successfully.
//       400: ValidationError

// swagger:parameters RouteGetAlertRule RoutePutAlertRule RouteDeleteAlertRule
type AlertRuleUIDReference struct {
	// in:path
	UID string
}

// swagger:parameters RoutePostAlertRule RoutePutAlertRule
type AlertRulePayload struct {
	// in:body
	Body AlertRule
}

type AlertRule struct {
	ID           int64                      `json:"id"`
	UID          string                     `json:"uid"`
	OrgID        int64                      `json:"orgID"`
	FolderUID    string                     `json:"folderUID"`
	RuleGroup    string                     `json:"ruleGroup"`
	Title        string                     `json:"title"`
	Condition    string                     `json:"condition"`
	Data         []models.AlertQuery        `json:"data"`
	Updated      time.Time                  `json:"updated,omitempty"`
	NoDataState  models.NoDataState         `json:"noDataState"`
	ExecErrState models.ExecutionErrorState `json:"execErrState"`
	For          time.Duration              `json:"for"`
	Annotations  map[string]string          `json:"annotations,omitempty"`
	Labels       map[string]string          `json:"labels,omitempty"`
	Provenance   models.Provenance          `json:"provenance,omitempty"`
}

func (a *AlertRule) UpstreamModel() models.AlertRule {
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
		For:          a.For,
		Annotations:  a.Annotations,
		Labels:       a.Labels,
	}
}

func NewAlertRule(rule models.AlertRule, provenance models.Provenance) AlertRule {
	return AlertRule{
		ID:           rule.ID,
		UID:          rule.UID,
		OrgID:        rule.OrgID,
		FolderUID:    rule.NamespaceUID,
		RuleGroup:    rule.RuleGroup,
		Title:        rule.Title,
		For:          rule.For,
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

// swagger:parameters RoutePutAlertRuleGroup
type FolderUIDPathParam struct {
	// in:path
	FolderUID string `json:"FolderUID"`
}

// swagger:parameters RoutePutAlertRuleGroup
type RuleGroupPathParam struct {
	// in:path
	Group string `json:"Group"`
}

// swagger:parameters RoutePutAlertRuleGroup
type AlertRuleGroupPayload struct {
	// in:body
	Body AlertRuleGroup
}

type AlertRuleGroup struct {
	Interval int64 `json:"interval"`
}
