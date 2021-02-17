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
package models

import "github.com/prometheus/alertmanager/config"

// swagger:route POST /api/v1/alerts alertmanager RoutePostAM
//
// sets an Alertmanager config
//
//     Schemes: http, https
//
//     Responses:
//       204: Ack
//       400: ValidationError

// swagger:parameters RoutePostAM
type PostAMConfig struct {
	// in:body
	Body Config
}

// swagger:model
type Config config.Config

// swagger:model
type Ack struct{}

// swagger:model
type ValidationError struct{}
