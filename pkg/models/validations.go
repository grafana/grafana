package models

import (
	"net/http"
)

type PluginRequestValidator interface {
	// Init is necessary to implement registry.Service.
	Init() error
	// Validate performs a request validation based
	// on the data source URL and some of the request
	// attributes (headers, cookies, etc).
	Validate(dsURL string, req *http.Request) error
}
