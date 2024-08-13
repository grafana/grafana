package definitions

// swagger:route GET /v1/provisioning/templates provisioning stable RouteGetTemplates
//
// Get all notification templates.
//
//     Responses:
//       200: NotificationTemplates
//       404: description: Not found.

// swagger:route GET /v1/provisioning/templates/{name} provisioning stable RouteGetTemplate
//
// Get a notification template.
//
//     Responses:
//       200: NotificationTemplate
//       404: description: Not found.

// swagger:route PUT /v1/provisioning/templates/{name} provisioning stable RoutePutTemplate
//
// Updates an existing notification template.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       202: NotificationTemplate
//       400: ValidationError
//       409: GenericPublicError

// swagger:route DELETE /v1/provisioning/templates/{name} provisioning stable RouteDeleteTemplate
//
// Delete a template.
//
//     Responses:
//       204: description: The template was deleted successfully.
//       409: GenericPublicError

// swagger:parameters RouteGetTemplate RoutePutTemplate RouteDeleteTemplate
type RouteGetTemplateParam struct {
	// Template Name
	// in:path
	Name string `json:"name"`
}

// swagger:parameters stable RouteDeleteTemplate
type RouteDeleteTemplateParam struct {
	// Template name
	// in:path
	Name string `json:"name"`

	// Version of template to use for optimistic concurrency. Leave empty to disable validation
	// in:query
	Version string `json:"version"`
}

// swagger:model
type NotificationTemplate struct {
	Name            string     `json:"name"`
	Template        string     `json:"template"`
	Provenance      Provenance `json:"provenance,omitempty"`
	ResourceVersion string     `json:"version,omitempty"`
}

// swagger:model
type NotificationTemplates []NotificationTemplate

type NotificationTemplateContent struct {
	Template        string `json:"template"`
	ResourceVersion string `json:"version,omitempty"`
}

// swagger:parameters RoutePutTemplate
type NotificationTemplatePayload struct {
	// in:body
	Body NotificationTemplateContent
}

// swagger:parameters RoutePutTemplate
type NotificationTemplateHeaders struct {
	// in:header
	XDisableProvenance string `json:"X-Disable-Provenance"`
}

func (t *NotificationTemplate) ResourceType() string {
	return "template"
}

func (t *NotificationTemplate) ResourceID() string {
	return t.Name
}
