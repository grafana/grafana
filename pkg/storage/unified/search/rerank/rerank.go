// Package rerank defines the contract for cross-encoder rerank providers
// used by the HybridSearch RPC. Provider implementations live in
// subpackages (vertex, bedrock); the factory lives in provider/.
package rerank

import (
	"context"
	"errors"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	otelcodes "go.opentelemetry.io/otel/codes"

	"github.com/grafana/grafana/pkg/infra/metrics/metricutil"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/storage/unified/search/rerank")

// ErrCallTimeout is the cause providers use with context.WithTimeoutCause
// for the per-call deadline, so callers can tell a provider timeout from a
// parent-context cancellation. Shared across providers (unlike the embedder
// package) because the pipeline classifies fallbacks generically.
var ErrCallTimeout = errors.New("rerank provider call timeout")

// Scorer scores each text against the query. The output is 1:1 with
// texts: scores[i] is the relevance of texts[i], higher = better.
// Implementations must not reorder.
type Scorer interface {
	Score(ctx context.Context, query string, texts []string) ([]float64, error)
}

// Reranker bundles a Scorer with the metadata the pipeline needs: the
// canonical model name (metric label) and the calibrated thresholds
// min_relevance labels resolve against. Zero-value Thresholds means
// uncalibrated: every label resolves to 0 and nothing is dropped.
type Reranker struct {
	Scorer
	Model      string
	Thresholds RelevanceThresholds
}

// Instrument wraps a Scorer so each Score call emits an OTel span and a
// latency histogram observation labeled {model, status}. status is
// ok|error|timeout. duration may be nil; the span is still emitted.
func Instrument(inner Scorer, model string, duration *prometheus.HistogramVec) Scorer {
	return &instrumentedScorer{inner: inner, model: model, duration: duration}
}

type instrumentedScorer struct {
	inner    Scorer
	model    string
	duration *prometheus.HistogramVec
}

func (i *instrumentedScorer) Score(ctx context.Context, query string, texts []string) ([]float64, error) {
	ctx, span := tracer.Start(ctx, "unified.rerank.Score")
	defer span.End()
	span.SetAttributes(
		attribute.String("model", i.model),
		attribute.Int("input_count", len(texts)),
	)

	start := time.Now()
	out, err := i.inner.Score(ctx, query, texts)
	status := "ok"
	if err != nil {
		status = "error"
		if errors.Is(err, ErrCallTimeout) {
			status = "timeout"
		}
		span.RecordError(err)
		span.SetStatus(otelcodes.Error, err.Error())
	}
	if i.duration != nil {
		metricutil.ObserveWithExemplar(ctx,
			i.duration.WithLabelValues(i.model, status),
			time.Since(start).Seconds(),
		)
	}
	return out, err
}
