package definitions

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

type MessageTemplate struct {
	Name     string
	Template string
}

type NotFound struct{}
