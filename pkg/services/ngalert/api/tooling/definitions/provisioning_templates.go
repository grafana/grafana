package definitions

import (
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// swagger:route GET /api/v1/provisioning/templates provisioning stable RouteGetTemplates
//
// Get all message templates.
//
//     Responses:
//       200: MessageTemplate
//       400: ValidationError

// swagger:route GET /api/v1/provisioning/templates/{name} provisioning stable RouteGetTemplate
//
// Get a message template.
//
//     Responses:
//       200: MessageTemplate
//       404: NotFound

// swagger:route PUT /api/v1/provisioning/templates/{name} provisioning stable RoutePutTemplate
//
// Updates an existing template.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       202: Ack
//       400: ValidationError

// swagger:route DELETE /api/v1/provisioning/templates/{name} provisioning stable RouteDeleteTemplate
//
// Delete a template.
//
//     Responses:
//       204: Ack

// swagger:parameters RouteGetTemplate RoutePutTemplate RouteDeleteTemplate
type RouteGetTemplateParam struct {
	// Template Name
	// in:path
	Name string `json:"name"`
}

// swagger:model
type MessageTemplate struct {
	Name       string
	Template   string
	Provenance models.Provenance `json:"provenance,omitempty"`
}

// swagger:model
type MessageTemplates []MessageTemplate

type MessageTemplateContent struct {
	Template string
}

// swagger:parameters RoutePutTemplate
type MessageTemplatePayload struct {
	// in:body
	Body MessageTemplateContent
}

func (t *MessageTemplate) ResourceType() string {
	return "template"
}

func (t *MessageTemplate) ResourceID() string {
	return t.Name
}
