package jobs

import (
	"context"
	"errors"
	"fmt"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/apifmt"
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
	StrictMaxErrors(maxErrors int)
	SetRefURLs(ctx context.Context, refURLs *provisioning.RepositoryURLs)
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

var _ Queue = (*unifiedStorageQueue)(nil)

// unifiedStorageQueue is a job queue implementation that uses unified storage (rest.Storage)
// for job insertion operations. This maintains the existing behavior for job creation.
type unifiedStorageQueue struct {
	jobStore rest.Storage

	// clock is a function that returns the current time.
	clock func() time.Time
}

// NewUnifiedStorageQueue creates a new job queue implementation using unified storage.
// This handles Queue operations (Insert) using the existing rest.Storage approach.
func NewUnifiedStorageQueue(jobStore rest.Storage) *unifiedStorageQueue {
	return &unifiedStorageQueue{
		jobStore: jobStore,
		clock:    time.Now,
	}
}

func (s *unifiedStorageQueue) Insert(ctx context.Context, namespace string, spec provisioning.JobSpec) (*provisioning.Job, error) {
	if spec.Repository == "" {
		return nil, errors.New("missing repository in job")
	}

	job := &provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: namespace,
			Labels: map[string]string{
				LabelRepository: spec.Repository,
			},
		},
		Spec: spec,
	}
	if err := mutateJobAction(job); err != nil {
		return nil, err
	}
	generateJobName(job) // Side-effect: updates the job's name.

	ctx = request.WithNamespace(ctx, job.GetNamespace())
	obj, err := s.jobStore.Create(ctx, job, nil, &metav1.CreateOptions{})
	if apierrors.IsAlreadyExists(err) {
		return nil, apifmt.Errorf("job '%s' in '%s' already exists: %w", job.GetName(), job.GetNamespace(), err)
	}
	if err != nil {
		return nil, apifmt.Errorf("failed to create job '%s' in '%s': %w", job.GetName(), job.GetNamespace(), err)
	}

	created, ok := obj.(*provisioning.Job)
	if !ok {
		return nil, apifmt.Errorf("unexpected object type %T", obj)
	}

	return created, nil
}

// generateJobName creates and updates the job's name to one that fits it.
func generateJobName(job *provisioning.Job) {
	switch job.Spec.Action {
	case provisioning.JobActionMigrate, provisioning.JobActionPull:
		// Pull and migrate jobs should never run at the same time. Hence, the name encapsulates them both (and the spec differentiates them).
		job.Name = job.Spec.Repository + "-sync"
	case provisioning.JobActionPullRequest:
		var pr int
		if job.Spec.PullRequest != nil {
			pr = job.Spec.PullRequest.PR
		}
		// There may be multiple pull requests at the same time. They need different names.
		job.Name = fmt.Sprintf("%s-pr-%d", job.Spec.Repository, pr)
	default:
		job.Name = fmt.Sprintf("%s-%s", job.Spec.Repository, job.Spec.Action)
	}
}

func mutateJobAction(job *provisioning.Job) error {
	kinds := map[provisioning.JobAction]any{}
	spec := job.Spec
	if spec.Migrate != nil {
		job.Spec.Action = provisioning.JobActionMigrate
		kinds[provisioning.JobActionMigrate] = spec.Migrate
	}
	if spec.Pull != nil {
		job.Spec.Action = provisioning.JobActionPull
		kinds[provisioning.JobActionPull] = spec.Pull
	}
	if spec.Push != nil {
		job.Spec.Action = provisioning.JobActionPush
		kinds[provisioning.JobActionPush] = spec.Push
	}
	if spec.PullRequest != nil {
		job.Spec.Action = provisioning.JobActionPullRequest
		kinds[provisioning.JobActionPullRequest] = spec.PullRequest
	}
	if len(kinds) > 1 {
		return apierrors.NewBadRequest("multiple job types found")
	}
	return nil
}
