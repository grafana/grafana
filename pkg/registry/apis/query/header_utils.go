package query

import (
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// Set of headers that we want to forward to the datasource api servers. Those are used i.e. for
// cache control or identifying the source of the request.
//
// The headers related to grafana alerting can be found here:
// https://github.com/grafana/grafana-ruler/blob/96e6d4b25c0d973a7615b92b35739511a6fbd72f/pkg/ruler/rulesmanager/ds_query_rule_evaluator.go#L313-L328
//
// The usage of strings.ToLower is because the server would convert `FromAlert` to `Fromalert`. So the make matching
// easier, we just match all headers in lower case.
var expectedHeaders = map[string]string{
	strings.ToLower(models.FromAlertHeaderName): models.FromAlertHeaderName,
	strings.ToLower(models.CacheSkipHeaderName): models.CacheSkipHeaderName,
	strings.ToLower("X-Rule-Uid"):               "X-Rule-Uid",
	strings.ToLower("X-Rule-Folder"):            "X-Rule-Folder",
	strings.ToLower("X-Rule-Source"):            "X-Rule-Source",
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
