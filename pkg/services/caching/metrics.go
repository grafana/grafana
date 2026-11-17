package caching

import (
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/metrics/metricutil"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/prometheus/client_golang/prometheus"
)

const (
	QueryPubdash   = "pubdash"
	QueryDashboard = "dashboard"
)

var QueryCachingRequestHistogram = metricutil.NewHistogramVec(prometheus.HistogramOpts{
	Namespace: metrics.ExporterName,
	Subsystem: "caching",
	Name:      "query_caching_request_duration_seconds",
	Help:      "histogram of grafana query endpoint requests in seconds",
	Buckets:   []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 25, 50, 100},
}, []string{"datasource_type", "cache", "query_type"})

var ShouldCacheQueryHistogram = metricutil.NewHistogramVec(prometheus.HistogramOpts{
	Namespace: metrics.ExporterName,
	Subsystem: "caching",
	Name:      "should_cache_query_request_duration_seconds",
	Help:      "histogram of grafana query endpoint requests in seconds",
	Buckets:   []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 25, 50, 100},
}, []string{"datasource_type", "cache", "shouldCache", "query_type"})

var ResourceCachingRequestHistogram = metricutil.NewHistogramVec(prometheus.HistogramOpts{
	Namespace: metrics.ExporterName,
	Subsystem: "caching",
	Name:      "resource_caching_request_duration_seconds",
	Help:      "histogram of grafana resource endpoint requests in seconds",
	Buckets:   []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 25, 50, 100},
}, []string{"plugin_id", "cache"})

func getQueryType(req *contextmodel.ReqContext) string {
	if req.IsPublicDashboardView() {
		return QueryPubdash
	}
	return QueryDashboard
}
