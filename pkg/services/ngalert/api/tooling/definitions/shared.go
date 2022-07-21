package definitions

// swagger:model
type NotFound struct{}

// swagger:model
type Ack struct{}

// swagger:model
type ValidationError struct {
	// example: error message
	Msg string `json:"msg"`
}
