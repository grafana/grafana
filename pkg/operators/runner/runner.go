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
	// Subscriber is the operator's NATS subscriber. The runner supervises it
	// when [nats] is enabled; use nats.Enabled to choose a delta source.
	Subscriber *nats.SubscriberService
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
	}
	if !op.NoNATS {
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
	defer func() {
		deps.HealthNotifier.SetNotReady()
		runErr = errors.Join(runErr, stop())
	}()
	if err != nil {
		return err
	}

	done := make(chan error, 1)
	go func() {
		done <- parts.Run(ctx, func() {
			rt.Logger.Info("operator is ready", "operator", op.Name)
			deps.HealthNotifier.SetReady()
		})
	}()

	select {
	case err := <-done:
		return err
	case <-ctx.Done():
	}
	deps.HealthNotifier.SetNotReady()
	rt.Logger.Info("operator shutting down", "operator", op.Name)
	if parts.ShutdownTimeout <= 0 {
		return <-done
	}
	select {
	case err := <-done:
		return err
	case <-time.After(parts.ShutdownTimeout):
		rt.Logger.Warn("shutdown timeout exceeded, forcing exit", "timeout", parts.ShutdownTimeout)
		return nil
	}
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
