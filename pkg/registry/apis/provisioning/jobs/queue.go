package jobs

import (
	"context"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

// RepoGetter is a function that can be called to get a repository by name
//
//go:generate mockery --name RepoGetter --structname MockRepoGetter --inpackage --filename repo_getter_mock.go --with-expecter
type RepoGetter interface {
	GetRepository(ctx context.Context, name string) (repository.Repository, error)
}

// JobProgressRecorder is a function that can be called to record the progress of a job
//
//go:generate mockery --name JobProgressRecorder --structname MockJobProgressRecorder --inpackage --filename job_progress_recorder_mock.go --with-expecter
type JobProgressRecorder interface {
	Record(ctx context.Context, result JobResourceResult)
	ResetResults()
	SetFinalMessage(ctx context.Context, msg string)
	SetMessage(ctx context.Context, msg string)
	SetTotal(ctx context.Context, total int)
	TooManyErrors() error
	Strict()
	Complete(ctx context.Context, err error) provisioning.JobStatus
}

// Worker is a worker that can process a job
//
//go:generate mockery --name Worker --structname MockWorker --inpackage --filename worker_mock.go --with-expecter
type Worker interface {
	IsSupported(ctx context.Context, job provisioning.Job) bool
	// Process the job. The job status should be updated as the job progresses.
	//
	// The job spec and metadata MUST not be modified in the storage layer while this is running. All updates go via the progress type.
	Process(ctx context.Context, repo repository.Repository, job provisioning.Job, progress JobProgressRecorder) error
}

// ProgressFn is a function that can be called to update the progress of a job
//
//go:generate mockery --name ProgressFn --structname MockProgressFn --inpackage --filename progress_fn_mock.go --with-expecter
type ProgressFn func(ctx context.Context, status provisioning.JobStatus) error
