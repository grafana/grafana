package parallel

import (
	"context"
	"fmt"
	"sync"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/util/errutil"
)

// ErrPanicked denotes recovering from a panic in a Future.
var ErrPanicked = errutil.NewBase(errutil.StatusInternal, "parallel.panic")

// RunFuture creates a new [Future] using [NewFuture] and starts it in
// the background before returning.
func RunFuture[T any](ctx context.Context, name string, fn func(context.Context) (T, error), opts FutureOpts) *Future[T] {
	f := NewFuture(ctx, name, fn, opts)
	f.Start()
	return f
}

// NewFuture creates a new [Future] that will run a function returning
// a value of any type and an [error].
//
// The Future is not started automatically and must be started manually
// using either [Future.Start] or a [Scheduler]
// (possibly via a [Group], to simplify the collection of the result).
func NewFuture[T any](ctx context.Context, name string, fn func(context.Context) (T, error), opts FutureOpts) *Future[T] {
	done := make(chan struct{})
	future := &Future[T]{
		name: name,
		fn:   fn,
		ctx:  ctx,
		done: done,
		opts: opts,
	}

	return future
}

// FutureOpts contain runtime options for running a [Future].
type FutureOpts struct {
	// CrashOnPanic overrides the default panic recovery and allows a
	// [Future] to retain the default Go-routine behavior of crashing
	// the application in case a failure occurs.
	CrashOnPanic bool
	// NowFunc allows overriding the function used to determine the
	// start and end time of a [Future]. Primarily for testing.
	NowFunc func() time.Time
	// Tracer, if set, will be used to create a span for the [Future].
	Tracer tracing.Tracer
	// Logger, if set, will log the beginning of the execution of the
	// [Future] with debug level and the end of the execution at info
	// level.
	Logger log.Logger
}

// A Future is a concurrency primitive running a given task in the
// background yielding either a value or an error in a [Result] when
// completed.
type Future[T any] struct {
	name     string
	fn       func(context.Context) (T, error)
	ctx      context.Context
	once     sync.Once
	done     chan struct{}
	opts     FutureOpts
	finishFn func()

	result    Result[T]
	startTime time.Time
	endTime   time.Time
}

// Result combines an arbitrary value and an [error].
type Result[T any] struct {
	Value T
	Error error
}

// Start runs the [Future] in the background if it has not already run.
// Start will only start a Future once, and will immediately return on
// subsequent calls (it is idempotent).
func (f *Future[T]) Start() {
	finishFn := func() {
		f.endTime = f.opts.Now()
		close(f.done)
		if f.finishFn != nil {
			f.finishFn()
		}
	}
	recoverFn := func() {
		p := recover()
		if p != nil {
			f.result = Result[T]{Error: ErrPanicked.Errorf("caught panic crashing out of Future[%T]: %v", f.result.Value, p)}
		}
	}

	go f.once.Do(func() {
		var span tracing.Span
		if f.opts.Tracer != nil {
			f.ctx, span = f.opts.Tracer.Start(f.ctx, fmt.Sprintf("Future"))
			span.SetAttributes("name", f.name, attribute.String("name", f.name))
		}
		if f.opts.Logger != nil {
			f.opts.Logger.Debug("starting execution of Future", "name", f.name)
		}

		f.startTime = f.opts.Now()

		if !f.opts.CrashOnPanic {
			defer recoverFn()
		}

		val, err := f.fn(f.ctx)
		f.result = Result[T]{
			Value: val,
			Error: err,
		}

		finishFn()

		if span != nil {
			if err != nil {
				span.SetStatus(codes.Error, "future returned an error")
				span.RecordError(err)
				span.End()
			}
		}

		if f.opts.Logger != nil {
			args := []any{
				"name", f.name,
				"duration", f.Duration(),
			}
			if err != nil {
				args = append(args, "error", err.Error())
			}
			f.opts.Logger.Info("finished execution of Future", args...)
		}
	})
}

// Get returns ([Result], true) of the [Future] if it has completed
// and otherwise (empty [Result], false).
func (f *Future[T]) Get() (Result[T], bool) {
	if f.endTime.IsZero() {
		return Result[T]{}, false
	}

	return f.result, true
}

// Wait waits until the [Future] has completed and then returns its
// [Result].
func (f *Future[T]) Wait(ctx context.Context) Result[T] {
	select {
	case <-f.done:
	case <-ctx.Done():
		return Result[T]{Error: ctx.Err()}
	}

	return f.result
}

// Duration returns either of the following:
// The total runtime of the future if it has completed;
// the time since the future started if it is currently running;
// or 0 if it has not yet been started.
//
// It is possible that the returned value decreases on subsequent calls
// if Duration is called near the completion of the Future to avoid the
// need for complex synchronization.
func (f *Future[T]) Duration() time.Duration {
	if f.startTime.IsZero() {
		return 0
	}

	if f.endTime.IsZero() {
		return f.opts.Now().Sub(f.startTime)
	}

	return f.endTime.Sub(f.startTime)
}

// Now returns the value of [FutureOpts.NowFunc] if set, otherwise
// returns the value of [time.Now].
func (o FutureOpts) Now() time.Time {
	if o.NowFunc == nil {
		return time.Now()
	}

	return o.NowFunc()
}
