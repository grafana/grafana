package rerank

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/util/hedge"
)

type notifyingSpan struct {
	trace.Span
	onEvent func(string)
}

func (s *notifyingSpan) AddEvent(name string, options ...trace.EventOption) {
	if s.onEvent != nil {
		s.onEvent(name)
	}
}

func TestHedgeScoresRejectsInvalidScoresWhileOtherAttemptRuns(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		var calls atomic.Int32
		hedgeStarted := make(chan struct{})
		invalidProcessed := make(chan struct{})
		ctx := trace.ContextWithSpan(context.Background(), &notifyingSpan{Span: trace.SpanFromContext(context.Background()), onEvent: func(name string) {
			if name == "hedge.attempt_failed" {
				close(invalidProcessed)
			}
		}})
		scores, err := HedgeScores(ctx, 1, DefaultHedgeDelay, func(ctx context.Context) ([]float64, error) {
			if calls.Add(1) == 1 {
				<-hedgeStarted
				return []float64{math.NaN()}, nil
			}
			close(hedgeStarted)
			<-invalidProcessed
			return []float64{0.8}, nil
		})
		require.NoError(t, err)
		require.Equal(t, []float64{0.8}, scores)
		require.EqualValues(t, 2, calls.Load())
	})
}

func TestHedgeScoresRejectsMalformedResults(t *testing.T) {
	for _, tc := range []struct {
		name   string
		scores []float64
	}{
		{"missing", nil}, {"nan", []float64{math.NaN()}},
		{"positive infinity", []float64{math.Inf(1)}}, {"negative infinity", []float64{math.Inf(-1)}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				_, err := HedgeScores(context.Background(), 1, DefaultHedgeDelay, func(context.Context) ([]float64, error) { return tc.scores, nil })
				require.Error(t, err)
			})
		})
	}
}

type scorerFunc func(context.Context, string, []string) ([]float64, error)

func (f scorerFunc) Score(ctx context.Context, q string, texts []string) ([]float64, error) {
	return f(ctx, q, texts)
}

func TestInstrumentRecordsOneObservationForHedgedScore(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		hist := prometheus.NewHistogramVec(prometheus.HistogramOpts{Name: "test_hedged_rerank_duration_seconds"}, []string{"model", "status"})
		var calls atomic.Int32
		scorer := Instrument(scorerFunc(func(ctx context.Context, _ string, _ []string) ([]float64, error) {
			return HedgeScores(ctx, 1, DefaultHedgeDelay, func(ctx context.Context) ([]float64, error) {
				if calls.Add(1) == 1 {
					<-ctx.Done()
					return nil, ctx.Err()
				}
				return []float64{0.6}, nil
			})
		}), "m", hist)
		scores, err := scorer.Score(context.Background(), "q", []string{"a"})
		require.NoError(t, err)
		require.Equal(t, []float64{0.6}, scores)
		require.EqualValues(t, 2, calls.Load())
		metric := &dto.Metric{}
		require.NoError(t, hist.WithLabelValues("m", "ok").(prometheus.Metric).Write(metric))
		require.EqualValues(t, 1, metric.GetHistogram().GetSampleCount())
	})
}

func TestHedgeScoresReturnsFastProviderFailureWithoutDuplicate(t *testing.T) {
	failure := errors.New("transient provider failure")
	var calls atomic.Int32
	_, err := HedgeScores(context.Background(), 1, DefaultHedgeDelay, func(context.Context) ([]float64, error) {
		calls.Add(1)
		return nil, failure
	})
	require.ErrorIs(t, err, failure)
	require.EqualValues(t, 1, calls.Load())
}

func TestHedgeScoresRetainsProviderErrorChain(t *testing.T) {
	failure := errors.New("provider failure")
	_, err := HedgeScores(context.Background(), 1, DefaultHedgeDelay, func(context.Context) ([]float64, error) { return nil, fmt.Errorf("rank: %w", failure) })
	require.ErrorIs(t, err, failure)
}

func TestHedgeScoresSuppressionPreventsTimedDuplicateDuringRecovery(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		var calls atomic.Int32
		scores, err := HedgeScores(context.Background(), 1, DefaultHedgeDelay, func(ctx context.Context) ([]float64, error) {
			calls.Add(1)
			hedge.Suppress(ctx)
			<-time.After(750 * time.Millisecond)
			return []float64{0.8}, nil
		})
		require.NoError(t, err)
		require.Equal(t, []float64{0.8}, scores)
		require.EqualValues(t, 1, calls.Load())
	})
}

func TestHedgeScoresFailuresAfterTimedHedgeKeepBothCauses(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		first, second := errors.New("primary failure"), errors.New("hedge failure")
		var calls atomic.Int32
		_, err := HedgeScores(context.Background(), 1, DefaultHedgeDelay, func(context.Context) ([]float64, error) {
			if calls.Add(1) == 1 {
				<-time.After(600 * time.Millisecond)
				return nil, first
			}
			<-time.After(200 * time.Millisecond)
			return nil, second
		})
		require.ErrorIs(t, err, first)
		require.ErrorIs(t, err, second)
		require.EqualValues(t, 2, calls.Load())
	})
}

func TestHedgeScoresDisabledHedgeReturnsFailure(t *testing.T) {
	var calls atomic.Int32
	failure := errors.New("provider failure")
	_, err := HedgeScores(context.Background(), 1, 0, func(context.Context) ([]float64, error) { calls.Add(1); return nil, failure })
	require.ErrorIs(t, err, failure)
	require.EqualValues(t, 1, calls.Load())
}

func TestHedgeScoresShorterDeadlineRetainsCause(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		ctx, cancel := context.WithTimeoutCause(context.Background(), 250*time.Millisecond, ErrCallTimeout)
		defer cancel()
		_, err := HedgeScores(ctx, 1, DefaultHedgeDelay, func(ctx context.Context) ([]float64, error) { <-ctx.Done(); return nil, ctx.Err() })
		require.ErrorIs(t, err, ErrCallTimeout)
	})
}

func TestInstrumentClassifiesTimeoutWithEarlierFailure(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		failure := errors.New("provider unavailable")
		hist := prometheus.NewHistogramVec(prometheus.HistogramOpts{Name: "test_hedged_timeout_duration_seconds"}, []string{"model", "status"})
		ctx, cancel := context.WithTimeoutCause(context.Background(), time.Second, ErrCallTimeout)
		defer cancel()
		var calls atomic.Int32
		scorer := Instrument(scorerFunc(func(ctx context.Context, _ string, _ []string) ([]float64, error) {
			return HedgeScores(ctx, 1, DefaultHedgeDelay, func(ctx context.Context) ([]float64, error) {
				if calls.Add(1) == 1 {
					<-time.After(600 * time.Millisecond)
					return nil, failure
				}
				<-ctx.Done()
				return nil, ctx.Err()
			})
		}), "m", hist)
		_, err := scorer.Score(ctx, "q", []string{"a"})
		require.ErrorIs(t, err, failure)
		require.ErrorIs(t, err, ErrCallTimeout)
		metric := &dto.Metric{}
		require.NoError(t, hist.WithLabelValues("m", "timeout").(prometheus.Metric).Write(metric))
		require.EqualValues(t, 1, metric.GetHistogram().GetSampleCount())
	})
}
