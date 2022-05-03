package definitions

import "fmt"

// swagger:route GET /api/provisioning/templates provisioning RouteGetTemplates
//
// Get all message templates.
//
//     Responses:
//       200: []MessageTemplate
//       400: ValidationError

// swagger:route GET /api/provisioning/templates/{ID} provisioning RouteGetTemplate
//
// Get a message template.
//
//     Responses:
//       200: MessageTemplate
//       404: NotFound

// swagger:route PUT /api/provisioning/templates/{ID} provisioning RoutePutTemplate
//
// Updates an existing template.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       202: Accepted
//       400: ValidationError

// swagger:route DELETE /api/provisioning/templates/{ID} provisioning RouteDeleteTemplate
//
// Delete a template.
//
//     Responses:
//       204: Accepted
//       400: ValidationError
//       404: NotFound

type MessageTemplate struct {
	Name     string
	Template string
}

// swagger:parameters RoutePostTemplate RoutePutTemplate
type MessageTemplatePayload struct {
	// in:body
	Body MessageTemplate
}

func (t MessageTemplate) ResourceType() string {
	return "template"
}

func (t MessageTemplate) ResourceID() string {
	return t.Name
}

func (t MessageTemplate) Validate() error {
	if t.Name == "" {
		return fmt.Errorf("template must have a name")
	}
	if t.Template == "" {
		return fmt.Errorf("template must have content")
	}

	return nil
}
