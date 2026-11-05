package folders

import (
	"context"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const (
	countCallerEndpoint    = "counts_endpoint"
	countCallerDeleteCheck = "delete_check"

	countOutcomeOK       = "ok"
	countOutcomeError    = "error"
	countOutcomeCanceled = "canceled"
)

// countMetrics counts the folder content counts (GetStats calls), by caller and outcome.
// A nil value records nothing.
type countMetrics struct {
	requests   *prometheus.CounterVec
	legacyJoin string
}

// legacyJoinEnabled is a label so an "ok" count with legacy_join="disabled" is queryable.
func newCountMetrics(reg prometheus.Registerer, legacyJoinEnabled bool) *countMetrics {
	requests := promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
		Name: "grafana_folder_counts_requests_total",
		Help: "Folder content counts, by caller, outcome, and whether counting joined the legacy database",
	}, []string{"caller", "outcome", "legacy_join"})
	join := "disabled"
	if legacyJoinEnabled {
		join = "enabled"
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
	resp, err := s.ResourceIndexClient.GetStats(ctx, in, opts...)
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
