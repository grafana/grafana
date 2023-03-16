package query

import (
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/prometheus/client_golang/prometheus"
)

var (
	Mixed          = "mixed"
	None           = "none"
	QueryPubdash   = "pubdash"
	QueryDashboard = "dashboard"
)

var QueryRequestHistogram = prometheus.NewHistogramVec(prometheus.HistogramOpts{
	Namespace: metrics.ExporterName,
	Subsystem: "caching",
	Name:      "request_duration_seconds",
	Help:      "histogram of grafana query endpoint requests in seconds",
	Buckets:   []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 25, 50, 100},
}, []string{"datasource_type", "cache", "query_type"})

func getDatasourceType(datasources []string) string {
	if len(datasources) <= 0 {
		return None
	}

	// since we cache the entire result for mixed datasource queries, we have no choice but to label it as mixed
	if len(datasources) > 1 {
		return Mixed
	}

	return datasources[0]
}

func getQueryType(user *user.SignedInUser) string {
	if user.Login == "" && user.UserID == 0 {
		return QueryPubdash
	}
	return QueryDashboard
}
