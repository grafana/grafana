package definitions

import "github.com/grafana/grafana/pkg/services/ngalert/models"

// swagger:route POST /api/provisioning/alert-rules provisioning RoutePostAlertRule
//
// Get all the contact points.
//
//     Responses:
//       200: Route
//       400: ValidationError

// swagger:route PUT /api/provisioning/alert-rules/{ID} provisioning RoutePutAlertRule
//
// Create a contact point.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       202: Accepted
//       400: ValidationError

// swagger:route DELETE /api/provisioning/alert-rules/{ID} provisioning RouteDeleteAlertRule
//
// Update an existing contact point.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       202: Accepted
//       400: ValidationError

// swagger:parameters RoutePostAlertRule RoutePutAlertRule
type AlerRule struct {
	ID         int64             `json:"id"`
	UID        string            `json:"uid"`
	OrgID      int64             `json:"orgID"`
	FolderUID  int64             `json:"folderUID"`
	Group      string            `json:"group"`
	Provenance models.Provenance `json:"provenance"`
}

// swagger:route PUT /api/provisioning/alert-rules/groups/{Group} provisioning RoutePutAlertRuleGroup
//
// Update the interval of an rulegroup
//
//     Consumes:
//     - application/json
//
//     Responses:
//       202: Accepted
//       400: ValidationError

// EmbeddedContactPoint is the contact point type that is used
// by grafanas embedded alertmanager implementation.
// swagger:parameters RoutePutAlertRuleGroup
type AlertRuleGroup struct {
	Interval int64 `json:"interval"`
}
