package jobs

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/apifmt"
)

const (
	// LabelJobClaim includes the timestamp when the job was claimed.
	// The label must be formatted as milliseconds from Epoch. This grants a natural ordering, allowing for less-than operators in label selectors.
	// The natural ordering would be broken if the number rolls over into 1 more digit. This won't happen before Nov, 2286.
	LabelJobClaim = "provisioning.grafana.app/claim"
	// LabelRepository contains the repository name as a label. This allows for label selectors to find the archived version of a job.
	LabelRepository = "provisioning.grafana.app/repository"
)

var (
	ErrNoJobs = &apierrors.StatusError{
		ErrStatus: metav1.Status{
			Status:  metav1.StatusFailure,
			Reason:  metav1.StatusReasonConflict,
			Message: "no jobs are available to claim, try again later",
			Code:    http.StatusNoContent,
			Details: &metav1.StatusDetails{
				Group:             provisioning.GROUP,
				Kind:              provisioning.JobResourceInfo.GetName(),
				RetryAfterSeconds: 3,
			},
		},
	}

	errWouldCreate                         = errors.New("this call would have created a new resource; it is rejected")
	failCreation   rest.ValidateObjectFunc = func(_ context.Context, _ runtime.Object) error {
		return errWouldCreate
	}
)

// Queue is a job queue abstraction.
//
//go:generate mockery --name Queue --structname MockQueue --inpackage --filename queue_mock.go --with-expecter
type Queue interface {
	// Insert adds a new job to the queue.
	//
	// The job name is not honoured. It will be overwritten with a name that fits the job.
	//
	// This saves it if it is a new job, or fails with `apierrors.IsAlreadyExists(err) == true` if one already exists.
	Insert(ctx context.Context, namespace string, spec provisioning.JobSpec) (*provisioning.Job, error)
}

var _ Queue = (*persistentStore)(nil)

type jobStorage interface {
	rest.Creater
	rest.Lister
	rest.Patcher
	rest.GracefulDeleter
}

// persistentStore is a job queue abstraction.
// It calls out to a real storage implementation to store the jobs, and a separate storage for historic jobs that have been completed.
// When persistentStore claims a job, it will update the status of it. This does a ResourceVersion check to ensure it is atomic; if the job has been claimed by another worker, the claim will fail.
// When a job is completed, it is moved to the historic job store by first deleting it from the job store and then creating it in the historic job store. We are fine with the job being lost if the historic job store fails to create it.
type persistentStore struct {
	jobStore jobStorage

	// clock is a function that returns the current time.
	clock func() time.Time

	// expiry is the time after which a job is considered abandoned.
	// If a job is abandoned, it will have its claim cleaned up periodically.
	expiry time.Duration

	// notifications has a signal sent to it when a new job is inserted. If a value already exists, nothing is sent.
	//
	// This is very similar to the concept of a Waker in Rust: <https://doc.rust-lang.org/std/task/struct.Waker.html>
	notifications chan struct{}
}

func NewJobStore(
	jobStore jobStorage,
	expiry time.Duration,
) (*persistentStore, error) {
	if expiry <= 0 {
		expiry = time.Second * 30
	}

	return &persistentStore{
		jobStore: jobStore,

		clock:  time.Now,
		expiry: expiry,

		notifications: make(chan struct{}, 1),
	}, nil
}

// Claim takes a job from storage, marks it as ours, and returns it.
//
// Any job which has not been claimed by another worker is fair game.
//
// If err is not nil, the job and rollback values are always nil.
// The err may be ErrNoJobs if there are no jobs to claim.
func (s *persistentStore) Claim(ctx context.Context) (job *provisioning.Job, rollback func(), err error) {
	requirement, err := labels.NewRequirement(LabelJobClaim, selection.DoesNotExist, nil)
	if err != nil {
		return nil, nil, apifmt.Errorf("could not create requirement: %w", err)
	}

	jobsObj, err := s.jobStore.List(ctx, &internalversion.ListOptions{
		LabelSelector: labels.NewSelector().Add(*requirement),
		Limit:         16,
	})
	if err != nil {
		return nil, nil, apifmt.Errorf("failed to list jobs: %w", err)
	}
	jobs, ok := jobsObj.(*provisioning.JobList)
	if !ok {
		return nil, nil, apifmt.Errorf("unexpected object type %T", jobsObj)
	}

	if len(jobs.Items) == 0 {
		return nil, nil, ErrNoJobs
	}

	for _, job := range jobs.Items {
		if job.Labels == nil {
			job.Labels = make(map[string]string)
		}
		job.Labels[LabelJobClaim] = strconv.FormatInt(s.clock().UnixMilli(), 10)

		// We list jobs from all namespaces. So when we want to update a specific job, we also need its namespace in the context.
		ctx := request.WithNamespace(ctx, job.GetNamespace())
		// Likewise, we should use the provisioning identity now that we have the namespace we are operating within.
		ctx, _, err = identity.WithProvisioningIdentity(ctx, job.GetNamespace())
		if err != nil {
			// This should never happen, as it is already a valid namespace from the job existing... but better be safe.
			return nil, nil, apifmt.Errorf("failed to get provisioning identity for '%s': %w", job.GetNamespace(), err)
		}

		// This relies on the resource version being updated for us.
		// If the resource version we pass in via the current job is not the same as the one currently in the store, it will fail with Conflict.
		// This is the desired behavior, as it ensures that claims are atomic.
		updated, _, err := s.jobStore.Update(ctx,
			job.GetName(),                       // name
			rest.DefaultUpdatedObjectInfo(&job), // objInfo
			failCreation,                        // createValidation
			nil,                                 // updateValidation
			false,                               // forceAllowCreate
			&metav1.UpdateOptions{},             // options
		)
		if apierrors.IsConflict(err) || errors.Is(err, errWouldCreate) {
			// On conflict: another worker claimed the job before us.
			// On would create: the job was completed and deleted before we could claim it.
			// We'll just move on to the next job.
			continue
		}
		if err != nil {
			return nil, nil, apifmt.Errorf("failed to claim job '%s' in '%s': %w", job.GetName(), job.GetNamespace(), err)
		}
		updatedJob, ok := updated.(*provisioning.Job)
		if !ok {
			return nil, nil, apifmt.Errorf("unexpected object type %T", updated)
		}

		return updatedJob.DeepCopy(), func() {
			// Rolling back does not need to care about the parent's cancellation state.
			// This will also use the parent context (i.e. from the for loop!), ensuring we have permissions to do this.
			ctx = context.WithoutCancel(ctx)

			logger := logging.FromContext(ctx).With("namespace", updatedJob.GetNamespace(), "job", updatedJob.GetName())

			timeoutCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
			refetched, err := s.jobStore.Get(timeoutCtx, updatedJob.GetName(), &metav1.GetOptions{})
			cancel() // we have no response body to read (the obj already contains all of it), so just cancel immediately
			if apierrors.IsNotFound(err) {
				// The job was probably completed already. Nothing to roll back!
				return
			} else if err != nil {
				// We failed. Nothing much we can do but let the job be cleaned up by the periodic cleaner.
				logger.Warn("failed to roll back job claim; letting periodic cleaner deal with it", "error", err)
				return
			}
			refetchedJob, ok := refetched.(*provisioning.Job)
			if !ok {
				logger.Warn("failed to roll back job claim: the job we got is not a *provisioning.Job?", "got", refetched)
				return
			}

			// Rollback the claim.
			refetchedJob = refetchedJob.DeepCopy()
			delete(refetchedJob.Labels, LabelJobClaim)
			refetchedJob.Status.State = provisioning.JobStatePending

			timeoutCtx, cancel = context.WithTimeout(ctx, 5*time.Second)
			_, _, err = s.jobStore.Update(timeoutCtx,
				refetchedJob.GetName(),                      // name
				rest.DefaultUpdatedObjectInfo(refetchedJob), // objInfo
				failCreation,            // createValidation
				nil,                     // updateValidation
				false,                   // forceAllowCreate
				&metav1.UpdateOptions{}, // options
			)
			cancel() // we have no response body to read (the obj already contains all of it), so just cancel immediately
			if err != nil && !apierrors.IsConflict(err) && !errors.Is(err, errWouldCreate) {
				logger.Warn("failed to roll back job claim; letting periodic cleaner deal with it", "error", err)
			} else if err != nil {
				logger.Debug("failed to roll back job claim; got an OK error", "error", err)
			}
		}, nil
	}

	// We failed to claim any jobs.
	return nil, nil, ErrNoJobs
}

// Update saves the job back to the store.
func (s *persistentStore) Update(ctx context.Context, job *provisioning.Job) (*provisioning.Job, error) {
	obj, _, err := s.jobStore.Update(ctx,
		job.GetName(),                      // name
		rest.DefaultUpdatedObjectInfo(job), // objInfo
		failCreation,                       // createValidation
		nil,                                // updateValidation
		false,                              // forceAllowCreate
		&metav1.UpdateOptions{},            // options
	)
	if err != nil {
		return nil, apifmt.Errorf("failed to update job '%s' in '%s': %w", job.GetName(), job.GetNamespace(), err)
	}

	updatedJob, ok := obj.(*provisioning.Job)
	if !ok {
		return nil, apifmt.Errorf("unexpected object type %T", obj)
	}

	return updatedJob, nil
}

// Get retrieves a job by name for conflict resolution.
func (s *persistentStore) Get(ctx context.Context, name string) (*provisioning.Job, error) {
	obj, err := s.jobStore.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		if apierrors.IsNotFound(err) {
			return nil, apifmt.Errorf("job '%s' not found", name)
		}
		return nil, apifmt.Errorf("failed to get job '%s': %w", name, err)
	}

	job, ok := obj.(*provisioning.Job)
	if !ok {
		return nil, apifmt.Errorf("unexpected object type %T", obj)
	}

	return job, nil
}

// Complete marks a job as completed and moves it to the historic job store.
// When in the historic store, there is no more claim on the job.
func (s *persistentStore) Complete(ctx context.Context, job *provisioning.Job) error {
	logger := logging.FromContext(ctx).With("namespace", job.GetNamespace(), "job", job.GetName())

	// We need to delete the job from the job store and create it in the historic job store.
	// We are fine with the job being lost if the historic job store fails to create it.
	//
	// We will assume that the caller is the claimant. If this is not true, an error is returned.
	// This is a best-effort operation; if the job is not in the claimed state, we will still attempt to move it to the historic job store.
	_, _, err := s.jobStore.Delete(ctx, job.GetName(), nil, &metav1.DeleteOptions{})
	if err != nil {
		return apifmt.Errorf("failed to delete job '%s' in '%s': %w", job.GetName(), job.GetNamespace(), err)
	}
	logger.Debug("deleted job from job store")

	// We need to remove the claim label before moving the job to the historic job store.
	if job.Labels == nil {
		job.Labels = make(map[string]string)
	}
	delete(job.Labels, LabelJobClaim)

	logger.Debug("job completion done")
	return nil
}

// RenewLease renews the lease for a claimed job, extending its expiry time.
// Returns an error if the lease cannot be renewed (e.g., job was completed or lease expired).
func (s *persistentStore) RenewLease(ctx context.Context, job *provisioning.Job) error {
	if job.Labels == nil || job.Labels[LabelJobClaim] == "" {
		return apifmt.Errorf("job '%s' in '%s' is not claimed", job.GetName(), job.GetNamespace())
	}

	// Fetch the latest version to avoid conflicts
	latestObj, err := s.jobStore.Get(ctx, job.GetName(), &metav1.GetOptions{})
	if err != nil {
		if apierrors.IsNotFound(err) {
			return apifmt.Errorf("failed to renew lease for job '%s' in '%s': job no longer exists", job.GetName(), job.GetNamespace())
		}
		return apifmt.Errorf("failed to fetch job for lease renewal '%s' in '%s': %w", job.GetName(), job.GetNamespace(), err)
	}

	latestJob, ok := latestObj.(*provisioning.Job)
	if !ok {
		return apifmt.Errorf("unexpected object type %T", latestObj)
	}

	// Verify we still own the lease
	if latestJob.Labels == nil || latestJob.Labels[LabelJobClaim] == "" {
		return apifmt.Errorf("lease lost for job '%s' in '%s': no longer claimed", job.GetName(), job.GetNamespace())
	}

	// Update the claim timestamp to current time
	updatedJob := latestJob.DeepCopy()
	updatedJob.Labels[LabelJobClaim] = strconv.FormatInt(s.clock().UnixMilli(), 10)

	// Update the job in storage with the latest resource version
	_, _, err = s.jobStore.Update(ctx,
		updatedJob.GetName(),                      // name
		rest.DefaultUpdatedObjectInfo(updatedJob), // objInfo
		failCreation,                              // createValidation
		nil,                                       // updateValidation
		false,                                     // forceAllowCreate
		&metav1.UpdateOptions{},                   // options
	)
	if apierrors.IsConflict(err) {
		return apifmt.Errorf("failed to renew lease for job '%s' in '%s': lease conflict", job.GetName(), job.GetNamespace())
	}
	if apierrors.IsNotFound(err) || errors.Is(err, errWouldCreate) {
		return apifmt.Errorf("failed to renew lease for job '%s' in '%s': job no longer exists", job.GetName(), job.GetNamespace())
	}
	if err != nil {
		return apifmt.Errorf("failed to renew lease for job '%s' in '%s': %w", job.GetName(), job.GetNamespace(), err)
	}

	// Update the job's claim timestamp and resource version in memory
	job.Labels[LabelJobClaim] = updatedJob.Labels[LabelJobClaim]
	job.ResourceVersion = updatedJob.ResourceVersion
	return nil
}

// Cleanup finds jobs with expired leases and marks them as failed.
// This replaces the old cleanup mechanism and should be called more frequently.
func (s *persistentStore) Cleanup(ctx context.Context) error {
	// Set up provisioning identity to access jobs across all namespaces
	ctx, _, err := identity.WithProvisioningIdentity(ctx, "*") // "*" grants access to all namespaces
	if err != nil {
		return apifmt.Errorf("failed to grant provisioning identity for cleanup: %w", err)
	}

	// Find jobs with expired leases (older than expiry time)
	expiry := s.clock().Add(-s.expiry).UnixMilli()
	requirement, err := labels.NewRequirement(LabelJobClaim, selection.LessThan, []string{strconv.FormatInt(expiry, 10)})
	if err != nil {
		return apifmt.Errorf("could not create requirement: %w", err)
	}

	timeoutCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	jobsObj, err := s.jobStore.List(timeoutCtx, &internalversion.ListOptions{
		LabelSelector: labels.NewSelector().Add(*requirement),
		Limit:         100, // Process in batches
	})
	cancel()
	if err != nil {
		return apifmt.Errorf("failed to list jobs with expired leases: %w", err)
	}
	jobs, ok := jobsObj.(*provisioning.JobList)
	if !ok {
		return apifmt.Errorf("unexpected object type %T", jobsObj)
	}

	// If no jobs found, cleanup is complete
	if len(jobs.Items) == 0 {
		return nil
	}

	for _, job := range jobs.Items {
		// Mark job as failed due to lease expiry and archive it
		job := job.DeepCopy()
		job.Status.State = provisioning.JobStateError
		job.Status.Message = "Job failed due to lease expiry - worker may have crashed or lost connection"

		// Set namespace context for the completion
		ctx := request.WithNamespace(ctx, job.GetNamespace())
		ctx, _, err = identity.WithProvisioningIdentity(ctx, job.GetNamespace())
		if err != nil {
			return apifmt.Errorf("failed to get provisioning identity for '%s': %w", job.GetNamespace(), err)
		}

		// Use Complete to properly archive the failed job
		if err := s.Complete(ctx, job); err != nil {
			if apierrors.IsNotFound(err) {
				// Job was already completed/deleted by another process
				continue
			}
			return apifmt.Errorf("failed to complete expired job '%s' in '%s': %w", job.GetName(), job.GetNamespace(), err)
		}
	}

	return nil
}

func (s *persistentStore) Insert(ctx context.Context, namespace string, spec provisioning.JobSpec) (*provisioning.Job, error) {
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
	s.generateJobName(job) // Side-effect: updates the job's name.

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

	select {
	case s.notifications <- struct{}{}:
	default:
		// We don't want to block if there is already a notification waiting.
	}

	return created, nil
}

func (s *persistentStore) InsertNotifications() chan struct{} {
	return s.notifications
}

// generateJobName creates and updates the job's name to one that fits it.
func (s *persistentStore) generateJobName(job *provisioning.Job) {
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
