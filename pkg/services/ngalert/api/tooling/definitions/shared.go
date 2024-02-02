package definitions

import "github.com/grafana/grafana/pkg/util/errutil"

// swagger:model
type NotFound struct{}

// swagger:model
type Ack struct{}

// swagger:model
type ValidationError struct {
	// example: error message
	Msg string `json:"msg"`
}

// swagger:model
type ForbiddenError struct {
	// The response message
	// in: body
	Body errutil.PublicError `json:"body"`
}

// swagger:model
type GenericPublicError struct {
	// The response message
	// in: body
	Body errutil.PublicError `json:"body"`
}
