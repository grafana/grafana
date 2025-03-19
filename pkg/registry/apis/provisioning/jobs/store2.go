package jobs

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/apifmt"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/apiserver/pkg/registry/rest"
)

const (
	// LabelJobClaim includes the timestamp when the job was claimed.
	// The label must be formatted as milliseconds from Epoch. This grants a natural ordering, allowing for less-than operators in label selectors.
	// The natural ordering would be broken if the number rolls over into 1 more digit. This won't happen before Nov, 2286.
	LabelJobClaim        = "provisioning.grafana.app/claim"
	LabelJobOriginalName = "provisioning.grafana.app/original-name"
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

type Queue interface {
	// Insert adds a new job to the queue.
	//
	// This saves it if it is a new job, or fails with ErrJobAlreadyExists if one with the same name already exists.
	Insert(ctx context.Context, job *provisioning.Job) (*provisioning.Job, error)
}

var _ Queue = (*store2)(nil)

type jobStorage interface {
	rest.Creater
	rest.Lister
	rest.Patcher
	rest.GracefulDeleter
}

// store2 is a job queue abstraction.
// It calls out to a real storage implementation to store the jobs, and a separate storage for historic jobs that have been completed.
// When store2 claims a job, it will update the status of it. This does a ResourceVersion check to ensure it is atomic; if the job has been claimed by another worker, the claim will fail.
// When a job is completed, it is moved to the historic job store by first deleting it from the job store and then creating it in the historic job store. We are fine with the job being lost if the historic job store fails to create it.
type store2 struct {
	jobStore               jobStorage
	jobStatusStore         rest.Updater
	historicJobStore       rest.Creater
	historicJobStatusStore rest.Updater

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

func NewStore2(
	jobStore jobStorage, jobStatusStore rest.Updater,
	historicJobStore rest.Creater, historicJobStatusStore rest.Updater,
	expiry time.Duration,
) (*store2, error) {
	if expiry <= 0 {
		expiry = time.Second * 30
	}

	return &store2{
		jobStore:               jobStore,
		jobStatusStore:         jobStatusStore,
		historicJobStore:       historicJobStore,
		historicJobStatusStore: historicJobStatusStore,

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
func (s *store2) Claim(ctx context.Context) (job *provisioning.Job, rollback func(context.Context), err error) {
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

		// TODO: Assumption: the resource version will be updated for us here.
		// TODO: Assumption: Unified Storage has properly implemented resource versions.
		updated, _, err := s.jobStore.Update(ctx,
			job.GetName(),                       // name
			rest.DefaultUpdatedObjectInfo(&job), // objInfo
			failCreation,                        // createValidation
			nil,                                 // updateValidation
			false,                               // forceAllowCreate
			&metav1.UpdateOptions{},             // options
		)
		if apierrors.IsConflict(err) || // TODO: Assumption: Unified Storage has properly implemented conflicts on updates.
			errors.Is(err, errWouldCreate) {
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

		return updatedJob.DeepCopy(), func(ctx context.Context) {
			// Rolling back does not need to care about the parent's cancellation state.
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
			delete(refetchedJob.Labels, LabelJobClaim)

			// TODO: Assumption: the resource version will be updated for us here.
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
				return
			} else if err != nil {
				logger.Debug("failed to roll back job claim; got an OK error", "error", err)
				return
			}

			// As the claim was rolled back, we should also set the status back to pending.
			refetchedJob.Status.State = provisioning.JobStatePending
			timeoutCtx, cancel = context.WithTimeout(ctx, 5*time.Second)
			_, _, err = s.jobStatusStore.Update(timeoutCtx,
				refetchedJob.GetName(),                      // name
				rest.DefaultUpdatedObjectInfo(refetchedJob), // objInfo
				failCreation,            // createValidation
				nil,                     // updateValidation
				false,                   // forceAllowCreate
				&metav1.UpdateOptions{}, // options
			)
			cancel() // we have no response body to read (the obj already contains all of it), so just cancel immediately
			if err != nil && !apierrors.IsConflict(err) && !errors.Is(err, errWouldCreate) {
				logger.Warn("failed to set status to pending; letting periodic cleaner deal with it", "error", err)
			}
		}, nil
	}

	// We failed to claim any jobs.
	return nil, nil, ErrNoJobs
}

// Update saves the job back to the store.
func (s *store2) UpdateStatus(ctx context.Context, job *provisioning.Job) error {
	_, _, err := s.jobStatusStore.Update(ctx,
		job.GetName(),                      // name
		rest.DefaultUpdatedObjectInfo(job), // objInfo
		failCreation,                       // createValidation
		nil,                                // updateValidation
		false,                              // forceAllowCreate
		&metav1.UpdateOptions{},            // options
	)
	if err != nil {
		return apifmt.Errorf("failed to update job '%s' in '%s': %w", job.GetName(), job.GetNamespace(), err)
	}
	return nil
}

// Complete marks a job as completed and moves it to the historic job store.
// When in the historic store, there is no more claim on the job.
func (s *store2) Complete(ctx context.Context, job *provisioning.Job) error {
	// We need to delete the job from the job store and create it in the historic job store.
	// We are fine with the job being lost if the historic job store fails to create it.
	//
	// We will assume that the caller is the claimant. If this is not true, an error is returned.
	// This is a best-effort operation; if the job is not in the claimed state, we will still attempt to move it to the historic job store.
	_, _, err := s.jobStore.Delete(ctx, job.GetName(), nil, &metav1.DeleteOptions{})
	if err != nil {
		return apifmt.Errorf("failed to delete job '%s' in '%s': %w", job.GetName(), job.GetNamespace(), err)
	}

	// We need to remove the claim label before moving the job to the historic job store.
	if job.Labels == nil {
		job.Labels = make(map[string]string)
	}
	delete(job.Labels, LabelJobClaim)
	// We also need a new, unique name.
	job.Labels[LabelJobOriginalName] = job.GetName()
	job.GenerateName = job.Name + "-"
	job.Name = ""
	// We also reset the UID as this is not the same object.
	job.ObjectMeta.UID = ""
	// We aren't allowed to write with ResourceVersion set.
	job.ResourceVersion = ""

	historicJob := &provisioning.HistoricJob{
		ObjectMeta: job.ObjectMeta,
		Spec:       job.Spec,
		Status:     job.Status,
	}
	historic, err := s.historicJobStore.Create(ctx, historicJob, nil, &metav1.CreateOptions{})
	if err != nil {
		// We're not going to return this as it is not critical. Not ideal, but not critical.
		logging.FromContext(ctx).Warn("failed to create historic job", "historic_job", *historicJob, "error", err)
		return nil
	}
	if hj, ok := historic.(*provisioning.HistoricJob); ok {
		hj.Status = job.Status
		_, _, err = s.historicJobStatusStore.Update(ctx,
			hj.GetName(),                      // name
			rest.DefaultUpdatedObjectInfo(hj), // objInfo
			failCreation,                      // createValidation
			nil,                               // updateValidation
			false,                             // forceAllowCreate
			&metav1.UpdateOptions{},           // options
		)
		if err != nil {
			// We're not going to return this as it is not critical. Not ideal, but not critical.
			logging.FromContext(ctx).Warn("failed to update historic job status", "historic_job", *hj, "error", err)
		}
	}

	return nil
}

// Cleanup should be called periodically to clean up abandoned jobs.
// An abandoned job is one that has been claimed by a worker, but the worker has not updated the job in a while.
func (s *store2) Cleanup(ctx context.Context) error {
	if err := s.cleanupClaims(ctx); err != nil {
		return apifmt.Errorf("failed to clean up claims: %w", err)
	}

	return nil
}

// cleanupClaims will clean up abandoned claims.
// Any claim that is older than the expiry time will have their claims removed.
//
// This is only necessary because Kubernetes does not support logical OR in label selectors.
func (s *store2) cleanupClaims(ctx context.Context) error {
	// We will list all jobs that have been claimed but not updated in a while.
	// We will then remove the claim from them.
	// We will not care about the result of the update, as the job may have been completed in the meantime.
	expiry := s.clock().Add(-s.expiry).UnixMilli()
	requirement, err := labels.NewRequirement(LabelJobClaim, selection.LessThan, []string{strconv.FormatInt(expiry, 10)})
	if err != nil {
		return apifmt.Errorf("could not create requirement: %w", err)
	}

	timeoutCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	jobsObj, err := s.jobStore.List(timeoutCtx, &internalversion.ListOptions{
		LabelSelector: labels.NewSelector().Add(*requirement),
		// We don't need to clean up everything all the time. Just do enough such that we have a fair amount of work.
		Limit: 100,
	})
	cancel() // by the time we have the list, there is no response body to read, so just cancel immediately
	if err != nil {
		return apifmt.Errorf("failed to list jobs: %w", err)
	}
	jobs, ok := jobsObj.(*provisioning.JobList)
	if !ok {
		return apifmt.Errorf("unexpected object type %T", jobsObj)
	}

	for _, job := range jobs.Items {
		if job.Labels == nil {
			job.Labels = make(map[string]string)
		}
		delete(job.Labels, LabelJobClaim)
		job.Status.State = provisioning.JobStatePending

		// TODO: Assumption: the resource version will be updated for us here.
		// TODO: Assumption: Unified Storage has properly implemented resource versions.
		timeoutCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		_, _, err := s.jobStore.Update(timeoutCtx,
			job.GetName(),                       // name
			rest.DefaultUpdatedObjectInfo(&job), // objInfo
			failCreation,                        // createValidation
			nil,                                 // updateValidation
			false,                               // forceAllowCreate
			&metav1.UpdateOptions{},             // options
		)
		cancel()                        // we have no response body to read, so just cancel immediately
		if apierrors.IsConflict(err) || // TODO: Assumption: Unified Storage has properly implemented conflicts on updates.
			errors.Is(err, errWouldCreate) {
			continue
		}
		if err != nil {
			return apifmt.Errorf("failed to unclaim job '%s' in '%s': %w", job.GetName(), job.GetNamespace(), err)
		}
	}

	return nil
}

// Insert adds a new job to the queue.
//
// This saves it if it is a new job, or fails with ErrJobAlreadyExists if one with the same name already exists.
func (s *store2) Insert(ctx context.Context, job *provisioning.Job) (*provisioning.Job, error) {
	if job.GetName() == "" && job.GetGenerateName() == "" {
		// FIXME: This should be done before we call insert.
		job.Name = string(job.Spec.Action) + "-" + job.Spec.Repository
	}

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

func (s *store2) InsertNotifications() chan struct{} {
	return s.notifications
}
