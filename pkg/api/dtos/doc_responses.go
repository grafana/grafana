package dtos

// A GenericError is the default error message that is generated.
// For certain status codes there are more appropriate error structures.
//
// swagger:response genericError
type GenericError struct {
	// The response message
	// in: body
	Body struct {
		// a human readable version of the error
		// required: true
		Message string `json:"message"`

		// Error An optional detailed description of the actual error. Only included if running in developer mode.
		Error string `json:"error"`

		// Status An optional status to denote the cause of the error.
		//
		// For example, a 412 Precondition Failed error may include additional information of why that error happened.
		Status string `json:"status"`
	} `json:"body"`
}

// OKResponse
//
// swagger:response okResponse
type OKResponse struct {
	// in: body
	Body struct{} `json:"body"`
}

// UnauthorizedError Unauthorized to access the requested resource
//
// swagger:response unauthorisedError
type UnauthorizedError struct {
	GenericError
}

// ForbiddenError Insufficient permission to access the requested resource.
//
// swagger:response forbiddenError
type ForbiddenError struct {
	GenericError
}

// NotFoundError Requested resource was not found
//
// swagger:response notFoundError
type NotFoundError struct {
	GenericError
}

// BadRequestError
//
// swagger:response badRequestError
type BadRequestError struct {
	GenericError
}

// PreconditionFailedError
//
// swagger:response preconditionFailedError
type PreconditionFailedError struct {
	GenericError
}

// UnprocessableEntityError
//
// swagger:response unprocessableEntityError
type UnprocessableEntityError struct {
	GenericError
}

// InternalServerError
//
// swagger:response internalServerError
type InternalServerError struct {
	GenericError
}

// The response when successfully deleting a dashboard.
//
// swagger:response DeleteDashboardResponse
type DeleteDashboardResponse struct {
	// The response message
	// in: body
	Body struct {
		// ID Identifier of the deleted dashboard.
		// required: true
		// example: 65
		ID int64 `json:"id"`

		// Title Title of the deleted dashboard.
		// required: true
		// example: My Dashboard
		Title string `json:"title"`

		// Message Message of the deleted dashboard.
		// required: true
		// example: Dashboard My Dashboard deleted
		Message string `json:"message"`
	} `json:"body"`
}

// Create/update dashboard response.
// swagger:model PostDashboardResponse
type PostDashboardResponse struct {
	// Status status of the response.
	// required: true
	// example: success
	Status string `json:"status"`

	// Slug The slug of the dashboard.
	// required: true
	// example: my-dashboard
	Slug string `json:"title"`

	// Version The version of the dashboard.
	// required: true
	// example: 2
	Verion int64 `json:"version"`

	// UID The unique identifier (uid) of the created/updated dashboard.
	// required: true
	// example: nHz3SXiiz
	UID string `json:"uid"`

	// URL The relative URL for accessing the created/updated dashboard.
	// required: true
	// example: /d/nHz3SXiiz/my-dashboard
	URL string `json:"url"`
}

// Get home dashboard response.
// swagger:model GetHomeDashboardResponse
type GetHomeDashboardResponse struct {
	// swagger:allOf
	// required: false
	DashboardFullWithMeta

	// swagger:allOf
	// required: false
	DashboardRedirect
}
