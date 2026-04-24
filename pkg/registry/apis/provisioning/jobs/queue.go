package jobs

import (
	"context"
	"fmt"
	"time"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

// RepoGetter is a function that can be called to get a repository by name
//
//go:generate mockery --name RepoGetter --structname MockRepoGetter --inpackage --filename repo_getter_mock.go --with-expecter
type RepoGetter interface {
	GetRepository(ctx context.Context, namespace, name string) (repository.Repository, error)
}

// JobProgressRecorder is a function that can be called to record the progress of a job
//
//go:generate mockery --name JobProgressRecorder --structname MockJobProgressRecorder --inpackage --filename job_progress_recorder_mock.go --with-expecter
type JobProgressRecorder interface {
	Started() time.Time
	Record(ctx context.Context, result JobResourceResult)
	ResetResults(keepWarnings bool)
	SetFinalMessage(ctx context.Context, msg string)
	SetMessage(ctx context.Context, msg string)
	SetTotal(ctx context.Context, total int)
	TooManyErrors() error
	StrictMaxErrors(maxErrors int)
	SetRefURLs(ctx context.Context, refURLs *provisioning.RepositoryURLs)
	Complete(ctx context.Context, err error) provisioning.JobStatus
	// ResultReasons returns the accumulated result reasons recorded during the job
	ResultReasons() []string
	// HasDirPathFailedCreation checks if a path has any folder creations that failed
	HasDirPathFailedCreation(path string) bool
	// HasDirPathFailedDeletion checks if a folderPath has any folder deletions that failed
	HasDirPathFailedDeletion(folderPath string) bool
	// HasChildPathFailedCreation checks if any folder creation failed inside folderPath
	HasChildPathFailedCreation(folderPath string) bool
	// HasChildPathFailedUpdate checks if any resource update failed inside folderPath
	HasChildPathFailedUpdate(folderPath string) bool
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

// IsOrphanCleanupAction returns true for job actions that operate on orphaned
// resources and do not require the target repository to exist.
func IsOrphanCleanupAction(action provisioning.JobAction) bool {
	return action == provisioning.JobActionReleaseResources ||
		action == provisioning.JobActionDeleteResources
}

// ValidateRepoForCleanup checks that the repository is still missing or
// terminating at the time the cleanup worker starts processing. The repo was
// validated at job creation time, but it may have been recreated while the
// job sat in the queue.
//   - repo == nil → repository was not found (expected, proceed)
//   - repo has DeletionTimestamp → repository is terminating (expected, proceed)
//   - repo exists and is healthy → repository was recreated (abort)
func ValidateRepoForCleanup(repo repository.Repository) error {
	if repo == nil {
		return nil
	}
	cfg := repo.Config()
	if cfg.DeletionTimestamp != nil && !cfg.DeletionTimestamp.IsZero() {
		return nil
	}
	return fmt.Errorf("repository %q was recreated since cleanup job was queued; aborting", cfg.Name)
}

// ProgressFn is a function that can be called to update the progress of a job
//
//go:generate mockery --name ProgressFn --structname MockProgressFn --inpackage --filename progress_fn_mock.go --with-expecter
type ProgressFn func(ctx context.Context, status provisioning.JobStatus) error
