package folders

import (
	"context"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/storage/unified/federated"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const (
	countCallerEndpoint    = "counts_endpoint"
	countCallerDeleteCheck = "delete_check"

	countOutcomeOK       = "ok"
	countOutcomeError    = "error"
	countOutcomeCanceled = "canceled"
)

// The series for these are created at construction, so a new caller or outcome belongs here.
var (
	countCallers  = []string{countCallerEndpoint, countCallerDeleteCheck}
	countOutcomes = []string{countOutcomeOK, countOutcomeError, countOutcomeCanceled}
)

// countMetrics counts the folder content counts (GetStats calls), by caller and outcome.
// A nil value records nothing.
type countMetrics struct {
	requests   *prometheus.CounterVec
	legacyJoin string
}

// newCountMetrics labels counts with legacyJoinEnabled so an "ok" count with legacy_join="disabled" is queryable.
func newCountMetrics(reg prometheus.Registerer, legacyJoinEnabled bool) *countMetrics {
	requests := promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
		Name: "grafana_folder_counts_requests_total",
		Help: "GetStats calls for folder content counts, by caller, outcome, and whether counting joined the legacy database",
	}, []string{"caller", "outcome", "legacy_join"})
	join := "disabled"
	if legacyJoinEnabled {
		join = "enabled"
	}
	// Created up front so rate() alerts see the first failure.
	for _, caller := range countCallers {
		for _, outcome := range countOutcomes {
			requests.WithLabelValues(caller, outcome, join).Add(0)
		}
	}
	return &countMetrics{requests: requests, legacyJoin: join}
}

// wrap returns a searcher that records the outcome of its GetStats calls for the given caller.
func (m *countMetrics) wrap(searcher resourcepb.ResourceIndexClient, caller string) resourcepb.ResourceIndexClient {
	if m == nil {
		return searcher
	}
	return &countingSearcher{ResourceIndexClient: searcher, metrics: m, caller: caller}
}

type countingSearcher struct {
	resourcepb.ResourceIndexClient
	metrics *countMetrics
	caller  string
}

func (s *countingSearcher) GetStats(ctx context.Context, in *resourcepb.ResourceStatsRequest, opts ...grpc.CallOption) (*resourcepb.ResourceStatsResponse, error) {
	resp, err := s.ResourceIndexClient.GetStats(federated.WithCaller(ctx, s.caller), in, opts...)
	outcome := countOutcomeOK
	switch {
	case err == nil:
	case isCanceled(err):
		outcome = countOutcomeCanceled
	default:
		outcome = countOutcomeError
	}
	s.metrics.requests.WithLabelValues(s.caller, outcome, s.metrics.legacyJoin).Inc()
	return resp, err
}
