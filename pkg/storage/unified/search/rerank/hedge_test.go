package rerank

import (
	"context"
	"errors"
	"math"
	"sync"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/require"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
	"go.opentelemetry.io/otel/trace"
)

func TestHedgeScoresUsesConfiguredDelay(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		var calls atomic.Int32
		start := time.Now()
		var secondStarted time.Time
		scores, err := HedgeScores(context.Background(), 1, 750*time.Millisecond, func(ctx context.Context) ([]float64, error) {
			if calls.Add(1) == 1 {
				<-ctx.Done()
				return nil, ctx.Err()
			}
			secondStarted = time.Now()
			return []float64{0.7}, nil
		})
		require.NoError(t, err)
		require.Equal(t, []float64{0.7}, scores)
		require.Equal(t, 750*time.Millisecond, secondStarted.Sub(start))
		require.EqualValues(t, 2, calls.Load())
	})
}

func TestHedgeScoresNonpositiveDelayNeverDuplicates(t *testing.T) {
	for _, delay := range []time.Duration{0, -time.Second} {
		t.Run(delay.String(), func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				ctx, cancel := context.WithTimeout(context.Background(), time.Second)
				defer cancel()
				var calls atomic.Int32
				_, err := HedgeScores(ctx, 1, delay, func(ctx context.Context) ([]float64, error) {
					calls.Add(1)
					<-ctx.Done()
					return nil, ctx.Err()
				})
				require.ErrorIs(t, err, context.DeadlineExceeded)
				require.EqualValues(t, 1, calls.Load())
			})
		})
	}
}

func TestHedgeScoresConfiguredDelayAtDeadlineNeverDuplicates(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 750*time.Millisecond)
		defer cancel()
		var calls atomic.Int32
		_, err := HedgeScores(ctx, 1, 750*time.Millisecond, func(ctx context.Context) ([]float64, error) {
			calls.Add(1)
			<-ctx.Done()
			return nil, ctx.Err()
		})
		require.ErrorIs(t, err, context.DeadlineExceeded)
		require.EqualValues(t, 1, calls.Load())
	})
}

func TestHedgeScoresConcurrentDelaysRemainIndependent(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		type outcome struct {
			delay, elapsed time.Duration
			calls          int32
			err            error
		}
		results := make(chan outcome, 2)
		for _, delay := range []time.Duration{250 * time.Millisecond, 750 * time.Millisecond} {
			go func(delay time.Duration) {
				var calls atomic.Int32
				start := time.Now()
				_, err := HedgeScores(context.Background(), 1, delay, func(ctx context.Context) ([]float64, error) {
					if calls.Add(1) == 1 {
						<-ctx.Done()
						return nil, ctx.Err()
					}
					return []float64{0.7}, nil
				})
				results <- outcome{delay, time.Since(start), calls.Load(), err}
			}(delay)
		}
		for range 2 {
			result := <-results
			require.NoError(t, result.err)
			require.Equal(t, result.delay, result.elapsed)
			require.EqualValues(t, 2, result.calls)
		}
	})
}

func TestHedgeScoresSlowPrimaryUsesFirstValidSuccess(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		started := make(chan int, 2)
		primaryCancelled := make(chan struct{})
		var calls atomic.Int32
		attempt := func(ctx context.Context) ([]float64, error) {
			n := int(calls.Add(1))
			started <- n
			if n == 1 {
				<-ctx.Done()
				close(primaryCancelled)
				return nil, ctx.Err()
			}
			return []float64{0.7}, nil
		}
		scores, err := HedgeScores(context.Background(), 1, DefaultHedgeDelay, attempt)
		require.NoError(t, err)
		require.Equal(t, []float64{0.7}, scores)
		require.EqualValues(t, 2, calls.Load())
		synctest.Wait()
		require.Equal(t, 1, <-started)
		require.Equal(t, 2, <-started)
		<-primaryCancelled
	})
}

func TestHedgeScoresEarlyErrorDoesNotRetry(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		boom := errors.New("primary failed")
		var calls atomic.Int32
		_, err := HedgeScores(context.Background(), 1, DefaultHedgeDelay, func(context.Context) ([]float64, error) { calls.Add(1); return nil, boom })
		require.ErrorIs(t, err, boom)
		require.EqualValues(t, 1, calls.Load())
	})
}

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
			if name == "rerank.attempt_failed" {
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

func TestHedgeScoresShortDeadlineDoesNotLaunchDuplicate(t *testing.T) {
	for _, budget := range []time.Duration{400 * time.Millisecond, 500 * time.Millisecond} {
		t.Run(budget.String(), func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				ctx, cancel := context.WithTimeout(context.Background(), budget)
				defer cancel()
				var calls atomic.Int32
				_, err := HedgeScores(ctx, 1, DefaultHedgeDelay, func(ctx context.Context) ([]float64, error) {
					calls.Add(1)
					<-ctx.Done()
					return nil, ctx.Err()
				})
				require.ErrorIs(t, err, context.DeadlineExceeded)
				require.EqualValues(t, 1, calls.Load())
			})
		})
	}
}

func TestHedgeScoresReturnsBothErrors(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		first, second := errors.New("first"), errors.New("second")
		var calls atomic.Int32
		_, err := HedgeScores(context.Background(), 1, DefaultHedgeDelay, func(ctx context.Context) ([]float64, error) {
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

func TestHedgeScoresFastPrimaryUsesOneAttempt(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		var calls atomic.Int32
		scores, err := HedgeScores(context.Background(), 1, DefaultHedgeDelay, func(context.Context) ([]float64, error) { calls.Add(1); return []float64{0.4}, nil })
		require.NoError(t, err)
		require.Equal(t, []float64{0.4}, scores)
		require.EqualValues(t, 1, calls.Load())
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

func TestHedgeScoresPrimaryCanWinAfterDuplicateStarts(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		var calls atomic.Int32
		loserCancelled := make(chan struct{})
		scores, err := HedgeScores(context.Background(), 1, DefaultHedgeDelay, func(ctx context.Context) ([]float64, error) {
			if calls.Add(1) == 1 {
				<-time.After(600 * time.Millisecond)
				return []float64{0.3}, nil
			}
			<-ctx.Done()
			close(loserCancelled)
			return nil, ctx.Err()
		})
		require.NoError(t, err)
		require.Equal(t, []float64{0.3}, scores)
		require.EqualValues(t, 2, calls.Load())
		synctest.Wait()
		<-loserCancelled
	})
}

func TestHedgeScoresCancellationBeatsLateSuccess(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		started := make(chan struct{})
		release := make(chan struct{})
		done := make(chan error, 1)
		go func() {
			_, err := HedgeScores(ctx, 1, DefaultHedgeDelay, func(context.Context) ([]float64, error) { close(started); <-release; return []float64{0.9}, nil })
			done <- err
		}()
		<-started
		cancel()
		close(release)
		require.ErrorIs(t, <-done, context.Canceled)
		synctest.Wait()
	})
}

func TestHedgeScoresLateLoserCompletionCannotBlock(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		var calls atomic.Int32
		release := make(chan struct{})
		loserDone := make(chan struct{})
		scores, err := HedgeScores(context.Background(), 1, DefaultHedgeDelay, func(ctx context.Context) ([]float64, error) {
			if calls.Add(1) == 1 {
				defer close(loserDone)
				<-release
				return []float64{0.1}, nil
			}
			return []float64{0.9}, nil
		})
		require.NoError(t, err)
		require.Equal(t, []float64{0.9}, scores)
		close(release)
		synctest.Wait()
		<-loserDone
	})
}

func TestHedgeScoresTraceContainsBoundedAttemptMetadata(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		recorder := tracetest.NewSpanRecorder()
		provider := sdktrace.NewTracerProvider(sdktrace.WithSpanProcessor(recorder))
		defer func() { _ = provider.Shutdown(context.Background()) }()
		ctx, span := provider.Tracer("test").Start(context.Background(), "score")
		var calls atomic.Int32
		_, err := HedgeScores(ctx, 1, DefaultHedgeDelay, func(ctx context.Context) ([]float64, error) {
			if calls.Add(1) == 1 {
				<-ctx.Done()
				return nil, ctx.Err()
			}
			return []float64{0.4}, nil
		})
		require.NoError(t, err)
		span.End()
		spans := recorder.Ended()
		require.Len(t, spans, 1)
		attrs := spans[0].Attributes()
		require.Len(t, attrs, 2)
		require.Equal(t, "rerank.winning_attempt", string(attrs[0].Key))
		require.EqualValues(t, 2, attrs[0].Value.AsInt64())
		require.Equal(t, "rerank.attempt_count", string(attrs[1].Key))
		require.EqualValues(t, 2, attrs[1].Value.AsInt64())
		events := spans[0].Events()
		require.Len(t, events, 3)
		require.Equal(t, "rerank.hedge_timer_elapsed", events[0].Name)
		require.Equal(t, "rerank.hedge_launched", events[1].Name)
		require.Equal(t, "rerank.losing_attempt_cancelled", events[2].Name)
	})
}

func TestHedgeScoresConcurrentCallsKeepResultsIndependent(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		const searches = 8
		type outcome struct {
			index  int
			scores []float64
			err    error
			calls  int32
		}
		outcomes := make(chan outcome, searches)
		var group sync.WaitGroup
		for i := 0; i < searches; i++ {
			group.Add(1)
			go func(i int) {
				defer group.Done()
				var calls atomic.Int32
				scores, err := HedgeScores(context.Background(), 1, DefaultHedgeDelay, func(ctx context.Context) ([]float64, error) {
					if calls.Add(1) == 1 {
						<-ctx.Done()
						return nil, ctx.Err()
					}
					return []float64{float64(i)}, nil
				})
				outcomes <- outcome{i, scores, err, calls.Load()}
			}(i)
		}
		group.Wait()
		close(outcomes)
		for result := range outcomes {
			require.NoError(t, result.err)
			require.Equal(t, []float64{float64(result.index)}, result.scores)
			require.EqualValues(t, 2, result.calls)
		}
	})
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

func TestHedgeScoresCompletedPrimaryWinsReadyTimer(t *testing.T) {
	for _, tc := range []struct {
		name   string
		result []float64
		err    error
	}{
		{name: "success", result: []float64{0.5}},
		{name: "error", err: errors.New("primary failed")},
	} {
		t.Run(tc.name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				release := make(chan struct{})
				var calls atomic.Int32
				span := &notifyingSpan{Span: trace.SpanFromContext(context.Background()), onEvent: func(name string) {
					if name == "rerank.hedge_timer_elapsed" {
						close(release)
						synctest.Wait()
					}
				}}
				ctx := trace.ContextWithSpan(context.Background(), span)
				scores, err := HedgeScores(ctx, 1, DefaultHedgeDelay, func(context.Context) ([]float64, error) {
					calls.Add(1)
					<-release
					return tc.result, tc.err
				})
				require.EqualValues(t, 1, calls.Load())
				if tc.err != nil {
					require.ErrorIs(t, err, tc.err)
				} else {
					require.NoError(t, err)
					require.Equal(t, tc.result, scores)
				}
			})
		})
	}
}

func TestHedgeScoresExpiredDeadlineRejectsLateSuccessWithCause(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		deadlineCtx, cancel := context.WithTimeoutCause(context.Background(), time.Second, ErrCallTimeout)
		defer cancel()
		release := make(chan struct{})
		var calls atomic.Int32
		span := &notifyingSpan{Span: trace.SpanFromContext(deadlineCtx), onEvent: func(name string) {
			if name == "rerank.hedge_timer_elapsed" {
				close(release)
				synctest.Sleep(500 * time.Millisecond)
				synctest.Wait()
			}
		}}
		ctx := trace.ContextWithSpan(deadlineCtx, span)
		scores, err := HedgeScores(ctx, 1, DefaultHedgeDelay, func(context.Context) ([]float64, error) {
			calls.Add(1)
			<-release
			return []float64{0.9}, nil
		})
		require.ErrorIs(t, err, ErrCallTimeout)
		require.Nil(t, scores)
		require.EqualValues(t, 1, calls.Load())
	})
}
