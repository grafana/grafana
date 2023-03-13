package definitions

// swagger:route GET /api/v1/provisioning/templates provisioning stable RouteGetTemplates
//
// Get all notification templates.
//
//     Responses:
//       200: NotificationTemplates
//       404: description: Not found.

// swagger:route GET /api/v1/provisioning/templates/{name} provisioning stable RouteGetTemplate
//
// Get a notification template.
//
//     Responses:
//       200: NotificationTemplate
//       404: description: Not found.

// swagger:route PUT /api/v1/provisioning/templates/{name} provisioning stable RoutePutTemplate
//
// Updates an existing notification template.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       202: NotificationTemplate
//       400: ValidationError

// swagger:route DELETE /api/v1/provisioning/templates/{name} provisioning stable RouteDeleteTemplate
//
// Delete a template.
//
//     Responses:
//       204: description: The template was deleted successfully.

// swagger:parameters RouteGetTemplate RoutePutTemplate RouteDeleteTemplate
type RouteGetTemplateParam struct {
	// Template Name
	// in:path
	Name string `json:"name"`
}

// swagger:model
type NotificationTemplate struct {
	Name       string     `json:"name"`
	Template   string     `json:"template"`
	Provenance Provenance `json:"provenance,omitempty"`
}

// swagger:model
type NotificationTemplates []NotificationTemplate

type NotificationTemplateContent struct {
	Template string `json:"template"`
}

// swagger:parameters RoutePutTemplate
type NotificationTemplatePayload struct {
	// in:body
	Body NotificationTemplateContent
}

func (t *NotificationTemplate) ResourceType() string {
	return "template"
}

func (t *NotificationTemplate) ResourceID() string {
	return t.Name
}
