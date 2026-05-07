package validations

import (
	"net/http"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

type DataSourceRequestValidator interface {
	// Validate performs a request validation based
	// on the data source URL and some of the request
	// attributes (headers, cookies, etc).
	Validate(dsURL string, dsJsonData *simplejson.Json, req *http.Request) error
}

type DataSourceRequestURLValidator interface {
	// Validate performs a request validation based on the data source URL
	Validate(dsURL string) error
}
