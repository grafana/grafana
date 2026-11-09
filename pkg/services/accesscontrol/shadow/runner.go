// Package shadow runs bounded, observational comparisons without changing the
// authoritative call. Operation adapters own routing, snapshots, comparison
// semantics, and any cache-write suppression required by their shadow client.
package shadow

import (
	"context"
	"fmt"
	"time"

	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type Implementation string

const (
	Primary Implementation = "primary"
	Shadow  Implementation = "shadow"
)

type Outcome string

const (
	Match    Outcome = "match"
	Mismatch Outcome = "mismatch"
	Failed   Outcome = "error"
)

type SkipReason string

const (
	Transaction SkipReason = "transaction"
	Capacity    SkipReason = "capacity"
)

// Observer binds instrumentation to an operation. Implementations must be safe
// for concurrent calls. Keeping registration outside Runner lets adapters retain
// existing metrics or bind shared collectors to fixed operation labels.
type Observer interface {
	ObserveDuration(Implementation, time.Duration)
	ObserveOutcome(Outcome)
	ObserveSkip(SkipReason)
	ObservePanic(context.Context, any)
}

// Work captures operation-specific state without requiring untyped results.
// Snapshot copies the primary result synchronously, before the caller can mutate
// it. Call and Compare run sequentially in the background; only Call is timed.
type Work struct {
	Snapshot func()
	Call     func(context.Context)
	Compare  func(context.Context) Outcome
}

// Runner's capacity is shared by all operations using this instance. Reuse one
// runner to impose a service-wide limit; observers do not get separate budgets.
type Runner struct {
	inFlight chan struct{}
	timeout  time.Duration
}

func NewRunner(maxConcurrent int, timeout time.Duration) (*Runner, error) {
	if maxConcurrent < 1 {
		return nil, fmt.Errorf("shadow concurrency must be positive: %d", maxConcurrent)
	}
	if timeout <= 0 {
		return nil, fmt.Errorf("shadow timeout must be positive: %s", timeout)
	}
	return &Runner{inFlight: make(chan struct{}, maxConcurrent), timeout: timeout}, nil
}

// Run always invokes primary synchronously and preserves its panic behavior.
// prepare snapshots inputs before primary, and is skipped when admission fails.
// Panics in shadow preparation, execution, or comparison are observational only.
// Callbacks must use the provided background context and respect its deadline;
// capacity remains occupied until work actually exits, even after cancellation.
func (r *Runner) Run(ctx context.Context, observer Observer, primary func(), prepare func() Work) {
	if r == nil {
		primary()
		return
	}
	// A detached read cannot compare the caller's uncommitted transaction state.
	if session, ok := ctx.Value(sqlstore.ContextSessionKey{}).(*sqlstore.DBSession); ok && session != nil {
		observer.ObserveSkip(Transaction)
		primary()
		return
	}
	select {
	case r.inFlight <- struct{}{}:
	default:
		observer.ObserveSkip(Capacity)
		primary()
		return
	}
	launched := false
	defer func() {
		// Until handoff, this also releases capacity if primary panics.
		if !launched {
			<-r.inFlight
		}
	}()

	// WithoutCancel would retain SQL sessions and other caller-owned values.
	background := trace.ContextWithSpanContext(context.Background(), trace.SpanContextFromContext(ctx))
	var work Work
	prepared := safely(background, observer, func() { work = prepare() })
	measure(observer, Primary, primary)
	if !prepared || !safely(background, observer, work.Snapshot) {
		return
	}

	launched = true
	go func() {
		defer func() { <-r.inFlight }()
		shadowCtx, cancel := context.WithTimeout(background, r.timeout)
		defer cancel()
		safely(shadowCtx, observer, func() {
			measure(observer, Shadow, func() { work.Call(shadowCtx) })
			outcome := work.Compare(shadowCtx)
			if shadowCtx.Err() != nil {
				outcome = Failed
			}
			observer.ObserveOutcome(outcome)
		})
	}()
}

func measure(observer Observer, implementation Implementation, call func()) {
	start := time.Now()
	defer func() { observer.ObserveDuration(implementation, time.Since(start)) }()
	call()
}

func safely(ctx context.Context, observer Observer, call func()) (ok bool) {
	defer func() {
		if recovered := recover(); recovered != nil {
			observer.ObservePanic(ctx, recovered)
			observer.ObserveOutcome(Failed)
		}
	}()
	call()
	return true
}
