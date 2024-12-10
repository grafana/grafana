package jobs

import (
	"context"

	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apiserver/pkg/registry/rest"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
)

var (
	_ JobQueue = (*jobStore)(nil)
)

// Basic job queue infrastructure
type JobQueue interface {
	rest.Storage // temporary.. simplifies registration

	Add(ctx context.Context, job *provisioning.Job) (*provisioning.Job, error)
	Checkout(ctx context.Context, query labels.Selector) *provisioning.Job
	Complete(ctx context.Context, namespace string, name string, status provisioning.JobStatus) error

	// Register a worker (inline for now)
	Register(worker Worker)
}

type Worker interface {
	// This worker can handle this kind of job
	// NOTE: we can/should likely replace with controller pattern... but this is an easy 1st step
	Supports(ctx context.Context, job *provisioning.Job) bool

	// Process a single job
	Process(ctx context.Context, job provisioning.Job) (*provisioning.JobStatus, error)
}
