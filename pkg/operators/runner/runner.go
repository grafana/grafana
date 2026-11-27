// Package runner owns the plumbing every standalone operator shares: logging,
// the NATS subscriber, client configuration, service supervision, readiness
// and shutdown. An operator only declares its controllers and services.
package runner

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/operators/supervision"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/setting"
)

// Operator declares a standalone operator.
type Operator struct {
	Name        string
	Description string
	// Logger names the operator's log lines; it defaults to Name.
	Logger string
	// NoNATS leaves Runtime.Subscriber nil for operators that consume no NATS
	// deltas, so they neither register its metrics nor dial NATS.
	NoNATS bool
	// RequireExternalNATS fails the operator at startup when [nats] is enabled
	// without an external server to reach, instead of running on re-lists alone.
	RequireExternalNATS bool
	// Defaults are the operator's values for the shared [operator] keys.
	Defaults Options
	// Build wires the operator from its runtime. It runs before any service
	// starts, so it should only read configuration and construct things.
	Build func(rt *Runtime) (*Parts, error)
}

// Parts is what an operator runs.
type Parts struct {
	// Services start in order after the NATS subscriber and stop in reverse
	// order; any of them failing stops the operator.
	Services []services.Service
	// Run runs the controllers until ctx is done and calls ready once they
	// serve. ctx is also cancelled when a supervised service fails.
	Run func(ctx context.Context, ready func()) error
	// ShutdownTimeout bounds how long Run may take to return once ctx is
	// done, so a stuck controller cannot block the process from exiting.
	// Zero waits for Run.
	ShutdownTimeout time.Duration
}

// Runtime carries what every operator gets from the runner.
type Runtime struct {
	Cfg        *setting.Cfg
	Logger     logging.Logger
	Registerer prometheus.Registerer
	Tracer     tracing.Tracer
	// Clients builds apiserver clients that share one TLS config and token
	// exchange client.
	Clients *Clients
	// Subscriber is the operator's NATS subscriber. The runner supervises it
	// when [nats] is enabled; use nats.Enabled to choose a delta source.
	Subscriber *nats.SubscriberService
	// Options are the shared [operator] keys, resolved against Defaults.
	Options Options
}

// Register adds op to the operators the Grafana binary can run.
func Register(op Operator) {
	server.RegisterOperator(op.ServerOperator())
}

// ServerOperator adapts op to the server's operator registry.
func (op Operator) ServerOperator() server.Operator {
	return server.Operator{Name: op.Name, Description: op.Description, RunFunc: op.Run}
}

// Run runs op until ctx is done or one of its services fails.
func (op Operator) Run(ctx context.Context, deps server.OperatorDependencies) (runErr error) {
	name := op.Logger
	if name == "" {
		name = op.Name
	}
	rt := &Runtime{
		Cfg:        deps.Config,
		Logger:     NewLogger(deps.Config, name),
		Registerer: deps.Registerer,
		Tracer:     deps.Tracer,
		Clients:    NewClients(deps.Config),
	}
	natsUsable := !op.NoNATS
	if deps.Config != nil {
		if err := validateExternalNATS(deps.Config); err != nil && !op.NoNATS {
			if op.RequireExternalNATS {
				return fmt.Errorf("setup %s: %w", op.Name, err)
			}
			// A subscriber that cannot connect would fail startup, so run without
			// one and rely on periodic re-lists instead.
			natsUsable = false
			rt.Logger.Warn("NATS deltas unavailable; falling back to periodic re-lists", "operator", op.Name, "error", err)
		}
		rt.Options = parseOptions(deps.Config, op.Defaults, natsUsable)
	}
	if natsUsable {
		rt.Subscriber = NewSubscriber(deps.Config, deps.Registerer)
	}
	rt.Logger.Info("starting operator", "operator", op.Name)

	parts, err := op.Build(rt)
	if err != nil {
		return fmt.Errorf("setup %s: %w", op.Name, err)
	}

	supervised := parts.Services
	if nats.Enabled(rt.Subscriber) {
		supervised = append([]services.Service{rt.Subscriber}, supervised...)
	}
	ctx, stop, err := supervision.Start(ctx, supervised...)
	health := &readiness{ctx: ctx, notifier: deps.HealthNotifier}
	defer func() {
		health.stop()
		runErr = joinStopError(runErr, stop())
	}()
	if err != nil {
		return err
	}

	done := make(chan error, 1)
	go func() {
		done <- parts.Run(ctx, func() {
			if health.ready() {
				rt.Logger.Info("operator is ready", "operator", op.Name)
			}
		})
	}()

	return dependencyCause(ctx, op.await(ctx, rt.Logger, health, parts, done))
}

func (op Operator) await(ctx context.Context, logger logging.Logger, health *readiness, parts *Parts, done <-chan error) error {
	select {
	case err := <-done:
		return err
	case <-ctx.Done():
	}
	health.stop()
	logger.Info("operator shutting down", "operator", op.Name)
	if parts.ShutdownTimeout <= 0 {
		return <-done
	}
	select {
	case err := <-done:
		return err
	case <-time.After(parts.ShutdownTimeout):
		logger.Warn("shutdown timeout exceeded, forcing exit", "timeout", parts.ShutdownTimeout)
		return nil
	}
}

// joinStopError adds a failure to stop the services to Run's error. The
// module server ignores errors matching context.Canceled, so when the result
// also holds a real failure, the cancellation branches are dropped to keep
// that failure visible.
func joinStopError(runErr, stopErr error) error {
	err := runErr
	if stopErr != nil {
		err = errors.Join(runErr, stopErr)
	}
	if !errors.Is(err, context.Canceled) {
		return err
	}
	if failures := withoutCancellation(err); failures != nil {
		return failures
	}
	return err
}

// withoutCancellation returns err without its context.Canceled branches, or
// nil if nothing else is left.
func withoutCancellation(err error) error {
	if !errors.Is(err, context.Canceled) {
		return err
	}
	switch e := err.(type) { //nolint:errorlint // walks this error's own unwrap tree one level at a time
	case interface{ Unwrap() []error }:
		var kept []error
		for _, child := range e.Unwrap() {
			if child = withoutCancellation(child); child != nil {
				kept = append(kept, child)
			}
		}
		return errors.Join(kept...)
	case interface{ Unwrap() error }:
		if inner := e.Unwrap(); inner != nil {
			if stripped := withoutCancellation(inner); stripped != nil {
				return &strippedError{msg: err.Error(), err: stripped}
			}
		}
	}
	return nil
}

// strippedError keeps a wrapper's message while unwrapping only to the causes
// left after dropping cancellation.
type strippedError struct {
	msg string
	err error
}

func (e *strippedError) Error() string { return e.msg }
func (e *strippedError) Unwrap() error { return e.err }

// dependencyCause replaces the cancellation Run reports when a supervised
// service failed with that failure, keeping any other errors Run returned.
// The module server ignores context.Canceled, so returning it as is would
// hide the failure.
func dependencyCause(ctx context.Context, err error) error {
	if !errors.Is(err, context.Canceled) {
		return err
	}
	if cause := context.Cause(ctx); cause != nil && !errors.Is(cause, context.Canceled) {
		return joinStopError(err, cause)
	}
	return err
}

// readiness drops ready callbacks that arrive once shutdown has begun or the
// supervised context is done, so a controller finishing its setup late cannot
// mark a stopping operator ready.
type readiness struct {
	ctx      context.Context
	mu       sync.Mutex
	stopped  bool
	notifier *server.HealthNotifier
}

func (r *readiness) ready() bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.stopped || r.ctx.Err() != nil {
		return false
	}
	r.notifier.SetReady()
	return true
}

func (r *readiness) stop() {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.stopped = true
	r.notifier.SetNotReady()
}

// NewLogger returns the JSON logger the operators write to stdout, at the
// level set by [operator] log_level (debug, info, warn or error; default debug).
func NewLogger(cfg *setting.Cfg, name string) logging.Logger {
	level := slog.LevelDebug
	if cfg != nil {
		raw := cfg.SectionWithEnvOverrides("operator").Key("log_level").MustString("debug")
		if err := level.UnmarshalText([]byte(strings.ToLower(raw))); err != nil {
			level = slog.LevelDebug
		}
	}
	return logging.NewSLogLogger(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level})).With("logger", name)
}

// NewSubscriber returns the operator's NATS subscriber. Operators run against an
// external NATS, so a nil server yields a config that dials the configured
// client URLs. Create it once per process: it registers metrics on reg.
func NewSubscriber(cfg *setting.Cfg, reg prometheus.Registerer) *nats.SubscriberService {
	return nats.ProvideSubscriber(nats.ProvideNATSConfig(cfg, nil), reg)
}

// AwaitShutdown waits for the operator's goroutines to finish, giving up after
// timeout so a stuck goroutine cannot block the process from exiting.
func AwaitShutdown(logger logging.Logger, wg *sync.WaitGroup, timeout time.Duration) {
	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		logger.Info("operator shutdown complete")
	case <-time.After(timeout):
		logger.Warn("shutdown timeout exceeded, forcing exit", "timeout", timeout)
	}
}
