package validations

import (
	"net/http"

	"github.com/grafana/grafana/pkg/services/datasources"
)

type PluginRequestValidator interface {
	// Validate performs a request validation based
	// on the data source URL and some of the request
	// attributes (headers, cookies, etc).
	Validate(ds datasources.DataSourceInfo, req *http.Request) error
}
