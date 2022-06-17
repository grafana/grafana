package executor

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
)

var _ Service = (*ExecuteRunner)(nil)

type ExecuteRunner struct {
	executorProvider JobProvider

	log log.Logger
}

type runnerTick struct {
	ticker    *time.Ticker
	executing bool
}

func ProvideExecuteRunner(executorProvider JobProvider) *ExecuteRunner {
	return New(executorProvider)
}

func New(executorProvider JobProvider) *ExecuteRunner {
	return &ExecuteRunner{
		executorProvider: executorProvider,
		log:              log.New("plugin.job.executor"),
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
	for _, job := range r.executorProvider.ProvideJobs(ctx) {
		err := r.exec(ctx, job)
		if err != nil {
			return err
		}
	}
	return nil
}

func (r *ExecuteRunner) exec(ctx context.Context, job Job) error {
	ctxWithTimeout, cancelFn := context.WithTimeout(ctx, job.ExecTimeout())
	defer cancelFn()

	tick := runnerTick{ticker: time.NewTicker(job.ExecInterval())}
	for {
		select {
		case <-tick.ticker.C:
			if tick.executing {
				r.log.Debug("Executor is still executing a previous tick. Skipping this execution...")
				continue
			}
			tick.executing = true
			r.log.Debug("Executor is executing")
			if err := job.Exec(ctxWithTimeout); err != nil {
				r.log.Error("error during execution", "err", err)
			}
			tick.executing = false
		case <-ctx.Done():
			tick.ticker.Stop()
			return nil
		}
	}
}
