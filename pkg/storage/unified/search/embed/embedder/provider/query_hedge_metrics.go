package provider

import (
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
)

func requestObserver(provider string, requests *prometheus.CounterVec) embedder.QueryRequestObserver {
	return func(kind embedder.QueryAttemptKind) {
		requests.WithLabelValues(provider, string(kind)).Inc()
	}
}

func enabledRequestObserver(hedger *embedder.QueryHedger, provider string, requests *prometheus.CounterVec) embedder.QueryRequestObserver {
	if hedger == nil {
		return nil
	}
	return requestObserver(provider, requests)
}

type queryHedgeMetrics struct {
	metrics *resource.VectorMetrics
}

var _ embedder.QueryHedgeObserver = (*queryHedgeMetrics)(nil)

func (m *queryHedgeMetrics) AttemptStarted(provider string, kind embedder.QueryAttemptKind) {
	m.metrics.QueryEmbeddingAttemptsStartedTotal.WithLabelValues(provider, string(kind)).Inc()
}

func (m *queryHedgeMetrics) AttemptFinished(provider string, kind embedder.QueryAttemptKind, outcome embedder.QueryAttemptOutcome, inputTokens int) {
	m.metrics.QueryEmbeddingAttemptsCompletedTotal.WithLabelValues(provider, string(kind), string(outcome)).Inc()
	if inputTokens > 0 {
		m.metrics.QueryEmbeddingAttemptTokensTotal.WithLabelValues(provider, string(kind)).Add(float64(inputTokens))
	} else {
		m.metrics.QueryEmbeddingUnknownTokensTotal.WithLabelValues(provider, string(kind), string(outcome)).Inc()
	}
}

func (m *queryHedgeMetrics) HedgeSkipped(provider string) {
	m.metrics.QueryEmbeddingHedgesSkippedTotal.WithLabelValues(provider).Inc()
}

func (m *queryHedgeMetrics) Winner(provider string, kind embedder.QueryAttemptKind) {
	m.metrics.QueryEmbeddingWinnerTotal.WithLabelValues(provider, string(kind)).Inc()
}

func (m *queryHedgeMetrics) ExtraInFlight(provider string, delta int) {
	m.metrics.QueryEmbeddingExtraInFlight.WithLabelValues(provider).Add(float64(delta))
}
