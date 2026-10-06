package checkscheduler

import (
	"context"
	"errors"
	"sync/atomic"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/apps/advisor/pkg/app/metrics"
)

// leaderRetryBackoff is how long a replica waits after losing the leader lease
// before re-entering the election, so a flapping lease doesn't hot-loop.
var leaderRetryBackoff = 5 * time.Second

// runMTAsLeader runs the MT scheduler only while this replica holds the leader
// lease. Every other replica waits in the election, so a cell does one
// cluster-wide discovery, cleanup and check creation pass at a time instead of
// one per replica.
//
// When the lease is lost the scheduler is stopped and the replica re-enters the
// election. A scheduler error is returned as-is, like runMT without election:
// the lease is released first so another replica can take over while the
// app-sdk runtime surfaces the error.
func (r *Runner) runMTAsLeader(ctx context.Context, logger logging.Logger) error {
	for {
		if err := r.runMTElectionRound(ctx, logger); err != nil {
			return err
		}
		if ctx.Err() != nil {
			return ctx.Err()
		}
		logger.Info("checkscheduler leader lease lost, re-entering election", "backoff", leaderRetryBackoff)
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(leaderRetryBackoff):
		}
	}
}

// runMTElectionRound runs one leader election. It blocks until ctx is cancelled,
// the lease is lost or the scheduler fails, and returns only once the scheduler
// has stopped, so the next round can't overlap with this one. It returns the
// scheduler's error, if any; losing the lease is not an error.
func (r *Runner) runMTElectionRound(ctx context.Context, logger logging.Logger) error {
	roundCtx, stopRound := context.WithCancel(ctx)
	defer stopRound()

	// The elector may invoke the callback asynchronously and can return before
	// it starts or finishes. Whoever flips `claimed` first owns the round: the
	// callback, which then closes done when the scheduler stops, or the code
	// after Run, which then knows the callback never started and blocks it from
	// starting late.
	var claimed atomic.Bool
	done := make(chan struct{})
	var schedulerErr error // written before close(done), read after <-done

	electErr := r.leaderElector.Run(roundCtx, func(leaderCtx context.Context) {
		if !claimed.CompareAndSwap(false, true) {
			return
		}
		defer close(done)

		metrics.MTSchedulerIsLeader.Set(1)
		defer metrics.MTSchedulerIsLeader.Set(0)
		logger.Info("checkscheduler acquired leader lease, starting MT scheduler")

		if err := r.runMT(leaderCtx, logger); err != nil && !isContextErr(err) {
			logger.Error("checkscheduler failed while leading, releasing lease", "error", err)
			schedulerErr = err
			stopRound()
		}
	})

	if claimed.CompareAndSwap(false, true) {
		// Never led this round. Only an error unrelated to cancellation (e.g.
		// the elector could not be built) is worth surfacing.
		if electErr != nil && !isContextErr(electErr) {
			return electErr
		}
		return nil
	}
	<-done
	return schedulerErr
}

func isContextErr(err error) bool {
	return errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded)
}
