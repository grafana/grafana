// Package apply executes a [converge.Plan] against a target.
//
// It is deliberately thin. The plan already says what to do and in what order;
// this package schedules it, bounds it, and reports what happened. It never
// re-decides anything: it does not reorder beyond the plan's own stages, does
// not substitute one operation for another, does not retry, and skips an
// operation only because the plan's dependencies say it must or because the
// context was cancelled. Retry policy, logging, metrics and tracing all belong
// to the caller.
//
// A consumer may execute [converge.Plan.Ops] itself instead; the guarantees
// documented here then become its own responsibility.
//
//	res, err := apply.Run(ctx, plan, actuator, apply.Config{
//		Workers:   10,
//		Serial:    []converge.OpKind{converge.OpEnsureContainer, converge.OpRemoveContainer},
//		OpTimeout: 30 * time.Second,
//	})
//	if err != nil {
//		return err
//	}
//	if !res.Converged() {
//		return fmt.Errorf("%d failed, %d skipped", res.Failed, res.Skipped)
//	}
//
// # Recovery
//
// There is no checkpointing and no resume. Planning is pure and cheap relative
// to application, so the recovery story is to re-plan rather than to replay: a
// partially applied plan leaves a state the next plan reads directly and
// corrects. Persisting a plan and replaying it later is unsound, because the
// inventory it was computed against may have moved.
package apply
