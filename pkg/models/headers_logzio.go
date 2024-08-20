// LOGZ.IO GRAFANA CHANGE :: DEV-43883 use LogzIoHeaders obj to pass on headers
package models

import (
	"context"
	"net/http"
	"net/url"
)

type LogzIoHeaders struct {
	RequestHeaders http.Header
}

type logzHeaders struct{}

var logzioHeadersWhitelist = []string{
	"user-context",
	"X-Logz-Query-Context",
	"Query-Source",
}

func WithLogzHeaders(ctx context.Context, requestHeaders http.Header) context.Context {
	return context.WithValue(ctx, logzHeaders{}, &LogzIoHeaders{RequestHeaders: requestHeaders})
}

func LogzIoHeadersFromContext(ctx context.Context) (*LogzIoHeaders, bool) {
	key, ok := ctx.Value(logzHeaders{}).(*LogzIoHeaders)
	return key, ok
}

func (logzioHeaders *LogzIoHeaders) GetDatasourceQueryHeaders(grafanaGeneratedHeaders http.Header) http.Header {
	datasourceRequestHeaders := grafanaGeneratedHeaders.Clone()
	logzioGrafanaRequestHeaders := logzioHeaders.RequestHeaders

	for _, whitelistedHeader := range logzioHeadersWhitelist {
		if requestHeader := logzioGrafanaRequestHeaders.Get(whitelistedHeader); requestHeader != "" {
			if whitelistedHeader == "X-Logz-Query-Context" {
				unescapedHeader, err := url.PathUnescape(requestHeader)
				if err == nil {
					datasourceRequestHeaders.Set("User-Context", unescapedHeader)
				}
			} else {
				datasourceRequestHeaders.Set(whitelistedHeader, requestHeader)
			}
		}
	}

	return datasourceRequestHeaders
}

// LOGZ.IO GRAFANA CHANGE :: end
