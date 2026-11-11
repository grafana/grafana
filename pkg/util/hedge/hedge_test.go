package hedge_test

import (
	"context"
	"errors"
	"runtime"
	"sync"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/util/hedge"
	"github.com/stretchr/testify/require"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
)

func TestDoReturnsFirstSuccessfulNonScoreValue(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		type response struct {
			Name  string
			Count int
		}
		var calls atomic.Int32
		value, err := hedge.Do(context.Background(), hedge.Policy{Delay: time.Second}, func(ctx context.Context) (response, error) {
			if calls.Add(1) == 1 {
				<-ctx.Done()
				return response{}, ctx.Err()
			}
			return response{Name: "ready", Count: 3}, nil
		})
		require.NoError(t, err)
		require.Equal(t, response{Name: "ready", Count: 3}, value)
		require.EqualValues(t, 2, calls.Load())
	})
}

func TestDoFastFailureDoesNotStartDuplicate(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		failure := errors.New("unavailable")
		var calls atomic.Int32
		_, err := hedge.Do(context.Background(), hedge.Policy{Delay: time.Second}, func(context.Context) (string, error) {
			calls.Add(1)
			return "", failure
		})
		require.ErrorIs(t, err, failure)
		require.EqualValues(t, 1, calls.Load())
	})
}

func TestDoSuppressPreventsTimedDuplicateWhilePrimaryContinues(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		var calls atomic.Int32
		value, err := hedge.Do(context.Background(), hedge.Policy{Delay: time.Second}, func(ctx context.Context) (int, error) {
			calls.Add(1)
			hedge.Suppress(ctx)
			hedge.Suppress(ctx)
			<-time.After(2 * time.Second)
			return 42, nil
		})
		require.NoError(t, err)
		require.Equal(t, 42, value)
		require.EqualValues(t, 1, calls.Load())
	})
}

func TestDoSuppressionWinsTimerAuthorizationRace(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		var calls atomic.Int32
		attemptCtx := make(chan context.Context, 1)
		release := make(chan struct{})
		span := &notifyingSpan{Span: trace.SpanFromContext(context.Background()), onEvent: func(name string) {
			if name == "hedge.timer_elapsed" {
				hedge.Suppress(<-attemptCtx)
				close(release)
			}
		}}
		ctx := trace.ContextWithSpan(context.Background(), span)
		value, err := hedge.Do(ctx, hedge.Policy{Delay: time.Second}, func(ctx context.Context) (int, error) {
			calls.Add(1)
			attemptCtx <- ctx
			<-release
			return 42, nil
		})
		require.NoError(t, err)
		require.Equal(t, 42, value)
		require.EqualValues(t, 1, calls.Load())
	})
}

func TestDoAuthorizedPeerContinuesAfterSuppression(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		var calls atomic.Int32
		secondStarted := make(chan struct{})
		value, err := hedge.Do(context.Background(), hedge.Policy{Delay: time.Second}, func(ctx context.Context) (int, error) {
			if calls.Add(1) == 1 {
				<-secondStarted
				hedge.Suppress(ctx)
				return 42, nil
			}
			close(secondStarted)
			<-ctx.Done()
			return 0, ctx.Err()
		})
		require.NoError(t, err)
		require.Equal(t, 42, value)
		require.EqualValues(t, 2, calls.Load())
	})
}

func TestSuppressOutsideDoIsHarmless(t *testing.T) {
	hedge.Suppress(context.Background())
}

func TestDoConcurrentSearchesHaveIndependentSuppressionGates(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		type outcome struct {
			value int
			err   error
		}
		var suppressedCalls, hedgedCalls atomic.Int32
		suppressedStarted := make(chan struct{})
		suppressedResult := make(chan outcome, 1)
		go func() {
			value, err := hedge.Do(context.Background(), hedge.Policy{Delay: time.Second}, func(ctx context.Context) (int, error) {
				suppressedCalls.Add(1)
				hedge.Suppress(ctx)
				close(suppressedStarted)
				<-time.After(2 * time.Second)
				return 3, nil
			})
			suppressedResult <- outcome{value, err}
		}()
		<-suppressedStarted

		hedgedStarted := make(chan struct{})
		hedgedResult := make(chan outcome, 1)
		go func() {
			value, err := hedge.Do(context.Background(), hedge.Policy{Delay: time.Second}, func(ctx context.Context) (int, error) {
				if hedgedCalls.Add(1) == 1 {
					close(hedgedStarted)
					<-ctx.Done()
					return 0, ctx.Err()
				}
				return 7, nil
			})
			hedgedResult <- outcome{value, err}
		}()
		<-hedgedStarted

		hedged := <-hedgedResult
		require.NoError(t, hedged.err)
		require.Equal(t, 7, hedged.value)
		suppressed := <-suppressedResult
		require.NoError(t, suppressed.err)
		require.Equal(t, 3, suppressed.value)
		require.EqualValues(t, 1, suppressedCalls.Load())
		require.EqualValues(t, 2, hedgedCalls.Load())
	})
}

func TestDoCancellationAfterSuppressionRetainsCause(t *testing.T) {
	ctx, cancel := context.WithCancelCause(context.Background())
	defer cancel(nil)
	cause := errors.New("caller cancelled")
	_, err := hedge.Do(ctx, hedge.Policy{Delay: time.Hour}, func(attemptCtx context.Context) (int, error) {
		hedge.Suppress(attemptCtx)
		cancel(cause)
		<-attemptCtx.Done()
		return 0, attemptCtx.Err()
	})
	require.ErrorIs(t, err, cause)
}

func TestDoNonpositiveDelayNeverStartsDuplicateAfterFailure(t *testing.T) {
	for _, delay := range []time.Duration{0, -time.Second} {
		t.Run(delay.String(), func(t *testing.T) {
			var calls atomic.Int32
			failure := errors.New("provider failed")
			_, err := hedge.Do(context.Background(), hedge.Policy{Delay: delay}, func(context.Context) (string, error) {
				calls.Add(1)
				return "", failure
			})
			require.ErrorIs(t, err, failure)
			require.EqualValues(t, 1, calls.Load())
		})
	}
}

func TestDoFirstSuccessSurvivesPeerFailureAndBothFailuresJoin(t *testing.T) {
	for _, secondSucceeds := range []bool{true, false} {
		t.Run(map[bool]string{true: "second succeeds", false: "both fail"}[secondSucceeds], func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				first, second := errors.New("first"), errors.New("second")
				var calls atomic.Int32
				value, err := hedge.Do(context.Background(), hedge.Policy{Delay: time.Second}, func(context.Context) (string, error) {
					if calls.Add(1) == 1 {
						<-time.After(1100 * time.Millisecond)
						return "", first
					}
					<-time.After(200 * time.Millisecond)
					if secondSucceeds {
						return "winner", nil
					}
					return "", second
				})
				if secondSucceeds {
					require.NoError(t, err)
					require.Equal(t, "winner", value)
				} else {
					require.ErrorIs(t, err, first)
					require.ErrorIs(t, err, second)
				}
				require.EqualValues(t, 2, calls.Load())
			})
		})
	}
}

func TestDoRetainsCustomDeadlineCauseAndEarlierFailure(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		cause, failure := errors.New("budget exhausted"), errors.New("first failed")
		ctx, cancel := context.WithTimeoutCause(context.Background(), time.Second, cause)
		defer cancel()
		var calls atomic.Int32
		_, err := hedge.Do(ctx, hedge.Policy{Delay: 500 * time.Millisecond}, func(ctx context.Context) (int, error) {
			if calls.Add(1) == 1 {
				<-time.After(600 * time.Millisecond)
				return 0, failure
			}
			<-ctx.Done()
			return 0, ctx.Err()
		})
		require.ErrorIs(t, err, failure)
		require.ErrorIs(t, err, cause)
	})
}

func TestDoRecoversAttemptPanic(t *testing.T) {
	_, err := hedge.Do(context.Background(), hedge.Policy{}, func(context.Context) (int, error) { panic("boom") })
	require.ErrorContains(t, err, "boom")
	require.ErrorContains(t, err, "hedge_test.go")
}

func TestDoGoexitCannotReturnSuccessfulZeroValue(t *testing.T) {
	value, err := hedge.Do(context.Background(), hedge.Policy{}, func(context.Context) (int, error) {
		runtime.Goexit()
		return 42, nil
	})
	require.ErrorContains(t, err, "exited without returning")
	require.Zero(t, value)
}

func TestDoGoexitDoesNotCancelPendingSuccess(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		var calls atomic.Int32
		secondStarted := make(chan struct{})
		value, err := hedge.Do(context.Background(), hedge.Policy{Delay: time.Second}, func(context.Context) (int, error) {
			if calls.Add(1) == 1 {
				<-secondStarted
				runtime.Goexit()
				return 0, nil
			}
			close(secondStarted)
			<-time.After(time.Millisecond)
			return 42, nil
		})
		synctest.Wait()
		require.NoError(t, err)
		require.Equal(t, 42, value)
		require.EqualValues(t, 2, calls.Load())
	})
}

func TestDoLateLosingGoexitCannotBlock(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		var calls atomic.Int32
		release := make(chan struct{})
		workerDone := make(chan struct{})
		value, err := hedge.Do(context.Background(), hedge.Policy{Delay: time.Second}, func(context.Context) (int, error) {
			if calls.Add(1) == 1 {
				defer close(workerDone)
				<-release
				runtime.Goexit()
				return 0, nil
			}
			return 42, nil
		})
		require.NoError(t, err)
		require.Equal(t, 42, value)
		close(release)
		synctest.Wait()
		<-workerDone
	})
}

func TestDoEmitsGenericAttemptDiagnostics(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		recorder := tracetest.NewSpanRecorder()
		provider := sdktrace.NewTracerProvider(sdktrace.WithSpanProcessor(recorder))
		defer func() { _ = provider.Shutdown(context.Background()) }()
		ctx, span := provider.Tracer("test").Start(context.Background(), "fetch")
		var calls atomic.Int32
		_, err := hedge.Do(ctx, hedge.Policy{Delay: time.Second}, func(ctx context.Context) (int, error) {
			if calls.Add(1) == 1 {
				<-ctx.Done()
				return 0, ctx.Err()
			}
			return 1, nil
		})
		require.NoError(t, err)
		span.End()
		spans := recorder.Ended()
		require.Len(t, spans, 1)
		attrs := make(map[string]int64)
		for _, attr := range spans[0].Attributes() {
			attrs[string(attr.Key)] = attr.Value.AsInt64()
		}
		require.Equal(t, map[string]int64{"hedge.winning_attempt": 2, "hedge.attempt_count": 2}, attrs)
		require.Len(t, spans[0].Events(), 3)
		require.Equal(t, "hedge.timer_elapsed", spans[0].Events()[0].Name)
		require.Equal(t, "hedge.launched", spans[0].Events()[1].Name)
		require.Equal(t, "hedge.losing_attempt_cancelled", spans[0].Events()[2].Name)
	})
}

func TestDoSuppressedCallRecordsOneAttempt(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		recorder := tracetest.NewSpanRecorder()
		provider := sdktrace.NewTracerProvider(sdktrace.WithSpanProcessor(recorder))
		defer func() { _ = provider.Shutdown(context.Background()) }()
		ctx, span := provider.Tracer("test").Start(context.Background(), "fetch")
		_, err := hedge.Do(ctx, hedge.Policy{Delay: time.Second}, func(ctx context.Context) (string, error) {
			hedge.Suppress(ctx)
			<-time.After(2 * time.Second)
			return "ready", nil
		})
		require.NoError(t, err)
		span.End()
		spans := recorder.Ended()
		require.Len(t, spans, 1)
		attrs := make(map[string]int64)
		for _, attr := range spans[0].Attributes() {
			attrs[string(attr.Key)] = attr.Value.AsInt64()
		}
		require.Equal(t, map[string]int64{"hedge.attempt_count": 1, "hedge.winning_attempt": 1}, attrs)
	})
}

func doHedgeScores(ctx context.Context, delay time.Duration, fn func(context.Context) ([]float64, error)) ([]float64, error) {
	return hedge.Do(ctx, hedge.Policy{Delay: delay}, fn)
}

const fixtureHedgeDelay = 500 * time.Millisecond

type notifyingSpan struct {
	trace.Span
	onEvent func(string)
}

func (s *notifyingSpan) AddEvent(name string, _ ...trace.EventOption) {
	if s.onEvent != nil {
		s.onEvent(name)
	}
}

func TestDoUsesConfiguredDelay(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		var calls atomic.Int32
		start := time.Now()
		var secondStarted time.Time
		scores, err := doHedgeScores(context.Background(), 750*time.Millisecond, func(ctx context.Context) ([]float64, error) {
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

func TestDoNonpositiveDelayNeverDuplicates(t *testing.T) {
	for _, delay := range []time.Duration{0, -time.Second} {
		t.Run(delay.String(), func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				ctx, cancel := context.WithTimeout(context.Background(), time.Second)
				defer cancel()
				var calls atomic.Int32
				_, err := doHedgeScores(ctx, delay, func(ctx context.Context) ([]float64, error) {
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

func TestDoConfiguredDelayAtDeadlineNeverDuplicates(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 750*time.Millisecond)
		defer cancel()
		var calls atomic.Int32
		_, err := doHedgeScores(ctx, 750*time.Millisecond, func(ctx context.Context) ([]float64, error) {
			calls.Add(1)
			<-ctx.Done()
			return nil, ctx.Err()
		})
		require.ErrorIs(t, err, context.DeadlineExceeded)
		require.EqualValues(t, 1, calls.Load())
	})
}

func TestDoConcurrentDelaysRemainIndependent(t *testing.T) {
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
				_, err := doHedgeScores(context.Background(), delay, func(ctx context.Context) ([]float64, error) {
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

func TestDoSlowPrimaryUsesFirstValidSuccess(t *testing.T) {
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
		scores, err := doHedgeScores(context.Background(), fixtureHedgeDelay, attempt)
		require.NoError(t, err)
		require.Equal(t, []float64{0.7}, scores)
		require.EqualValues(t, 2, calls.Load())
		synctest.Wait()
		require.Equal(t, 1, <-started)
		require.Equal(t, 2, <-started)
		<-primaryCancelled
	})
}

func TestDoShortDeadlineDoesNotLaunchDuplicate(t *testing.T) {
	for _, budget := range []time.Duration{400 * time.Millisecond, 500 * time.Millisecond} {
		t.Run(budget.String(), func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				ctx, cancel := context.WithTimeout(context.Background(), budget)
				defer cancel()
				var calls atomic.Int32
				_, err := doHedgeScores(ctx, fixtureHedgeDelay, func(ctx context.Context) ([]float64, error) {
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

func TestDoFastPrimaryUsesOneAttempt(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		var calls atomic.Int32
		scores, err := doHedgeScores(context.Background(), fixtureHedgeDelay, func(context.Context) ([]float64, error) { calls.Add(1); return []float64{0.4}, nil })
		require.NoError(t, err)
		require.Equal(t, []float64{0.4}, scores)
		require.EqualValues(t, 1, calls.Load())
	})
}

func TestDoPrimaryCanWinAfterDuplicateStarts(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		var calls atomic.Int32
		loserCancelled := make(chan struct{})
		scores, err := doHedgeScores(context.Background(), fixtureHedgeDelay, func(ctx context.Context) ([]float64, error) {
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

func TestDoCancellationBeatsLateSuccess(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		started := make(chan struct{})
		release := make(chan struct{})
		done := make(chan error, 1)
		go func() {
			_, err := doHedgeScores(ctx, fixtureHedgeDelay, func(context.Context) ([]float64, error) { close(started); <-release; return []float64{0.9}, nil })
			done <- err
		}()
		<-started
		cancel()
		close(release)
		require.ErrorIs(t, <-done, context.Canceled)
		synctest.Wait()
	})
}

func TestDoLateLoserCompletionCannotBlock(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		var calls atomic.Int32
		release := make(chan struct{})
		loserDone := make(chan struct{})
		scores, err := doHedgeScores(context.Background(), fixtureHedgeDelay, func(ctx context.Context) ([]float64, error) {
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

func TestDoConcurrentCallsKeepResultsIndependent(t *testing.T) {
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
				scores, err := doHedgeScores(context.Background(), fixtureHedgeDelay, func(ctx context.Context) ([]float64, error) {
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

func TestDoCompletedPrimaryWinsReadyTimer(t *testing.T) {
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
					if name == "hedge.timer_elapsed" {
						close(release)
						synctest.Wait()
					}
				}}
				ctx := trace.ContextWithSpan(context.Background(), span)
				scores, err := doHedgeScores(ctx, fixtureHedgeDelay, func(context.Context) ([]float64, error) {
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

func TestDoLateLosingPanicDoesNotCrash(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		var calls atomic.Int32
		release := make(chan struct{})
		scores, err := doHedgeScores(context.Background(), fixtureHedgeDelay, func(context.Context) ([]float64, error) {
			if calls.Add(1) == 1 {
				<-release
				panic("late provider panic")
			}
			return []float64{0.8}, nil
		})
		require.NoError(t, err)
		require.Equal(t, []float64{0.8}, scores)
		close(release)
		synctest.Wait()
	})
}

func TestDoPanickingAttemptDoesNotCancelPendingSuccess(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		var calls atomic.Int32
		scores, err := doHedgeScores(context.Background(), fixtureHedgeDelay, func(context.Context) ([]float64, error) {
			if calls.Add(1) == 1 {
				<-time.After(600 * time.Millisecond)
				panic("primary panicked")
			}
			<-time.After(200 * time.Millisecond)
			return []float64{0.8}, nil
		})
		require.NoError(t, err)
		require.Equal(t, []float64{0.8}, scores)
		require.EqualValues(t, 2, calls.Load())
	})
}

var errTestTimeout = errors.New("budget exhausted")

func TestDoExpiredDeadlineRejectsLateSuccessWithCause(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		deadlineCtx, cancel := context.WithTimeoutCause(context.Background(), time.Second, errTestTimeout)
		defer cancel()
		release := make(chan struct{})
		var calls atomic.Int32
		span := &notifyingSpan{Span: trace.SpanFromContext(deadlineCtx), onEvent: func(name string) {
			if name == "hedge.timer_elapsed" {
				close(release)
				synctest.Sleep(500 * time.Millisecond)
				synctest.Wait()
			}
		}}
		ctx := trace.ContextWithSpan(deadlineCtx, span)
		scores, err := doHedgeScores(ctx, fixtureHedgeDelay, func(context.Context) ([]float64, error) {
			calls.Add(1)
			<-release
			return []float64{0.9}, nil
		})
		require.ErrorIs(t, err, errTestTimeout)
		require.Nil(t, scores)
		require.EqualValues(t, 1, calls.Load())
	})
}

type advertisedDeadlineContext struct {
	context.Context
	deadline time.Time
}

func (c advertisedDeadlineContext) Deadline() (time.Time, bool) { return c.deadline, true }

func TestDoDeadlineAfterSuppressedAttemptRetainsDelayedCause(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		base, cancel := context.WithCancelCause(context.Background())
		defer cancel(nil)
		cause := errors.New("deadline cause")
		ctx := advertisedDeadlineContext{Context: base, deadline: time.Now().Add(time.Second)}
		go func() { <-time.After(time.Second + time.Millisecond); cancel(cause) }()
		_, err := hedge.Do(ctx, hedge.Policy{Delay: time.Hour}, func(attemptCtx context.Context) (int, error) {
			hedge.Suppress(attemptCtx)
			synctest.Sleep(time.Second)
			return 0, errors.New("late failure")
		})
		synctest.Wait()
		require.ErrorIs(t, err, cause)
	})
}

func TestDoWallDeadlineWaitsForCancellationCause(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		cause := errors.New("delayed cancellation cause")
		base, cancel := context.WithCancelCause(context.Background())
		defer cancel(cause)
		deadline := time.Now().Add(time.Second)
		ctx := advertisedDeadlineContext{Context: base, deadline: deadline}
		release := make(chan struct{})
		span := &notifyingSpan{Span: trace.SpanFromContext(ctx), onEvent: func(name string) {
			if name == "hedge.timer_elapsed" {
				synctest.Sleep(500 * time.Millisecond)
				close(release)
				synctest.Wait()
			}
		}}
		ctx.Context = trace.ContextWithSpan(base, span)
		go func() {
			<-time.After(time.Second + time.Millisecond)
			cancel(cause)
		}()
		scores, err := doHedgeScores(ctx, fixtureHedgeDelay, func(context.Context) ([]float64, error) {
			<-release
			return []float64{0.9}, nil
		})
		cancel(cause)
		require.Nil(t, scores)
		require.ErrorIs(t, err, cause)
	})
}
