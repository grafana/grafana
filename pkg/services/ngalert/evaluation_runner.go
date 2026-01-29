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
//   - When a node becomes secondary, evaluation stops and state cache is cleared.
//
// The scheduler is recreated on each promotion to primary.
type evaluationRunner struct {
	ng      *AlertNG
	cancel  context.CancelFunc
	done    chan error    // Receives error on crash, closed on clean exit
	stopped chan struct{} // Closed when goroutine exits (for Stop to wait)
}

// startEvaluation starts the scheduler and state manager for alert rule evaluation.
func (r *evaluationRunner) startEvaluation(ctx context.Context) {
	if r.cancel != nil {
		return
	}

	// Warm the state manager cache from the store before starting evaluation
	// to ensure we have the latest alert rule state in memory.
	r.ng.stateManager.Warm(ctx, r.ng.store, r.ng.store, r.ng.StartupInstanceReader)
	if r.ng.schedule == nil {
		r.ng.schedule = schedule.NewScheduler(r.ng.schedCfg, r.ng.stateManager)
	}

	schedCtx, cancel := context.WithCancel(ctx)
	r.cancel = cancel
	r.done = make(chan error, 1)
	r.stopped = make(chan struct{})

	// Start the scheduler
	g, gCtx := errgroup.WithContext(schedCtx)
	g.Go(func() error {
		err := r.ng.schedule.Run(gCtx)
		if err == nil && gCtx.Err() == nil {
			return fmt.Errorf("scheduler stopped unexpectedly")
		}
		return err
	})

	// Start the state manager
	g.Go(func() error { return r.ng.stateManager.Run(gCtx) })

	// Wait for scheduler and state manager to finish in background.
	// Signal errors via r.done, completion via r.stopped.
	go func() {
		defer close(r.stopped)
		defer close(r.done)
		if err := g.Wait(); err != nil && !errors.Is(err, context.Canceled) {
			r.done <- err
		}
	}()
}

// stopEvaluation cancels evaluation, waits for completion, and clears state.
func (r *evaluationRunner) stopEvaluation() {
	if r.cancel == nil {
		return
	}
	r.cancel()
	<-r.stopped
	r.ng.stateManager.ClearCache()
	r.ng.schedule = nil
	r.cancel = nil
	r.done = nil
	r.stopped = nil
}

// run manages the lifecycle of the scheduler and state manager based on HA coordination.
// It listens for updates from the evaluation coordinator and starts/stops evaluation accordingly.
func (r *evaluationRunner) run(ctx context.Context) error {
	updates := r.ng.evaluationCoordinator.Updates(ctx)

	var shouldEvaluate bool
	for {
		select {
		case <-ctx.Done():
			if shouldEvaluate {
				r.stopEvaluation()
			}
			return nil
		case err, ok := <-r.done:
			if ok {
				return err
			}
			if ctx.Err() != nil {
				return nil
			}
			return fmt.Errorf("evaluation stopped unexpectedly")
		case newShouldEvaluate, ok := <-updates:
			if !ok {
				if shouldEvaluate {
					r.stopEvaluation()
				}
				return nil
			}
			if newShouldEvaluate && !shouldEvaluate {
				r.ng.Log.Info("Primary node, alert rule evaluation enabled")
				r.startEvaluation(ctx)
			} else if !newShouldEvaluate && shouldEvaluate {
				r.ng.Log.Info("Secondary node, alert rule evaluation disabled")
				r.stopEvaluation()
			}
			shouldEvaluate = newShouldEvaluate
		}
	}
}
