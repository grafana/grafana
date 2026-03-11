package query

import (
	"strconv"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// datasourceQueryTotal counts query executions through the query service,
// broken down by org, datasource UID, datasource type, and status.
// Intended to surface datasource health to customers via grafanacloud-usage prometheus.
var datasourceQueryTotal = promauto.NewCounterVec(
	prometheus.CounterOpts{
		Namespace: "grafana",
		Name:      "datasource_query_total",
		Help:      "Total datasource queries executed via the query service, by org, datasource UID, datasource type, and status (success|error).",
	},
	[]string{"org_id", "datasource_uid", "datasource_type", "status"},
)

// recordQueryMetrics increments datasourceQueryTotal based on the result of a
// single-datasource query execution. It counts once per query in the response;
// if the response is empty (no refIds), it counts the call itself as a success.
func recordQueryMetrics(orgID int64, dsUID, dsType string, resp *backend.QueryDataResponse, err error) {
	orgIDStr := strconv.FormatInt(orgID, 10)
	if err != nil {
		datasourceQueryTotal.WithLabelValues(orgIDStr, dsUID, dsType, "error").Inc()
		return
	}
	if resp == nil || len(resp.Responses) == 0 {
		datasourceQueryTotal.WithLabelValues(orgIDStr, dsUID, dsType, "success").Inc()
		return
	}
	for _, r := range resp.Responses {
		if r.Error != nil {
			datasourceQueryTotal.WithLabelValues(orgIDStr, dsUID, dsType, "error").Inc()
		} else {
			datasourceQueryTotal.WithLabelValues(orgIDStr, dsUID, dsType, "success").Inc()
		}
	}
}
