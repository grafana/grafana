package resource

import (
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// SearchAuthMetrics compares PreRank and PostRank auth without tenant or query labels.
type SearchAuthMetrics struct {
	Duration *prometheus.HistogramVec
	Returned *prometheus.HistogramVec
	Checks   *prometheus.HistogramVec
	Events   *prometheus.CounterVec
}

func newSearchAuthMetrics(reg prometheus.Registerer) *SearchAuthMetrics {
	histogram := func(name, help string, labels ...string) *prometheus.HistogramVec {
		return promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Name:                            "index_server_search_auth_" + name,
			Help:                            help,
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, labels)
	}
	return &SearchAuthMetrics{
		Duration: histogram("execution_duration_seconds", "Search execution duration after request validation, including authorization, ranking and response conversion, by actual auth mode (pre_rank, post_rank, none), query type and outcome. Count is executed searches, not incoming RPCs.", "mode", "query_type", "outcome"),
		Returned: histogram("returned_documents", "Documents returned per successful executed search.", "mode", "query_type"),
		Checks:   histogram("checks", "Check items submitted through Check and BatchCheck per executed search, including failed calls. Excludes Compile and is not a network RPC count.", "mode", "query_type"),
		Events: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "index_server_search_auth_events_total",
			Help: "Search auth events: cursor_fallback selects PreRank instead of PostRank; candidate_budget and facet_budget stop a PostRank scan with unseen matches.",
		}, []string{"reason"}),
	}
}
