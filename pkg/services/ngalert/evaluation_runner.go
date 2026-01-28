package ngalert

import (
	"context"
	"errors"
	"fmt"

	"golang.org/x/sync/errgroup"

	"github.com/grafana/grafana/pkg/services/ngalert/schedule"
)

// EvaluationCoordinator determines whether this instance should evaluate alert rules.
// In HA single-node evaluation mode, only one node in the cluster evaluates rules.
type EvaluationCoordinator interface {
	// Updates returns a channel that emits the current evaluation decision immediately,
	// then emits only when the decision changes.
	Updates(ctx context.Context) <-chan bool
}

// evaluationRunner manages alert rule evaluation lifecycle for HA single-node evaluation mode.
//
// In HA deployments with single-node evaluation enabled, only the primary node (position 0)
// evaluates alert rules. The EvaluationCoordinator monitors cluster position and signals
// when this node should start or stop evaluation:
//   - When a node becomes primary, its state cache is warmed from DB, then scheduler starts.
//   - When a node becomes secondary, evaluation stops.
//
// Scheduler and state persister are recreated on each promotion to primary.
type evaluationRunner struct {
	ng      *AlertNG
	cancel  context.CancelFunc
	done    chan error    // Receives error on crash, closed on clean exit
	stopped chan struct{} // Closed when goroutine exits (for Stop to wait)
}

// start begins evaluation if not already running.
func (r *evaluationRunner) start(ctx context.Context) {
	if r.cancel != nil {
		return
	}

	if r.ng.Cfg.UnifiedAlerting.HASingleNodeEvaluation {
		persister := initStatePersister(r.ng.Cfg.UnifiedAlerting, r.ng.stateManagerCfg, r.ng.FeatureToggles)
		r.ng.stateManager.SetPersister(persister)
	}

	r.ng.stateManager.Warm(ctx, r.ng.store, r.ng.store, r.ng.StartupInstanceReader)
	if r.ng.schedule == nil {
		r.ng.schedule = schedule.NewScheduler(r.ng.schedCfg, r.ng.stateManager)
	}

	r.ng.Log.Info("Starting alert rule evaluation")

	schedCtx, cancel := context.WithCancel(ctx)
	r.cancel = cancel
	r.done = make(chan error, 1)
	r.stopped = make(chan struct{})

	r.run(schedCtx)
}

// run starts the scheduler and state manager in an errgroup.
// Errors (except context.Canceled) are sent to r.done.
func (r *evaluationRunner) run(ctx context.Context) {
	g, gCtx := errgroup.WithContext(ctx)
	g.Go(func() error {
		err := r.ng.schedule.Run(gCtx)
		if err == nil && gCtx.Err() == nil {
			return fmt.Errorf("scheduler stopped unexpectedly")
		}
		return err
	})
	g.Go(func() error { return r.ng.stateManager.Run(gCtx) })

	go func() {
		defer close(r.stopped)
		defer close(r.done)
		if err := g.Wait(); err != nil && !errors.Is(err, context.Canceled) {
			r.done <- err
		}
	}()
}

// stop cancels evaluation, waits for completion, and clears state.
func (r *evaluationRunner) stop() {
	if r.cancel == nil {
		return
	}
	r.ng.Log.Info("Stopping alert rule evaluation")
	r.cancel()
	<-r.stopped
	r.ng.stateManager.ClearCache()
	r.ng.schedule = nil
	r.cancel = nil
	r.done = nil
	r.stopped = nil
}
