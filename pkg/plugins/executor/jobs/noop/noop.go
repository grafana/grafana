package noop

import (
	"context"
	"time"
)

type Job struct{}

func New() *Job {
	return &Job{}
}

func (j *Job) Enabled(_ context.Context) bool {
	return false
}

func (j *Job) ExecInterval() time.Duration {
	return time.Nanosecond
}

func (j *Job) ExecTimeout() time.Duration {
	return time.Nanosecond
}

func (j *Job) Exec(_ context.Context) error {
	return nil
}
