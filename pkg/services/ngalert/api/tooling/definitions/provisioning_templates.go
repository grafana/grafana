package definitions

// swagger:route GET /api/provisioning/templates provisioning RouteGetTemplates
//
// Get all message templates.
//
//     Responses:
//       200: MessageTemplateResponse
//       400: ValidationError

// swagger:route GET /api/provisioning/templates/{ID} provisioning RouteGetTemplate
//
// Get a message template.
//
//     Responses:
//       200: MessageTemplateResponse
//       404: NotFoundResponse

// swagger:parameters RouteGetTemplate
type RouteGetTemplateParam struct {
	// Template ID
	// in:path
	ID string
}

type MessageTemplate struct {
	Name     string
	Template string
}

//swagger:response MessageTemplateResponse
type MessageTemplateResponse struct {
	// in:body
	Body []MessageTemplate `json:"body"`
}

//swagger:response NotFoundResponse
type NotFoundResponse struct{}
