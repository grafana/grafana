package query

import (
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// Set of headers that we want to forward to the datasource api servers. Those are used i.e. for
// cache control or identifying the source of the request.
//
// The headers related to grafana alerting (x-rule-*), should match the list at
// https://github.com/grafana/grafana/blob/f8ae71e4583499dd461ebaed31451966be04220b/pkg/services/pluginsintegration/clientmiddleware/usealertingheaders_middleware.go#L23
//
// The usage of strings.ToLower is because the server would convert `FromAlert` to `Fromalert`. So the make matching
// easier, we just match all headers in lower case.
var expectedHeaders = map[string]string{
	strings.ToLower(models.FromAlertHeaderName): models.FromAlertHeaderName,
	strings.ToLower(models.CacheSkipHeaderName): models.CacheSkipHeaderName,
	strings.ToLower("X-Rule-Name"):              "X-Rule-Name",
	strings.ToLower("X-Rule-Uid"):               "X-Rule-Uid",
	strings.ToLower("X-Rule-Folder"):            "X-Rule-Folder",
	strings.ToLower("X-Rule-Source"):            "X-Rule-Source",
	strings.ToLower("X-Rule-Type"):              "X-Rule-Type",
	strings.ToLower("X-Rule-Version"):           "X-Rule-Version",
	strings.ToLower("X-Grafana-Org-Id"):         "X-Grafana-Org-Id",
}

func ExtractKnownHeaders(header http.Header) map[string]string {
	extractedHeaders := make(map[string]string)
	for k, v := range header {
		if headerName, exists := expectedHeaders[strings.ToLower(k)]; exists {
			extractedHeaders[headerName] = v[0]
		}
	}
	return extractedHeaders
}
