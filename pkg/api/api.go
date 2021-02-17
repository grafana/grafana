// Documentation of the API.
//
//     Schemes: http, https
//     BasePath: /api/v1
//     Version: 1.0.0
//
//     Consumes:
//     - application/json
//
//     Produces:
//     - application/json
//
//     Security:
//     - basic
//
//    SecurityDefinitions:
//    basic:
//      type: basic
//
// swagger:meta
package api

// swagger:model
type ValidationError struct {
	Msg string `json:"msg"`
}

// swagger:model
type Ack struct{}
