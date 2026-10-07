package checkscheduler

import (
	"context"
	"errors"
	"fmt"
	"sync/atomic"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/apps/advisor/pkg/app/metrics"
	"github.com/grafana/grafana/pkg/infra/leaderelection"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// fakeElector is a function-backed leaderelection.Elector.
type fakeElector struct {
	run func(ctx context.Context, fn func(ctx context.Context)) error
}

func (f *fakeElector) Run(ctx context.Context, fn func(ctx context.Context), _ ...leaderelection.RunOption) error {
	return f.run(ctx, fn)
}

// newCountingMTRunner returns an MT runner whose Check list calls (the first
// thing the MT scheduler does) are counted, optionally failing with listErr.
func newCountingMTRunner(listCalls *atomic.Int32, listErr error) *Runner {
	checkClient := &MockClient{
		listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
			listCalls.Add(1)
			if listErr != nil {
				return nil, listErr
			}
			return &advisorv0alpha1.CheckList{Items: []advisorv0alpha1.Check{}}, nil
		},
	}
	return createTestMTRunner(checkClient, &MockClient{}, &MockCheckService{checks: []checks.Check{}})
}

func setLeaderRetryBackoff(t *testing.T, d time.Duration) {
	t.Helper()
	old := leaderRetryBackoff
	leaderRetryBackoff = d
	t.Cleanup(func() { leaderRetryBackoff = old })
}

func TestRunMTAsLeader_FollowerDoesNotSchedule(t *testing.T) {
	var listCalls atomic.Int32
	r := newCountingMTRunner(&listCalls, nil)
	r.leaderElector = leaderelection.NewNoopElector()

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	err := r.Run(ctx)

	assert.ErrorIs(t, err, context.DeadlineExceeded)
	assert.Zero(t, listCalls.Load(), "a replica that never leads must not run discovery")
	assert.Zero(t, testutil.ToFloat64(metrics.MTSchedulerIsLeader))
}

func TestRunMTAsLeader_LeaderRunsScheduler(t *testing.T) {
	var leaderGaugeDuringRun atomic.Value
	checkClient := &MockClient{
		listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
			leaderGaugeDuringRun.Store(testutil.ToFloat64(metrics.MTSchedulerIsLeader))
			return &advisorv0alpha1.CheckList{Items: []advisorv0alpha1.Check{}}, nil
		},
	}
	r := createTestMTRunner(checkClient, &MockClient{}, &MockCheckService{checks: []checks.Check{}})
	r.leaderElector = leaderelection.NewDefaultElector()

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	err := r.Run(ctx)

	assert.ErrorIs(t, err, context.DeadlineExceeded)
	require.NotNil(t, leaderGaugeDuringRun.Load(), "the leader must run discovery")
	assert.Equal(t, float64(1), leaderGaugeDuringRun.Load())
	assert.Zero(t, testutil.ToFloat64(metrics.MTSchedulerIsLeader), "gauge must reset once leadership ends")
}

// TestRunMTAsLeader_ReentersElectionAfterLeaseLoss mimics client-go, which runs
// the leader callback in its own goroutine and returns from Run as soon as the
// lease is lost, without waiting for the callback. The runner must re-enter the
// election, and never let two scheduler runs overlap.
func TestRunMTAsLeader_ReentersElectionAfterLeaseLoss(t *testing.T) {
	setLeaderRetryBackoff(t, time.Millisecond)

	var listCalls atomic.Int32
	r := newCountingMTRunner(&listCalls, nil)

	var rounds, active, maxActive atomic.Int32
	r.leaderElector = &fakeElector{run: func(ctx context.Context, fn func(ctx context.Context)) error {
		rounds.Add(1)
		leaderCtx, loseLease := context.WithCancel(ctx)
		go func() {
			n := active.Add(1)
			if n > maxActive.Load() {
				maxActive.Store(n)
			}
			defer active.Add(-1)
			fn(leaderCtx)
		}()
		select {
		case <-time.After(5 * time.Millisecond):
		case <-ctx.Done():
		}
		loseLease()
		return nil
	}}

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()
	err := r.Run(ctx)

	assert.ErrorIs(t, err, context.DeadlineExceeded)
	assert.GreaterOrEqual(t, rounds.Load(), int32(2), "runner must re-enter the election after losing the lease")
	assert.GreaterOrEqual(t, listCalls.Load(), int32(2), "each round that leads must run the scheduler")
	assert.Equal(t, int32(1), maxActive.Load(), "scheduler runs must not overlap across rounds")
}

func TestRunMTAsLeader_SchedulerErrorReleasesLeaseAndIsReturned(t *testing.T) {
	bootErr := errors.New("boom")
	var listCalls atomic.Int32
	r := newCountingMTRunner(&listCalls, bootErr)

	var released atomic.Bool
	r.leaderElector = &fakeElector{run: func(ctx context.Context, fn func(ctx context.Context)) error {
		// Hold the lease until the round's context is cancelled, as a real
		// elector does with ReleaseOnCancel.
		go fn(ctx)
		<-ctx.Done()
		released.Store(true)
		return ctx.Err()
	}}

	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	err := r.Run(ctx)

	assert.ErrorIs(t, err, bootErr)
	assert.True(t, released.Load(), "lease must be released when the scheduler fails")
	assert.NoError(t, ctx.Err(), "the error must surface without waiting for the parent context")
}

// TestRunMTAsLeader_SchedulerContextErrorWhileLeadingReleasesLease covers a
// request-level timeout from discovery: it wraps context.DeadlineExceeded even
// though the lease is still held, and must not be mistaken for lease loss.
func TestRunMTAsLeader_SchedulerContextErrorWhileLeadingReleasesLease(t *testing.T) {
	listErr := fmt.Errorf("list checks: %w", context.DeadlineExceeded)
	var listCalls atomic.Int32
	r := newCountingMTRunner(&listCalls, listErr)

	var released atomic.Bool
	r.leaderElector = &fakeElector{run: func(ctx context.Context, fn func(ctx context.Context)) error {
		go fn(ctx)
		<-ctx.Done()
		released.Store(true)
		return ctx.Err()
	}}

	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	err := r.Run(ctx)

	assert.ErrorIs(t, err, context.DeadlineExceeded)
	assert.True(t, released.Load(), "lease must be released when the scheduler fails")
	assert.NoError(t, ctx.Err(), "the error must surface without waiting for the parent context")
}

// TestRunMTElectionRound_LateCallbackSkipped covers an elector invoking the
// callback after its Run has already returned: the round has ended, so the
// late callback must not start a scheduler that nothing waits for.
func TestRunMTElectionRound_LateCallbackSkipped(t *testing.T) {
	var listCalls atomic.Int32
	r := newCountingMTRunner(&listCalls, nil)

	var lateFn func(ctx context.Context)
	r.leaderElector = &fakeElector{run: func(ctx context.Context, fn func(ctx context.Context)) error {
		lateFn = fn
		return nil
	}}

	err := r.runMTElectionRound(context.Background(), &logging.NoOpLogger{})
	require.NoError(t, err)
	require.NotNil(t, lateFn)

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	lateFn(ctx)
	assert.Zero(t, listCalls.Load(), "a callback arriving after the round ended must not run the scheduler")
}

func TestRunMTElectionRound_ElectorErrorIsReturned(t *testing.T) {
	var listCalls atomic.Int32
	r := newCountingMTRunner(&listCalls, nil)
	electErr := errors.New("failed to create leader elector")
	r.leaderElector = &fakeElector{run: func(ctx context.Context, fn func(ctx context.Context)) error {
		return electErr
	}}

	err := r.Run(context.Background())
	assert.ErrorIs(t, err, electErr)
	assert.Zero(t, listCalls.Load())
}
