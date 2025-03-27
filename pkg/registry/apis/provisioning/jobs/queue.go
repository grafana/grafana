package jobs

import (
	"context"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

type RepoGetter interface {
	GetRepository(ctx context.Context, name string) (repository.Repository, error)
}

type JobProgressRecorder interface {
	Record(ctx context.Context, result JobResourceResult)
	ResetResults()
	SetFinalMessage(ctx context.Context, msg string)
	SetMessage(ctx context.Context, msg string)
	SetRef(ref string)
	GetRef() string
	SetTotal(ctx context.Context, total int)
	TooManyErrors() error
	Complete(ctx context.Context, err error) provisioning.JobStatus
}

type Worker interface {
	IsSupported(ctx context.Context, job provisioning.Job) bool
	// Process the job. The job status should be updated as the job progresses.
	//
	// The job spec and metadata MUST not be modified in the storage layer while this is running. All updates go via the progress type.
	Process(ctx context.Context, repo repository.Repository, job provisioning.Job, progress JobProgressRecorder) error
}

// ProgressFn is a function that can be called to update the progress of a job
type ProgressFn func(ctx context.Context, status provisioning.JobStatus) error
