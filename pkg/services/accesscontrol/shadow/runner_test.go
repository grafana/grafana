package shadow

import (
	"context"
	"errors"
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/mock/gomock"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

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
	snapshot := func() { panic("unexpected Snapshot callback for invalid work") }
	call := func(context.Context) { panic("unexpected Call callback for invalid work") }
	compare := func(context.Context) Outcome { panic("unexpected Compare callback for invalid work") }

	for _, tc := range []struct {
		name      string
		work      Work
		wantError string
	}{
		{
			name:      "missing Snapshot",
			work:      Work{Call: call, Compare: compare},
			wantError: "shadow work Snapshot callback is required",
		},
		{
			name:      "missing Call",
			work:      Work{Snapshot: snapshot, Compare: compare},
			wantError: "shadow work Call callback is required",
		},
		{
			name:      "missing Compare",
			work:      Work{Snapshot: snapshot, Call: call},
			wantError: "shadow work Compare callback is required",
		},
		{
			name:      "empty work",
			work:      Work{},
			wantError: "shadow work Snapshot callback is required",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				controller := gomock.NewController(t)
				runner := newTestRunner(t)
				observer := NewMockObserver(controller)

				observer.EXPECT().ObserveDuration(Primary, gomock.Any())
				observer.EXPECT().ObserveError(gomock.Any(), gomock.Cond(func(err error) bool {
					return err != nil && err.Error() == tc.wantError
				}))
				observer.EXPECT().ObserveOutcome(Failed)

				primaryCalls := 0
				wantResult := 42
				wantErr := errors.New("primary failure")
				var result int
				var primaryErr error

				runner.Run(t.Context(), observer, func() {
					primaryCalls++
					result, primaryErr = wantResult, wantErr
				}, func() Work {
					return tc.work
				})
				synctest.Wait()

				require.Equal(t, 1, primaryCalls)
				require.Equal(t, wantResult, result)
				require.ErrorIs(t, primaryErr, wantErr)

				require.Empty(t, runner.inFlight)

				next := NewMockObserver(controller)
				next.EXPECT().ObserveDuration(Primary, gomock.Any())
				next.EXPECT().ObserveDuration(Shadow, gomock.Any())
				next.EXPECT().ObserveOutcome(Match)

				runner.Run(t.Context(), next, func() {}, matchingWork)
				synctest.Wait()
			})
		})
	}
}

func TestRunnerDetachesRequestAndSnapshotsBeforeReturn(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		controller := gomock.NewController(t)
		runner := newTestRunner(t)
		observer := NewMockObserver(controller)
		primaryTiming := observer.EXPECT().ObserveDuration(Primary, 2*time.Millisecond)
		observer.EXPECT().ObserveDuration(Shadow, 3*time.Millisecond).After(primaryTiming)
		observer.EXPECT().ObserveOutcome(Match)

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

		require.Nil(t, actualContext.Value(requestKey{}))
		require.Equal(t, span, trace.SpanContextFromContext(actualContext))
		require.Empty(t, runner.inFlight)
	})
}

func TestRunnerSkipPolicyIsOptionalAndPerRun(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		controller := gomock.NewController(t)
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
			observer := NewMockObserver(controller)
			if tc.skipped {
				observer.EXPECT().ObserveSkip(SkipReason("test-policy"))
			} else {
				observer.EXPECT().ObserveDuration(Primary, gomock.Any())
				observer.EXPECT().ObserveDuration(Shadow, gomock.Any())
				observer.EXPECT().ObserveOutcome(Match)
			}

			calls, prepared := 0, false

			runner.Run(ctx, observer, func() { calls++ }, func() Work {
				prepared = true

				return matchingWork()
			}, tc.options...)
			synctest.Wait()

			require.Equal(t, 1, calls, tc.name)
			require.Equal(t, !tc.skipped, prepared, tc.name)
			require.Empty(t, runner.inFlight, tc.name)
		}
	})
}

func TestRunnerSkipPolicyPanicPreservesPrimary(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		controller := gomock.NewController(t)
		runner := newTestRunner(t)
		observer := NewMockObserver(controller)
		observer.EXPECT().ObservePanic(gomock.Any(), "policy")
		observer.EXPECT().ObserveOutcome(Failed)

		calls := 0

		runner.Run(t.Context(), observer, func() { calls++ }, func() Work {
			t.Fatal("must not prepare after a policy panic")

			return Work{}
		}, WithSkip(func(context.Context) SkipReason { panic("policy") }))

		require.Equal(t, 1, calls)
		require.Empty(t, runner.inFlight)

		next := NewMockObserver(controller)
		next.EXPECT().ObserveDuration(Primary, gomock.Any())
		next.EXPECT().ObserveDuration(Shadow, gomock.Any())
		next.EXPECT().ObserveOutcome(Match)

		runner.Run(t.Context(), next, func() {}, matchingWork)
		synctest.Wait()
	})
}

func TestRunnerSharesCapacityAcrossOperations(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		controller := gomock.NewController(t)
		runner := newTestRunner(t)
		first := NewMockObserver(controller)
		first.EXPECT().ObserveDuration(Primary, gomock.Any())
		first.EXPECT().ObserveDuration(Shadow, gomock.Any())
		first.EXPECT().ObserveOutcome(Match)

		second := NewMockObserver(controller)
		second.EXPECT().ObserveSkip(Capacity)

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

		close(release)
		synctest.Wait()

		second.EXPECT().ObserveDuration(Primary, gomock.Any())
		second.EXPECT().ObserveDuration(Shadow, gomock.Any())
		second.EXPECT().ObserveOutcome(Match)

		runner.Run(t.Context(), second, func() {}, matchingWork)
		synctest.Wait()
	})
}

func TestRunnerDeadlineDoesNotReleaseRunningWork(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		controller := gomock.NewController(t)
		runner := newTestRunner(t)
		observer := NewMockObserver(controller)
		observer.EXPECT().ObserveDuration(Primary, gomock.Any())
		observer.EXPECT().ObserveDuration(Shadow, gomock.Any())
		// Even a callback claiming success cannot turn an expired call into a match.
		observer.EXPECT().ObserveOutcome(Failed)

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

		skipped := NewMockObserver(controller)
		skipped.EXPECT().ObserveSkip(Capacity)

		runner.Run(t.Context(), skipped, func() {}, func() Work { panic("must not prepare") })

		close(release)
		synctest.Wait()

		require.Empty(t, runner.inFlight)
	})
}

func TestRunnerReleasesSlotOnEveryOutcome(t *testing.T) {
	for _, outcome := range []Outcome{Match, Mismatch, Failed} {
		t.Run(string(outcome), func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				controller := gomock.NewController(t)
				runner := newTestRunner(t)
				observer := NewMockObserver(controller)
				observer.EXPECT().ObserveDuration(Primary, gomock.Any())
				observer.EXPECT().ObserveDuration(Shadow, gomock.Any())
				observer.EXPECT().ObserveOutcome(outcome)

				runner.Run(t.Context(), observer, func() {}, func() Work {
					work := matchingWork()
					work.Compare = func(context.Context) Outcome { return outcome }

					return work
				})
				synctest.Wait()

				require.Empty(t, runner.inFlight)
			})
		})
	}
}

func TestRunnerShadowPanicsPreservePrimary(t *testing.T) {
	for _, stage := range []string{"prepare", "snapshot", "call", "compare"} {
		t.Run(stage, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				controller := gomock.NewController(t)
				runner := newTestRunner(t)
				observer := NewMockObserver(controller)
				observer.EXPECT().ObserveDuration(Primary, gomock.Any())
				if stage == "call" || stage == "compare" {
					observer.EXPECT().ObserveDuration(Shadow, gomock.Any())
				}
				observer.EXPECT().ObservePanic(gomock.Any(), stage)
				observer.EXPECT().ObserveOutcome(Failed)

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
				require.Empty(t, runner.inFlight)
			})
		})
	}
}

func TestRunnerPrimaryPanicPropagatesAndReleasesSlot(t *testing.T) {
	controller := gomock.NewController(t)
	runner := newTestRunner(t)
	observer := NewMockObserver(controller)
	observer.EXPECT().ObserveDuration(Primary, gomock.Any())

	require.PanicsWithValue(t, "primary", func() {
		runner.Run(t.Context(), observer, func() { panic("primary") }, matchingWork)
	})

	require.Empty(t, runner.inFlight)
}
