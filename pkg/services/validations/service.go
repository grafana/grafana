package validations

import (
	"net/http"

	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/setting"
)

type DataSourceRequestValidator interface {
	// Validate performs a request validation based
	// on the data source URL and some of the request
	// attributes (headers, cookies, etc).
	Validate(ds *datasources.DataSource, secureSocksDSProxySettings setting.SecureSocksDSProxySettings, req *http.Request) error
}
