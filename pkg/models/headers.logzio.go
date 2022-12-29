// LOGZ.IO GRAFANA CHANGE :: DEV-17927 use LogzIoHeaders obj to pass on headers
package models

import (
	"net/http"
	"strings"
)

const LogzioHeadersCtxKey string = "logzioHeaders"
const LogzioRequestIdHeaderName string = "x-request-id"

type LogzIoHeaders struct {
	RequestHeaders http.Header
}

var logzioHeadersWhitelist = []string{
	"x-auth-token",
	"x-api-token",
	"user-context",
	LogzioRequestIdHeaderName,
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

// LOGZ.IO CHANGE :: DEV-33325 Open expressions for Grafana 8.5.1
func (logzioHeaders *LogzIoHeaders) GetDatasourceQueryHeader(grafanaGeneratedHeaders http.Header) map[string]string {
	headers := map[string]string{}

	for k, v := range grafanaGeneratedHeaders {
		for _, whitelistedHeader := range logzioHeadersWhitelist {
			if strings.EqualFold(k, whitelistedHeader) {
				headers[k] = v[0]
			}
		}
	}

	return headers
}

// LOGZ.IO GRAFANA CHANGE :: end
