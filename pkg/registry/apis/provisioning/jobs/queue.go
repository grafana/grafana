package jobs

import (
	"context"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

type RepoGetter interface {
	GetRepository(ctx context.Context, name string) (repository.Repository, error)
}

// Basic job queue infrastructure
type JobQueue interface {
	// Add a new Job to the Queue.  The status must be empty
	Add(ctx context.Context, job *provisioning.Job) (*provisioning.Job, error)

	// Get the next job we should process
	Next(ctx context.Context) *provisioning.Job

	// Update the status on a given job
	// This is only valid if current job is not finished
	Update(ctx context.Context, namespace string, name string, status provisioning.JobStatus) error

	// Register a worker (inline for now)
	Register(worker Worker)
}

type JobProgressRecorder interface {
	Record(ctx context.Context, result JobResourceResult)
	SetMessage(msg string)
	GetMessage() string
	SetRef(ref string)
	GetRef() string
	SetTotal(total int)
	TooManyErrors() error
	Complete(ctx context.Context, err error) provisioning.JobStatus
}

type Worker interface {
	IsSupported(ctx context.Context, job provisioning.Job) bool
	Process(ctx context.Context, repo repository.Repository, job provisioning.Job, progress JobProgressRecorder) error
}

// ProgressFn is a function that can be called to update the progress of a job
type ProgressFn func(ctx context.Context, status provisioning.JobStatus) error
