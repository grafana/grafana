package jobs

import (
	"context"

	"k8s.io/apiserver/pkg/registry/rest"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
)

var (
	_ JobQueue = (*jobStore)(nil)
)

// Basic job queue infrastructure
type JobQueue interface {
	rest.Storage // temporary.. simplifies registration

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

type Worker interface {
	// Process a single job, can periodically make progress updates
	Process(ctx context.Context, job provisioning.Job, progress func(provisioning.JobStatus) error) (*provisioning.JobStatus, error)
}
