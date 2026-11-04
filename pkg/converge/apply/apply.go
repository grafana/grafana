package apply

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/converge"
)

// ErrDeferred is returned by an [Actuator] that did not perform an operation
// and wants it attempted again after the run.
//
// It exists for budget-shaped reasons: capacity freed by the operations that
// did succeed is not knowable when a stage is scheduled, so "try this once the
// rest is done" is a deadline no stage order can express. It is not a retry
// mechanism for transient failures — those are the actuator's own business.
var ErrDeferred = errors.New("apply: operation deferred")

// DefaultOpTimeout bounds a single operation when [Config.OpTimeout] is unset.
// An operation is always bounded: an actuator that hangs must not hold a stage
// open forever.
const DefaultOpTimeout = 30 * time.Second

// Actuator performs one operation against the target. It is the only interface
// a consumer must implement.
//
// An actuator may be called concurrently for different operations. It must be
// idempotent for [converge.OpEnsureContainer], which the plan may ask for even
// when the container already exists.
type Actuator interface {
	Execute(ctx context.Context, op converge.Op) error
}

// ActuatorFunc adapts a function to [Actuator].
type ActuatorFunc func(context.Context, converge.Op) error

func (f ActuatorFunc) Execute(ctx context.Context, op converge.Op) error { return f(ctx, op) }

// Dispatcher routes operations to a function per kind, for consumers that
// prefer that to a switch. A nil field makes its kind a no-op, which is useful
// for a consumer that genuinely has nothing to do for one of them — but a nil
// field for a kind the plan actually contains silently does nothing, so set
// every kind the plan can produce.
type Dispatcher struct {
	Create          func(context.Context, converge.Op) error
	Update          func(context.Context, converge.Op) error
	Delete          func(context.Context, converge.Op) error
	Move            func(context.Context, converge.Op) error
	EnsureContainer func(context.Context, converge.Op) error
	RemoveContainer func(context.Context, converge.Op) error
}

// Execute implements [Actuator].
func (d Dispatcher) Execute(ctx context.Context, op converge.Op) error {
	var fn func(context.Context, converge.Op) error
	switch op.Kind {
	case converge.OpCreate:
		fn = d.Create
	case converge.OpUpdate:
		fn = d.Update
	case converge.OpDelete:
		fn = d.Delete
	case converge.OpMove:
		fn = d.Move
	case converge.OpEnsureContainer:
		fn = d.EnsureContainer
	case converge.OpRemoveContainer:
		fn = d.RemoveContainer
	}
	if fn == nil {
		return nil
	}
	return fn(ctx, op)
}

// Status is the outcome of one operation.
type Status uint8

const (
	// Applied means the actuator returned without error.
	Applied Status = iota
	// Failed means the actuator returned an error.
	Failed
	// Skipped means something this operation depended on failed, so attempting
	// it could only produce a second, misleading error.
	Skipped
	// Deferred means the actuator declined to perform it and it was still
	// declined when retried, or was never retried.
	Deferred
	// NotAttempted means the run stopped before reaching it.
	NotAttempted
)

func (s Status) String() string {
	switch s {
	case Applied:
		return "applied"
	case Failed:
		return "failed"
	case Skipped:
		return "skipped"
	case Deferred:
		return "deferred"
	case NotAttempted:
		return "not-attempted"
	}
	return "unknown"
}

// Config tunes execution.
type Config struct {
	// Workers caps how many operations run concurrently within a stage. Zero
	// or one runs them one at a time.
	Workers int

	// Serial lists kinds that run one at a time whatever Workers says.
	// Container operations usually belong here: ensuring a container walks its
	// ancestors, so concurrent ensures race on a shared parent.
	Serial []converge.OpKind

	// OpTimeout bounds one operation. Zero uses [DefaultOpTimeout].
	OpTimeout time.Duration

	// ContinueOnError keeps going after a failure, skipping only what depended
	// on the failed operation. The default is to drain the current stage and
	// stop.
	ContinueOnError bool

	// RetryDeferred attempts operations that returned [ErrDeferred] once more,
	// after every stage has finished, in plan order. One pass only: if an
	// operation is still deferred, it is reported as such rather than retried
	// again, because nothing further is going to free capacity.
	RetryDeferred bool

	// Halt, when set, is consulted as operations are scheduled and after each
	// stage. A non-nil error stops queued work and is returned once the
	// in-flight operations have drained.
	//
	// This is the circuit breaker a caller needs when per-operation failures
	// are recorded rather than returned: past some threshold, continuing only
	// produces more of the same report. The library has no opinion on the
	// threshold.
	Halt func() error

	// Observer, when set, receives progress callbacks.
	Observer Observer
}

func (c Config) workers() int {
	if c.Workers < 1 {
		return 1
	}
	return c.Workers
}

func (c Config) timeout() time.Duration {
	if c.OpTimeout <= 0 {
		return DefaultOpTimeout
	}
	return c.OpTimeout
}

func (c Config) isSerial(k converge.OpKind) bool {
	for _, s := range c.Serial {
		if s == k {
			return true
		}
	}
	return false
}

// Observer receives progress callbacks. This package does no logging, emits no
// metrics and starts no spans; a consumer that wants any of those implements
// them here.
//
// Callbacks for different operations may run on different goroutines
// concurrently. They must not block longer than the consumer intends: nothing
// schedules around them.
type Observer interface {
	OpStarted(converge.Op)
	OpFinished(converge.Op, Status, error)
	StageFinished(index int, r *Result)
}

// OpOutcome is what happened to one operation.
type OpOutcome struct {
	Ref    converge.OpRef
	Op     converge.Op
	Status Status
	Err    error
}

// Result reports the outcome of a run. Outcomes are in plan order regardless
// of the order operations completed in.
type Result struct {
	Outcomes []OpOutcome

	Applied      int
	Failed       int
	Skipped      int
	Deferred     int
	NotAttempted int
}

// Converged reports whether every operation was applied. A consumer must not
// advance its version position when this is false: the target does not hold
// what the source declares, so the next run has work to do.
func (r *Result) Converged() bool {
	return r.Failed == 0 && r.Skipped == 0 && r.Deferred == 0 && r.NotAttempted == 0
}

// Errors returns the errors from failed operations, in plan order.
func (r *Result) Errors() []error {
	var out []error
	for _, o := range r.Outcomes {
		if o.Status == Failed && o.Err != nil {
			out = append(out, o.Err)
		}
	}
	return out
}

// Run executes the plan stage by stage.
//
// Stages are barriers: stage i+1 does not begin until every operation in stage
// i has terminated. Within a stage, operations run concurrently up to
// [Config.Workers], except those whose kind appears in [Config.Serial].
//
// When an operation fails, everything whose dependency closure includes it is
// marked [Skipped] and never attempted. Run returns the context's error if it
// was cancelled, and otherwise nil — a failed operation is reported in the
// result rather than returned, because the caller needs the whole picture to
// decide whether to advance its position.
func Run(ctx context.Context, p *converge.Plan, a Actuator, cfg Config) (*Result, error) {
	// Guard before touching p: sizing the result from p.Ops first would panic
	// on the nil plan this is supposed to accept.
	if p == nil || len(p.Ops) == 0 {
		return &Result{}, nil
	}

	status := make(map[converge.OpRef]Status, len(p.Ops))
	errs := make(map[converge.OpRef]error, len(p.Ops))
	var mu sync.Mutex

	failed := make(map[converge.OpRef]bool, len(p.Ops))
	stop := false
	var haltErr error

	for stageIdx, stage := range p.Stages {
		if ctxErr := ctx.Err(); ctxErr != nil {
			stop = true
		}
		if stop {
			for _, op := range stage {
				status[op.Ref()] = NotAttempted
			}
			continue
		}

		runnable := make([]converge.Op, 0, len(stage))
		for _, op := range stage {
			if blockedBy(op, failed) {
				status[op.Ref()] = Skipped
				// A skipped operation did not happen, so anything depending on
				// it is no more satisfied than if it had failed. Without this
				// only direct dependents are held back, and a write two levels
				// below a failed container is attempted and reported applied.
				failed[op.Ref()] = true
				notify(cfg.Observer, op, Skipped, nil)
				continue
			}
			runnable = append(runnable, op)
		}

		stageFailed := runStage(ctx, runnable, a, cfg, func(op converge.Op, st Status, err error) {
			mu.Lock()
			status[op.Ref()] = st
			if err != nil && st != Deferred {
				errs[op.Ref()] = err
			}
			// A deferred operation has not failed, so nothing that depends on
			// it is skipped: it is going to be attempted again.
			if st != Applied && st != Deferred {
				failed[op.Ref()] = true
			}
			mu.Unlock()
		})

		if cfg.Observer != nil {
			cfg.Observer.StageFinished(stageIdx, snapshot(p, status, errs))
		}
		if stageFailed && !cfg.ContinueOnError {
			stop = true
		}
		if cfg.Halt != nil {
			if err := cfg.Halt(); err != nil {
				haltErr = err
				stop = true
			}
		}
	}

	if cfg.RetryDeferred && !stop {
		retryDeferred(ctx, p, a, cfg, status, errs, &mu)
	}

	res := snapshot(p, status, errs)
	if haltErr != nil {
		return res, haltErr
	}
	return res, ctx.Err()
}

// retryDeferred gives every deferred operation one more attempt, in plan order
// so that an operation freeing capacity can do so for the next one.
func retryDeferred(
	ctx context.Context,
	p *converge.Plan,
	a Actuator,
	cfg Config,
	status map[converge.OpRef]Status,
	errs map[converge.OpRef]error,
	mu *sync.Mutex,
) {
	for _, op := range p.Ops {
		if ctx.Err() != nil {
			return
		}
		mu.Lock()
		deferred := status[op.Ref()] == Deferred
		mu.Unlock()
		if !deferred {
			continue
		}

		opCtx, cancel := context.WithTimeout(ctx, cfg.timeout())
		err := a.Execute(opCtx, op)
		cancel()

		st := Applied
		switch {
		case errors.Is(err, ErrDeferred):
			st = Deferred
		case err != nil:
			st = Failed
		}
		mu.Lock()
		status[op.Ref()] = st
		if err != nil && st != Deferred {
			errs[op.Ref()] = err
		}
		mu.Unlock()
		notify(cfg.Observer, op, st, err)

		if cfg.Halt != nil && cfg.Halt() != nil {
			return
		}
	}
}

// blockedBy reports whether any operation this one depends on did not succeed.
// Attempting it anyway would produce a second error that says nothing the
// first one did not.
func blockedBy(op converge.Op, failed map[converge.OpRef]bool) bool {
	for _, dep := range op.DependsOn {
		if failed[dep] {
			return true
		}
	}
	return false
}

func runStage(ctx context.Context, ops []converge.Op, a Actuator, cfg Config, record func(converge.Op, Status, error)) bool {
	if len(ops) == 0 {
		return false
	}

	var (
		wg       sync.WaitGroup
		sem      = make(chan struct{}, cfg.workers())
		serialMu sync.Mutex
		anyFail  int
		failMu   sync.Mutex
	)

	markFail := func() {
		failMu.Lock()
		anyFail++
		failMu.Unlock()
	}

	for _, op := range ops {
		if ctx.Err() != nil {
			record(op, NotAttempted, nil)
			continue
		}
		// The breaker is checked while scheduling, not only between stages: a
		// stage of thousands of independent writes would otherwise run every
		// one of them after the threshold had already tripped.
		if cfg.Halt != nil && cfg.Halt() != nil {
			record(op, NotAttempted, nil)
			continue
		}
		wg.Add(1)
		sem <- struct{}{}
		go func(op converge.Op) {
			defer wg.Done()
			defer func() { <-sem }()

			if cfg.isSerial(op.Kind) {
				serialMu.Lock()
				defer serialMu.Unlock()
			}

			if cfg.Observer != nil {
				cfg.Observer.OpStarted(op)
			}

			opCtx, cancel := context.WithTimeout(ctx, cfg.timeout())
			defer cancel()
			err := a.Execute(opCtx, op)

			st := Applied
			switch {
			case errors.Is(err, ErrDeferred):
				st = Deferred
			case err != nil:
				st = Failed
				markFail()
			}
			record(op, st, err)
			notify(cfg.Observer, op, st, err)
		}(op)
	}
	wg.Wait()
	return anyFail > 0
}

func notify(o Observer, op converge.Op, st Status, err error) {
	if o == nil {
		return
	}
	o.OpFinished(op, st, err)
}

func snapshot(p *converge.Plan, status map[converge.OpRef]Status, errs map[converge.OpRef]error) *Result {
	res := &Result{Outcomes: make([]OpOutcome, 0, len(p.Ops))}
	for _, op := range p.Ops {
		ref := op.Ref()
		st, ok := status[ref]
		if !ok {
			st = NotAttempted
		}
		res.Outcomes = append(res.Outcomes, OpOutcome{Ref: ref, Op: op, Status: st, Err: errs[ref]})
		switch st {
		case Applied:
			res.Applied++
		case Failed:
			res.Failed++
		case Skipped:
			res.Skipped++
		case Deferred:
			res.Deferred++
		default:
			res.NotAttempted++
		}
	}
	return res
}
