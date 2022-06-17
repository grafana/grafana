package executor

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
)

var _ Service = (*ExecuteRunner)(nil)

type ExecuteRunner struct {
	tick tick
	job  Job

	log log.Logger
}

type tick struct {
	ticker    *time.Ticker
	executing bool
}

func ProvideExecuteRunner(job Job) *ExecuteRunner {
	return New(job, job.ExecInterval())
}

func New(job Job, tickInterval time.Duration) *ExecuteRunner {
	return &ExecuteRunner{
		job:  job,
		tick: tick{ticker: time.NewTicker(tickInterval)},
		log:  log.New("plugin.job.executor"),
	}
}

func (r *ExecuteRunner) Run(ctx context.Context) error {
	go func() {
		if err := r.Execute(ctx); err != nil {
			r.log.Error("Executor failure", "err", err)
		}
	}()
	<-ctx.Done()
	return ctx.Err()
}

func (r *ExecuteRunner) Execute(ctx context.Context) error {
	for {
		select {
		case <-r.tick.ticker.C:
			if r.tick.executing {
				r.log.Debug("Executor is still executing a previous tick. Skipping this execution...")
				continue
			}
			r.tick.executing = true
			r.log.Debug("Executor is executing")
			ctxWithTimeout, cancelFn := context.WithTimeout(ctx, r.job.ExecTimeout())
			defer cancelFn()
			if err := r.job.Exec(ctxWithTimeout); err != nil {
				r.log.Error("error during execution", "err", err)
			}
			r.tick.executing = false
		case <-ctx.Done():
			r.tick.ticker.Stop()
			return nil
		}
	}
}
