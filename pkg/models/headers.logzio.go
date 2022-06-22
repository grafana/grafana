// LOGZ.IO GRAFANA CHANGE :: DEV-17927 use LogzIoHeaders obj to pass on headers
package models

import "net/http"

type LogzIoHeaders struct {
	RequestHeaders http.Header
}

var logzioHeadersWhitelist = []string{
	"x-auth-token",
	"x-api-token",
	"user-context",
	"x-request-id",
	"cookie",
	"x-logz-csrf-token",
	"x-logz-csrf-token-v2",
}

func (logzioHeaders *LogzIoHeaders) GetDatasourceQueryHeaders(grafanaGeneratedHeaders http.Header) http.Header {
	datasourceRequestHeaders := grafanaGeneratedHeaders.Clone()
	logzioGrafanaRequestHeaders := logzioHeaders.RequestHeaders

	for _, whitelistedHeader := range logzioHeadersWhitelist {
		if requestHeader := logzioGrafanaRequestHeaders.Get(whitelistedHeader); requestHeader != "" {
			datasourceRequestHeaders.Set(whitelistedHeader, requestHeader)
		}
	}

	return datasourceRequestHeaders
}
// LOGZ.IO GRAFANA CHANGE :: end
