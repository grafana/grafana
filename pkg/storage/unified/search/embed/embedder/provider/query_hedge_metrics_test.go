package provider

import (
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
)

func TestQueryHedgeMetricsCountAttemptsAndUnknownUsage(t *testing.T) {
	metrics := resource.ProvideVectorMetrics(nil)
	observer := &queryHedgeMetrics{metrics}
	observer.AttemptStarted("azure", embedder.QueryAttemptOriginal)
	observer.AttemptStarted("azure", embedder.QueryAttemptExtra)
	observer.ExtraInFlight("azure", 1)
	observer.AttemptFinished("azure", embedder.QueryAttemptExtra, embedder.QueryAttemptSuccess, 7)
	observer.Winner("azure", embedder.QueryAttemptExtra)
	observer.AttemptFinished("azure", embedder.QueryAttemptOriginal, embedder.QueryAttemptCanceled, 0)
	observer.ExtraInFlight("azure", -1)
	observer.HedgeSkipped("bedrock")
	requestObserver("azure", metrics.QueryEmbeddingTransportRequestsTotal)(embedder.QueryAttemptOriginal)
	requestObserver("azure", metrics.QueryEmbeddingTransportRequestsTotal)(embedder.QueryAttemptOriginal)
	requestObserver("azure", metrics.QueryEmbeddingTransportRequestsTotal)(embedder.QueryAttemptExtra)

	require.Equal(t, float64(1), testutil.ToFloat64(metrics.QueryEmbeddingAttemptsStartedTotal.WithLabelValues("azure", "extra")))
	require.Equal(t, float64(1), testutil.ToFloat64(metrics.QueryEmbeddingAttemptsCompletedTotal.WithLabelValues("azure", "original", "canceled")))
	require.Equal(t, float64(1), testutil.ToFloat64(metrics.QueryEmbeddingWinnerTotal.WithLabelValues("azure", "extra")))
	require.Equal(t, float64(1), testutil.ToFloat64(metrics.QueryEmbeddingHedgesSkippedTotal.WithLabelValues("bedrock")))
	require.Equal(t, float64(7), testutil.ToFloat64(metrics.QueryEmbeddingAttemptTokensTotal.WithLabelValues("azure", "extra")))
	require.Equal(t, float64(1), testutil.ToFloat64(metrics.QueryEmbeddingUnknownTokensTotal.WithLabelValues("azure", "original", "canceled")))
	require.Zero(t, testutil.ToFloat64(metrics.QueryEmbeddingExtraInFlight.WithLabelValues("azure")))
	require.Equal(t, float64(2), testutil.ToFloat64(metrics.QueryEmbeddingTransportRequestsTotal.WithLabelValues("azure", "original")))
	require.Equal(t, float64(1), testutil.ToFloat64(metrics.QueryEmbeddingTransportRequestsTotal.WithLabelValues("azure", "extra")))
}

func TestProvideEmbedderRejectsInvalidHedgeSettingsBeforeClientStartup(t *testing.T) {
	_, err := ProvideEmbedder(&setting.Cfg{EmbeddingProvider: "vertex", QueryHedgeMaxConcurrent: 4}, nil)
	require.ErrorContains(t, err, "query_hedge_delay")
	_, err = ProvideEmbedder(&setting.Cfg{EmbeddingProvider: "azure", QueryHedgeMaxConcurrent: -1}, nil)
	require.ErrorContains(t, err, "query_hedge_max_concurrent")
}

func TestQueryHedgeMetricsRegisteredOnce(t *testing.T) {
	reg := prometheus.NewRegistry()
	metrics := resource.ProvideVectorMetrics(reg)
	metrics.QueryEmbeddingAttemptsStartedTotal.WithLabelValues("vertex", "original").Inc()
	metrics.QueryEmbeddingTransportRequestsTotal.WithLabelValues("vertex", "extra").Inc()
	families, err := reg.Gather()
	require.NoError(t, err)
	found := false
	foundTransport := false
	for _, family := range families {
		if family.GetName() == "grafana_vector_storage_query_embedding_attempts_started_total" {
			found = true
		}
		if family.GetName() == "grafana_vector_storage_query_embedding_transport_requests_total" {
			foundTransport = true
		}
	}
	require.True(t, found)
	require.True(t, foundTransport)
	require.Panics(t, func() { resource.ProvideVectorMetrics(reg) })
}
