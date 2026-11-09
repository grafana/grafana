package shadow

import (
	"context"
	"errors"
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type observation struct {
	implementation Implementation
	duration       time.Duration
}

type recordingObserver struct {
	durations []observation
	outcomes  []Outcome
	skips     []SkipReason
	errors    []error
	panics    []any
}

func (o *recordingObserver) ObserveDuration(i Implementation, d time.Duration) {
	o.durations = append(o.durations, observation{i, d})
}

func (o *recordingObserver) ObserveOutcome(outcome Outcome) { o.outcomes = append(o.outcomes, outcome) }
func (o *recordingObserver) ObserveSkip(reason SkipReason)  { o.skips = append(o.skips, reason) }
func (o *recordingObserver) ObserveError(_ context.Context, err error) {
	o.errors = append(o.errors, err)
}
func (o *recordingObserver) ObservePanic(_ context.Context, value any) {
	o.panics = append(o.panics, value)
}

func newTestRunner(t *testing.T) *Runner {
	t.Helper()
	runner, err := NewRunner(1, time.Second)
	require.NoError(t, err)
	return runner
}

func TestNewRunnerInvalidConfiguration(t *testing.T) {
	for _, tc := range []struct {
		name          string
		maxConcurrent int
		timeout       time.Duration
		message       string
	}{
		{"zero concurrency", 0, time.Second, "concurrency must be positive"},
		{"negative concurrency", -1, time.Second, "concurrency must be positive"},
		{"zero timeout", 1, 0, "timeout must be positive"},
		{"negative timeout", 1, -time.Second, "timeout must be positive"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			runner, err := NewRunner(tc.maxConcurrent, tc.timeout)
			require.Nil(t, runner)
			require.ErrorContains(t, err, tc.message)
		})
	}
}

func matchingWork() Work {
	return Work{
		Snapshot: func() {},
		Call:     func(context.Context) {},
		Compare:  func(context.Context) Outcome { return Match },
	}
}

func TestRunnerInvalidWorkPreservesPrimary(t *testing.T) {
	for _, missing := range []string{"Snapshot", "Call", "Compare", "all"} {
		t.Run(missing, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				runner := newTestRunner(t)
				observer := &recordingObserver{}
				primaryCalls, shadowCallbacks := 0, 0
				wantErr := errors.New("primary failure")
				var result int
				var primaryErr error
				runner.Run(t.Context(), observer, func() {
					primaryCalls++
					result, primaryErr = 42, wantErr
				}, func() Work {
					work := Work{
						Snapshot: func() { shadowCallbacks++ },
						Call:     func(context.Context) { shadowCallbacks++ },
						Compare: func(context.Context) Outcome {
							shadowCallbacks++
							return Match
						},
					}
					switch missing {
					case "Snapshot":
						work.Snapshot = nil
					case "Call":
						work.Call = nil
					case "Compare":
						work.Compare = nil
					case "all":
						work = Work{}
					}
					return work
				})
				synctest.Wait()
				require.Equal(t, 1, primaryCalls)
				require.Equal(t, 42, result)
				require.ErrorIs(t, primaryErr, wantErr)
				require.Zero(t, shadowCallbacks)
				require.Equal(t, []Outcome{Failed}, observer.outcomes)
				require.Len(t, observer.errors, 1)
				callback := missing
				if missing == "all" {
					callback = "Snapshot"
				}
				require.EqualError(t, observer.errors[0], "shadow work "+callback+" callback is required")
				require.Empty(t, observer.panics)
				require.Empty(t, runner.inFlight)

				next := &recordingObserver{}
				runner.Run(t.Context(), next, func() {}, matchingWork)
				synctest.Wait()
				require.Equal(t, []Outcome{Match}, next.outcomes)
				require.Empty(t, next.errors)
			})
		})
	}
}

func TestRunnerDetachesRequestAndSnapshotsBeforeReturn(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		runner := newTestRunner(t)
		observer := &recordingObserver{}
		type requestKey struct{}
		ctx, cancel := context.WithCancel(context.WithValue(t.Context(), requestKey{}, "mutable state"))
		defer cancel()
		span := trace.NewSpanContext(trace.SpanContextConfig{TraceID: trace.TraceID{1}, SpanID: trace.SpanID{1}})
		ctx = trace.ContextWithSpanContext(ctx, span)
		input, primaryResult := "original", false
		release := make(chan struct{})
		finished := make(chan struct{})
		var actualContext context.Context
		runner.Run(ctx, observer, func() {
			time.Sleep(2 * time.Millisecond)
			primaryResult = true
		}, func() Work {
			snapshot := input
			var expected, actual bool
			return Work{
				Snapshot: func() { expected = primaryResult },
				Call: func(ctx context.Context) {
					<-release
					actualContext = ctx
					actual = snapshot == "original" && ctx.Err() == nil
					time.Sleep(3 * time.Millisecond)
				},
				Compare: func(context.Context) Outcome {
					defer close(finished)
					if actual == expected {
						return Match
					}
					return Mismatch
				},
			}
		})
		// Reaching here while the shadow call is blocked proves nonblocking return.
		cancel()
		input, primaryResult = "changed", false
		close(release)
		<-finished
		synctest.Wait()
		require.Equal(t, []Outcome{Match}, observer.outcomes)
		require.Nil(t, actualContext.Value(requestKey{}))
		require.Equal(t, span, trace.SpanContextFromContext(actualContext))
		require.Equal(t, []observation{{Primary, 2 * time.Millisecond}, {Shadow, 3 * time.Millisecond}}, observer.durations)
		require.Empty(t, runner.inFlight)
	})
}

func TestRunnerSkipPolicyIsOptionalAndPerRun(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		runner := newTestRunner(t)
		ctx := context.WithValue(t.Context(), sqlstore.ContextSessionKey{}, &sqlstore.DBSession{})
		for _, tc := range []struct {
			name    string
			options []RunOption
			skipped bool
		}{
			{
				name: "skip before preparing",
				options: []RunOption{WithSkip(func(policyCtx context.Context) SkipReason {
					require.Same(t, ctx, policyCtx)
					require.Empty(t, runner.inFlight)
					return "test-policy"
				})},
				skipped: true,
			},
			{name: "omitting policy runs even with SQL session"},
			{
				name: "empty reason allows shadowing",
				options: []RunOption{WithSkip(func(context.Context) SkipReason {
					return ""
				})},
			},
		} {
			observer := &recordingObserver{}
			calls, prepared := 0, false
			runner.Run(ctx, observer, func() { calls++ }, func() Work {
				prepared = true
				return matchingWork()
			}, tc.options...)
			synctest.Wait()
			require.Equal(t, 1, calls, tc.name)
			require.Equal(t, !tc.skipped, prepared, tc.name)
			if tc.skipped {
				require.Equal(t, []SkipReason{"test-policy"}, observer.skips, tc.name)
				require.Empty(t, observer.outcomes, tc.name)
				require.Empty(t, observer.durations, tc.name)
			} else {
				require.Empty(t, observer.skips, tc.name)
				require.Equal(t, []Outcome{Match}, observer.outcomes, tc.name)
			}
			require.Empty(t, observer.panics, tc.name)
			require.Empty(t, runner.inFlight, tc.name)
		}
	})
}

func TestRunnerSkipPolicyPanicPreservesPrimary(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		runner := newTestRunner(t)
		observer := &recordingObserver{}
		calls := 0
		runner.Run(t.Context(), observer, func() { calls++ }, func() Work {
			t.Fatal("must not prepare after a policy panic")
			return Work{}
		}, WithSkip(func(context.Context) SkipReason { panic("policy") }))
		require.Equal(t, 1, calls)
		require.Equal(t, []Outcome{Failed}, observer.outcomes)
		require.Equal(t, []any{"policy"}, observer.panics)
		require.Empty(t, observer.skips)
		require.Empty(t, runner.inFlight)

		next := &recordingObserver{}
		runner.Run(t.Context(), next, func() {}, matchingWork)
		synctest.Wait()
		require.Equal(t, []Outcome{Match}, next.outcomes)
	})
}

func TestRunnerSharesCapacityAcrossOperations(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		runner := newTestRunner(t)
		first, second := &recordingObserver{}, &recordingObserver{}
		release := make(chan struct{})
		runner.Run(t.Context(), first, func() {}, func() Work {
			work := matchingWork()
			work.Call = func(context.Context) { <-release }
			return work
		})
		synctest.Wait()
		primaryCalled := false
		runner.Run(t.Context(), second, func() { primaryCalled = true }, func() Work { panic("must not prepare") })
		require.True(t, primaryCalled)
		require.Equal(t, []SkipReason{Capacity}, second.skips)
		require.Empty(t, second.panics)
		close(release)
		synctest.Wait()
		runner.Run(t.Context(), second, func() {}, matchingWork)
		synctest.Wait()
		require.Equal(t, []Outcome{Match}, first.outcomes)
		require.Equal(t, []Outcome{Match}, second.outcomes)
	})
}

func TestRunnerDeadlineDoesNotReleaseRunningWork(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		runner := newTestRunner(t)
		observer := &recordingObserver{}
		timedOut, release := make(chan struct{}), make(chan struct{})
		var deadlineErr error
		runner.Run(t.Context(), observer, func() {}, func() Work {
			work := matchingWork()
			work.Call = func(ctx context.Context) {
				<-ctx.Done()
				deadlineErr = ctx.Err()
				close(timedOut)
				<-release
			}
			return work
		})
		<-timedOut
		require.ErrorIs(t, deadlineErr, context.DeadlineExceeded)
		skipped := &recordingObserver{}
		runner.Run(t.Context(), skipped, func() {}, func() Work { panic("must not prepare") })
		require.Equal(t, []SkipReason{Capacity}, skipped.skips)
		close(release)
		synctest.Wait()
		// Even a callback claiming success cannot turn an expired call into a match.
		require.Equal(t, []Outcome{Failed}, observer.outcomes)
		require.Empty(t, runner.inFlight)
	})
}

func TestRunnerReleasesSlotOnEveryOutcome(t *testing.T) {
	for _, outcome := range []Outcome{Match, Mismatch, Failed} {
		t.Run(string(outcome), func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				runner := newTestRunner(t)
				observer := &recordingObserver{}
				runner.Run(t.Context(), observer, func() {}, func() Work {
					work := matchingWork()
					work.Compare = func(context.Context) Outcome { return outcome }
					return work
				})
				synctest.Wait()
				require.Equal(t, []Outcome{outcome}, observer.outcomes)
				require.Empty(t, runner.inFlight)
			})
		})
	}
}

func TestRunnerShadowPanicsPreservePrimary(t *testing.T) {
	for _, stage := range []string{"prepare", "snapshot", "call", "compare"} {
		t.Run(stage, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				runner := newTestRunner(t)
				observer := &recordingObserver{}
				calls := 0
				runner.Run(t.Context(), observer, func() { calls++ }, func() Work {
					work := matchingWork()
					switch stage {
					case "prepare":
						panic(stage)
					case "snapshot":
						work.Snapshot = func() { panic(stage) }
					case "call":
						work.Call = func(context.Context) { panic(stage) }
					case "compare":
						work.Compare = func(context.Context) Outcome { panic(stage) }
					}
					return work
				})
				synctest.Wait()
				require.Equal(t, 1, calls)
				require.Equal(t, []Outcome{Failed}, observer.outcomes)
				require.Equal(t, []any{stage}, observer.panics)
				require.Empty(t, runner.inFlight)
			})
		})
	}
}

func TestRunnerPrimaryPanicPropagatesAndReleasesSlot(t *testing.T) {
	runner := newTestRunner(t)
	observer := &recordingObserver{}
	require.PanicsWithValue(t, "primary", func() {
		runner.Run(t.Context(), observer, func() { panic("primary") }, matchingWork)
	})
	require.Empty(t, runner.inFlight)
	require.Empty(t, observer.outcomes)
	require.Empty(t, observer.panics)
}
