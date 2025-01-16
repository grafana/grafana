package definitions

import (
	"github.com/grafana/grafana/pkg/components/simplejson"
)

// swagger:route GET /v1/provisioning/contact-points provisioning stable RouteGetContactpoints
//
// Get all the contact points.
//
//     Responses:
//       200: ContactPoints

// swagger:route GET /v1/provisioning/contact-points/export provisioning stable RouteGetContactpointsExport
//
// Export all contact points in provisioning file format.
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
//       403: PermissionDenied

// swagger:route POST /v1/provisioning/contact-points provisioning stable RoutePostContactpoints
//
// Create a contact point.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       202: EmbeddedContactPoint
//       400: ValidationError

// swagger:route PUT /v1/provisioning/contact-points/{UID} provisioning stable RoutePutContactpoint
//
// Update an existing contact point.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       202: Ack
//       400: ValidationError

// swagger:route DELETE /v1/provisioning/contact-points/{UID} provisioning stable RouteDeleteContactpoints
//
// Delete a contact point.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       202: description: The contact point was deleted successfully.

// swagger:parameters RoutePutContactpoint RouteDeleteContactpoints
type ContactPointUIDReference struct {
	// UID is the contact point unique identifier
	// in:path
	UID string
}

// swagger:parameters RouteGetContactpoints RouteGetContactpointsExport
type ContactPointParams struct {
	// Filter by name
	// in: query
	// required: false
	Name string `json:"name"`
}

// swagger:parameters RoutePostContactpoints RoutePutContactpoint
type ContactPointPayload struct {
	// in:body
	Body EmbeddedContactPoint
}

// swagger:model
type ContactPoints []EmbeddedContactPoint

// swagger:parameters RoutePostContactpoints RoutePutContactpoint
type ContactPointHeaders struct {
	// in:header
	XDisableProvenance string `json:"X-Disable-Provenance"`
}

// EmbeddedContactPoint is the contact point type that is used
// by grafanas embedded alertmanager implementation.
// swagger:model
type EmbeddedContactPoint struct {
	// UID is the unique identifier of the contact point. The UID can be
	// set by the user.
	// required: false
	// minLength: 1
	// maxLength: 40
	// pattern: ^[a-zA-Z0-9\-\_]+$
	// example: my_external_reference
	UID string `json:"uid"`
	// Name is used as grouping key in the UI. Contact points with the
	// same name will be grouped in the UI.
	// example: webhook_1
	Name string `json:"name" binding:"required"`
	// required: true
	// example: webhook
	// enum: alertmanager,dingding,discord,email,googlechat,kafka,line,opsgenie,pagerduty,pushover,sensugo,slack,teams,telegram,threema,victorops,webhook,wecom
	Type string `json:"type" binding:"required"`
	// required: true
	Settings *simplejson.Json `json:"settings" binding:"required"`
	// example: false
	DisableResolveMessage bool `json:"disableResolveMessage"`
	// readonly: true
	Provenance string `json:"provenance,omitempty"`
}

// ContactPointExport is the provisioned file export of alerting.ContactPointV1.
type ContactPointExport struct {
	OrgID     int64            `json:"orgId" yaml:"orgId"`
	Name      string           `json:"name" yaml:"name"`
	Receivers []ReceiverExport `json:"receivers" yaml:"receivers"`
}

// ReceiverExport is the provisioned file export of alerting.ReceiverV1.
type ReceiverExport struct {
	UID                   string     `json:"uid" yaml:"uid"`
	Type                  string     `json:"type" yaml:"type"`
	Settings              RawMessage `json:"settings" yaml:"settings"`
	DisableResolveMessage bool       `json:"disableResolveMessage" yaml:"disableResolveMessage"`
}

const RedactedValue = "[REDACTED]"

func (e *EmbeddedContactPoint) ResourceID() string {
	return e.UID
}

func (e *EmbeddedContactPoint) ResourceType() string {
	return "contactPoint"
}
