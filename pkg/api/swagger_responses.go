package api

// A GenericError is the default error message that is generated.
// For certain status codes there are more appropriate error structures.
//
// swagger:response genericError
type GenericError struct {
	// The response message
	// in: body
	Body ErrorResponseBody `json:"body"`
}

type ErrorResponseBody struct {
	// a human readable version of the error
	// required: true
	Message string `json:"message"`

	// Error An optional detailed description of the actual error. Only included if running in developer mode.
	Error string `json:"error"`

	// Status An optional status to denote the cause of the error.
	//
	// For example, a 412 Precondition Failed error may include additional information of why that error happened.
	Status string `json:"status"`
}

// swagger:model
type SuccessResponseBody struct {
	Message string `json:"message,omitempty"`
}

// An OKResponse is returned if the request was successful.
//
// swagger:response okResponse
type OKResponse struct {
	// in: body
	Body SuccessResponseBody `json:"body"`
}

// ForbiddenError is returned if the user/token has insufficient permissions to access the requested resource.
//
// swagger:response forbiddenError
type ForbiddenError struct {
	// The response message
	// in: body
	Body ErrorResponseBody `json:"body"`
}

// NotFoundError is returned when the requested resource was not found.
//
// swagger:response notFoundError
type NotFoundError struct {
	// The response message
	// in: body
	Body ErrorResponseBody `json:"body"`
}

// BadRequestError is returned when the request is invalid and it cannot be processed.
//
// swagger:response badRequestError
type BadRequestError struct {
	// The response message
	// in: body
	Body ErrorResponseBody `json:"body"`
}

// NotAcceptableError is returned when the server cannot produce a response matching the accepted formats.
//
// swagger:response notAcceptableError
type NotAcceptableError struct {
	// The response message
	// in: body
	Body ErrorResponseBody `json:"body"`
}

// ConflictError
//
// swagger:response conflictError
type ConflictError struct {
	// The response message
	// in: body
	Body ErrorResponseBody `json:"body"`
}

// PreconditionFailedError
//
// swagger:response preconditionFailedError
type PreconditionFailedError struct {
	// The response message
	// in: body
	Body ErrorResponseBody `json:"body"`
}

// UnprocessableEntityError
//
// swagger:response unprocessableEntityError
type UnprocessableEntityError struct {
	// The response message
	// in: body
	Body ErrorResponseBody `json:"body"`
}

// InternalServerError is a general error indicating something went wrong internally.
//
// swagger:response internalServerError
type InternalServerError struct {
	// The response message
	// in: body
	Body ErrorResponseBody `json:"body"`
}

// UnauthorizedError is returned when the request is not authenticated.
//
// swagger:response unauthorisedError
type UnauthorizedError struct {
	// The response message
	// in: body
	Body ErrorResponseBody `json:"body"`
}

// GoneError is returned when the requested endpoint was removed.
//
// swagger:response goneError
type GoneError struct {
	// The response message
	// in: body
	Body ErrorResponseBody `json:"body"`
}

// AcceptedResponse
//
// swagger:response acceptedResponse
type AcceptedResponse struct {
	// The response message
	// in: body
	Body ErrorResponseBody `json:"body"`
}

// StatusMovedPermanently
//
// swagger:response statusMovedPermanently
type StatusMovedPermanentlyRedirect struct {
	// The response message
	// in: body
	Body ErrorResponseBody `json:"body"`
}

// documentation for PublicError defined in errutil.Error

// swagger:response publicErrorResponse
type PublicErrorResponse struct {
	// The response message
	// in: body
	Body PublicError `json:"body"`
}

// PublicError is derived from Error and only contains information
// available to the end user.
// swagger:model publicError
type PublicError struct {
	// StatusCode The HTTP status code returned
	// required: true
	StatusCode int `json:"statusCode"`

	// MessageID A unique identifier for the error
	// required: true
	MessageID string `json:"messageId"`

	// Message A human readable message
	Message string `json:"message"`

	// Extra Additional information about the error
	Extra map[string]any `json:"extra"`
}

// NotFoundPublicError is returned when the requested resource was not found.
//
// swagger:response notFoundPublicError
type NotFoundPublicError struct {
	// The response message
	// in: body
	Body PublicError `json:"body"`
}

// BadRequestPublicError is returned when the request is invalid and it cannot be processed.
//
// swagger:response badRequestPublicError
type BadRequestPublicError struct {
	// The response message
	// in: body
	Body PublicError `json:"body"`
}

// UnauthorisedPublicError is returned when the request is not authenticated.
//
// swagger:response unauthorisedPublicError
type UnauthorisedPublicError struct {
	// The response message
	// in: body
	Body PublicError `json:"body"`
}

// ForbiddenPublicError is returned if the user/token has insufficient permissions to access the requested resource.
//
// swagger:response forbiddenPublicError
type ForbiddenPublicError struct {
	// The response message
	// in: body
	Body PublicError `json:"body"`
}

// InternalServerPublicError is a general error indicating something went wrong internally.
//
// swagger:response internalServerPublicError
type InternalServerPublicError struct {
	// The response message
	// in: body
	Body PublicError `json:"body"`
}
