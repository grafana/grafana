package definitions

import "github.com/grafana/grafana/pkg/apimachinery/errutil"

// swagger:model
type NotFound struct{}

// swagger:model
type Ack struct{}

// swagger:model
type ValidationError struct {
	// example: error message
	Message string `json:"message"`
}

// swagger:model
type ForbiddenError struct {
	// The response message
	// in: body
	Body errutil.PublicError `json:"body"`
}
