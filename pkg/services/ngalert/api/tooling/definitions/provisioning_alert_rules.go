package definitions

import (
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// swagger:route GET /api/provisioning/alert-rules/{UID} provisioning RouteGetAlertRule
//
// Get all the contact points.
//
//     Responses:
//       200: AlertRule
//       400: ValidationError

// swagger:route POST /api/provisioning/alert-rules provisioning RoutePostAlertRule
//
// Get all the contact points.
//
//     Responses:
//       200: AlertRule
//       400: ValidationError

// swagger:route PUT /api/provisioning/alert-rules/{UID} provisioning RoutePutAlertRule
//
// Create a contact point.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       202: AlertRule
//       400: ValidationError

// swagger:route DELETE /api/provisioning/alert-rules/{UID} provisioning RouteDeleteAlertRule
//
// Update an existing contact point.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       202: Ack
//       400: ValidationError

// swagger:parameters RoutePostAlertRule RoutePutAlertRule
type AlertRulePayload struct {
	// in:body
	Body AlertRule
}

type AlertRule struct {
	ID           int64                      `json:"id"`
	UID          string                     `json:"uid"`
	OrgID        int64                      `json:"orgID"`
	FolderUID    string                     `json:"folder"`
	RuleGroup    string                     `json:"ruleGroup"`
	Title        string                     `json:"title"`
	Condition    string                     `json:"condition"`
	Data         []models.AlertQuery        `json:"data"`
	Updated      time.Time                  `json:"updated"`
	DashboardUID string                     `json:"dashboardUID,omitempty"`
	PanelID      int64                      `json:"panelID,omitempty"`
	NoDataState  models.NoDataState         `json:"noDataState"`
	ExecErrState models.ExecutionErrorState `json:"execErrState"`
	For          time.Duration              `json:"for"`
	Annotations  map[string]string          `json:"annotations"`
	Labels       map[string]string          `json:"labels"`
	Provenance   models.Provenance          `json:"provenance"`
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
		DashboardUID: &a.DashboardUID,
		PanelID:      &a.PanelID,
		NoDataState:  a.NoDataState,
		ExecErrState: a.ExecErrState,
		For:          a.For,
		Annotations:  a.Annotations,
		Labels:       a.Labels,
	}
}

// swagger:route PUT /api/provisioning/alert-rules/folder/{FolderUID}/groups/{Group} provisioning RoutePutAlertRuleGroup
//
// Update the interval of an rulegroup
//
//     Consumes:
//     - application/json
//
//     Responses:
//       202: AlertRuleGroup
//       400: ValidationError

// swagger:parameters RoutePutAlertRuleGroup
type AlertRuleGroupPayload struct {
	// in:body
	Body AlertRuleGroup
}
type AlertRuleGroup struct {
	Interval int64 `json:"interval"`
}
