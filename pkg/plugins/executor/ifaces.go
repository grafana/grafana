package executor

import (
	"context"
	"time"
)

type Service interface {
	// Execute executes some workload
	Execute(ctx context.Context) error
}

type Job interface {
	Enabled(ctx context.Context) bool
	ExecInterval() time.Duration
	ExecTimeout() time.Duration
	Exec(ctx context.Context) error
}

type JobProvider interface {
	ProvideJobs(ctx context.Context) []Job
}
