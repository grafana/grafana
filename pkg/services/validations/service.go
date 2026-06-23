package validations

import (
	"net/http"
)

type DataSourceRequestValidator interface {
	// Validate performs a request validation based
	// on the data source URL and some of the request
	// attributes (headers, cookies, etc).
	Validate(dsURL string, dsJsonData map[string]any, req *http.Request) error
}

type DataSourceRequestURLValidator interface {
	// Validate performs a request validation based on the data source URL
	Validate(dsURL string) error
}
