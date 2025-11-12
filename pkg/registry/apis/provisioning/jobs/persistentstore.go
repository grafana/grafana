package jobs

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"go.opentelemetry.io/otel/attribute"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/selection"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/apps/provisioning/pkg/apifmt"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	client "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/prometheus/client_golang/prometheus"
)

const (
	// LabelJobClaim includes the timestamp when the job was claimed.
	// The label must be formatted as milliseconds from Epoch. This grants a natural ordering, allowing for less-than operators in label selectors.
	// The natural ordering would be broken if the number rolls over into 1 more digit. This won't happen before Nov, 2286.
	LabelJobClaim = "provisioning.grafana.app/claim"
	// LabelRepository contains the repository name as a label. This allows for label selectors to find the archived version of a job.
	LabelRepository = "provisioning.grafana.app/repository"
	// LabelJobOriginalUID contains the Job's original uid as a label. This allows for label selectors to find the archived version of a job.
	LabelJobOriginalUID = "provisioning.grafana.app/original-uid"
)

var ErrNoJobs = &apierrors.StatusError{
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

var (
	_ Queue = (*persistentStore)(nil)
	_ Store = (*persistentStore)(nil)
)

// persistentStore is a job queue implementation that uses the API client instead of rest.Storage.
type persistentStore struct {
	client client.ProvisioningV0alpha1Interface

	// clock is a function that returns the current time.
	clock func() time.Time

	// expiry is the time after which a job is considered abandoned.
	// If a job is abandoned, it will have its claim cleaned up periodically.
	expiry time.Duration

	queueMetrics QueueMetrics
}

// NewJobStore creates a new job queue implementation using the API client.
func NewJobStore(provisioningClient client.ProvisioningV0alpha1Interface, expiry time.Duration, registry prometheus.Registerer) (*persistentStore, error) {
	if expiry <= 0 {
		expiry = time.Second * 30
	}

	queueMetrics := RegisterQueueMetrics(registry)

	return &persistentStore{
		client:       provisioningClient,
		clock:        time.Now,
		expiry:       expiry,
		queueMetrics: queueMetrics,
	}, nil
}

// Claim takes a job from storage, marks it as ours, and returns it.
//
// Any job which has not been claimed by another worker is fair game.
//
// If err is not nil, the job and rollback values are always nil.
// The err may be ErrNoJobs if there are no jobs to claim.
func (s *persistentStore) Claim(ctx context.Context) (job *provisioning.Job, rollback func(), err error) {
	ctx, span := tracing.Start(ctx, "provisioning.jobs.claim")
	defer func() {
		if err != nil && !errors.Is(err, ErrNoJobs) {
			span.RecordError(err)
		}
		span.End()
	}()

	logger := logging.FromContext(ctx).With("operation", "claim")

	requirement, err := labels.NewRequirement(LabelJobClaim, selection.DoesNotExist, nil)
	if err != nil {
		return nil, nil, apifmt.Errorf("could not create requirement: %w", err)
	}

	jobs, err := s.client.Jobs("").List(ctx, metav1.ListOptions{
		LabelSelector: labels.NewSelector().Add(*requirement).String(),
		Limit:         16,
	})
	if err != nil {
		return nil, nil, apifmt.Errorf("failed to list jobs: %w", err)
	}

	if len(jobs.Items) == 0 {
		logger.Debug("no jobs available to claim")
		return nil, nil, ErrNoJobs
	}

	logger.Debug("found jobs available", "count", len(jobs.Items))

	for _, job := range jobs.Items {
		if job.Labels == nil {
			job.Labels = make(map[string]string)
		}
		job.Labels[LabelJobClaim] = strconv.FormatInt(s.clock().UnixMilli(), 10)
		s.queueMetrics.RecordWaitTime(string(job.Spec.Action), s.clock().Sub(job.CreationTimestamp.Time).Seconds())

		// Set up the provisioning identity for this namespace
		ctx, _, err = identity.WithProvisioningIdentity(ctx, job.GetNamespace())
		if err != nil {
			// This should never happen, as it is already a valid namespace from the job existing... but better be safe.
			return nil, nil, apifmt.Errorf("failed to get provisioning identity for '%s': %w", job.GetNamespace(), err)
		}

		// This relies on the resource version being updated for us.
		// If the resource version we pass in via the current job is not the same as the one currently in the store, it will fail with Conflict.
		// This is the desired behavior, as it ensures that claims are atomic.
		updatedJob, err := s.client.Jobs(job.GetNamespace()).Update(ctx, &job, metav1.UpdateOptions{})
		if apierrors.IsConflict(err) {
			// On conflict: another worker claimed the job before us.
			// On would create: the job was completed and deleted before we could claim it.
			// We'll just move on to the next job.
			continue
		}
		if err != nil {
			return nil, nil, apifmt.Errorf("failed to claim job '%s' in '%s': %w", job.GetName(), job.GetNamespace(), err)
		}

		logger.Info("job claim complete",
			"job", updatedJob.GetName(),
			"namespace", updatedJob.GetNamespace(),
			"repository", updatedJob.Spec.Repository,
			"action", updatedJob.Spec.Action,
		)

		span.SetAttributes(
			attribute.String("job.name", updatedJob.GetName()),
			attribute.String("job.namespace", updatedJob.GetNamespace()),
			attribute.String("job.repository", updatedJob.Spec.Repository),
			attribute.String("job.action", string(updatedJob.Spec.Action)),
		)

		return updatedJob.DeepCopy(), func() {
			// Rolling back does not need to care about the parent's cancellation state.
			// This will also use the parent context (i.e. from the for loop!), ensuring we have permissions to do this.
			ctx = context.WithoutCancel(ctx)

			logger := logging.FromContext(ctx).With("namespace", updatedJob.GetNamespace(), "job", updatedJob.GetName())

			timeoutCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
			refetched, err := s.client.Jobs(updatedJob.GetNamespace()).Get(timeoutCtx, updatedJob.GetName(), metav1.GetOptions{})
			cancel()
			if apierrors.IsNotFound(err) {
				// The job was probably completed already. Nothing to roll back!
				return
			} else if err != nil {
				// We failed. Nothing much we can do but let the job be cleaned up by the periodic cleaner.
				logger.Warn("failed to roll back job claim; letting periodic cleaner deal with it", "error", err)
				return
			}

			// Rollback the claim.
			refetchedJob := refetched.DeepCopy()
			delete(refetchedJob.Labels, LabelJobClaim)
			refetchedJob.Status.State = provisioning.JobStatePending

			timeoutCtx, cancel = context.WithTimeout(ctx, 5*time.Second)
			_, err = s.client.Jobs(updatedJob.GetNamespace()).Update(timeoutCtx, refetchedJob, metav1.UpdateOptions{})
			cancel()
			if err != nil && !apierrors.IsConflict(err) {
				logger.Warn("failed to roll back job claim; letting periodic cleaner deal with it", "error", err)
			} else if err != nil {
				logger.Debug("failed to roll back job claim; got an OK error", "error", err)
			}
		}, nil
	}

	// We failed to claim any jobs.
	logger.Debug("no jobs claimed - all already claimed by others")
	return nil, nil, ErrNoJobs
}

// Update saves the job back to the store.
func (s *persistentStore) Update(ctx context.Context, job *provisioning.Job) (*provisioning.Job, error) {
	ctx, span := tracing.Start(ctx, "provisioning.jobs.update")
	defer span.End()

	logger := logging.FromContext(ctx).With(
		"operation", "update",
		"job", job.GetName(),
		"namespace", job.GetNamespace(),
	)

	span.SetAttributes(
		attribute.String("job.name", job.GetName()),
		attribute.String("job.namespace", job.GetNamespace()),
	)

	// Set up the provisioning identity for this namespace
	ctx, _, err := identity.WithProvisioningIdentity(ctx, job.GetNamespace())
	if err != nil {
		span.RecordError(err)
		return nil, apifmt.Errorf("failed to get provisioning identity for '%s': %w", job.GetNamespace(), err)
	}

	updatedJob, err := s.client.Jobs(job.GetNamespace()).Update(ctx, job, metav1.UpdateOptions{})
	if err != nil {
		span.RecordError(err)
		return nil, apifmt.Errorf("failed to update job '%s' in '%s': %w", job.GetName(), job.GetNamespace(), err)
	}

	logger.Debug("update job complete")
	return updatedJob, nil
}

// Get retrieves a job by name for conflict resolution.
func (s *persistentStore) Get(ctx context.Context, namespace, name string) (*provisioning.Job, error) {
	ctx, span := tracing.Start(ctx, "provisioning.jobs.get")
	defer span.End()

	logger := logging.FromContext(ctx).With(
		"operation", "get",
		"job", name,
		"namespace", namespace,
	)

	span.SetAttributes(
		attribute.String("job.name", name),
		attribute.String("job.namespace", namespace),
	)

	// Set up provisioning identity to access jobs across all namespaces
	ctx, _, err := identity.WithProvisioningIdentity(ctx, namespace)
	if err != nil {
		span.RecordError(err)
		return nil, apifmt.Errorf("failed to grant provisioning identity for job lookup: %w", err)
	}

	// Use Get to directly fetch the job by name
	job, err := s.client.Jobs(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		span.RecordError(err)
		return nil, apifmt.Errorf("failed to get job by name '%s': %w", name, err)
	}

	logger.Debug("get job complete")
	return job, nil
}

// Complete marks a job as completed and moves it to the historic job store.
// When in the historic store, there is no more claim on the job.
func (s *persistentStore) Complete(ctx context.Context, job *provisioning.Job) error {
	ctx, span := tracing.Start(ctx, "provisioning.jobs.complete")
	defer span.End()

	logger := logging.FromContext(ctx).With(
		"operation", "complete",
		"namespace", job.GetNamespace(),
		"job", job.GetName(),
	)

	span.SetAttributes(
		attribute.String("job.name", job.GetName()),
		attribute.String("job.namespace", job.GetNamespace()),
		attribute.String("job.action", string(job.Spec.Action)),
	)

	// Set up the provisioning identity for this namespace
	ctx, _, err := identity.WithProvisioningIdentity(ctx, job.GetNamespace())
	if err != nil {
		span.RecordError(err)
		return apifmt.Errorf("failed to get provisioning identity for '%s': %w", job.GetNamespace(), err)
	}

	// Delete the job from the active job store.
	// Callers are responsible for writing the job to history after calling this.
	//
	// We will assume that the caller is the claimant. If this is not true, an error is returned.
	// This is a best-effort operation; if the job is not in the claimed state, we will still attempt to delete it.
	err = s.client.Jobs(job.GetNamespace()).Delete(ctx, job.GetName(), metav1.DeleteOptions{})
	if err != nil {
		span.RecordError(err)
		return apifmt.Errorf("failed to delete job '%s' in '%s': %w", job.GetName(), job.GetNamespace(), err)
	}
	logger.Debug("deleted job from job store")

	// We need to remove the claim label before moving the job to the historic job store.
	if job.Labels == nil {
		job.Labels = make(map[string]string)
	}
	delete(job.Labels, LabelJobClaim)
	s.queueMetrics.DecreaseQueueSize(string(job.Spec.Action))

	logger.Debug("complete job complete")
	return nil
}

// ListExpiredJobs lists jobs with expired leases (claim timestamp older than the given time).
// Returns jobs in batches up to the specified limit.
func (s *persistentStore) ListExpiredJobs(ctx context.Context, expiredBefore time.Time, limit int) ([]*provisioning.Job, error) {
	ctx, span := tracing.Start(ctx, "provisioning.jobs.list_expired_jobs")
	defer span.End()

	logger := logging.FromContext(ctx).With("operation", "list_expired_jobs")

	// Set up provisioning identity to access jobs across all namespaces
	ctx, _, err := identity.WithProvisioningIdentity(ctx, "*")
	if err != nil {
		span.RecordError(err)
		return nil, apifmt.Errorf("failed to grant provisioning identity for listing expired jobs: %w", err)
	}

	// Find jobs with expired leases (older than expiredBefore)
	expiry := expiredBefore.UnixMilli()
	logger.Debug("searching for expired jobs", "expiry_threshold", expiredBefore.Format(time.RFC3339))

	requirement, err := labels.NewRequirement(LabelJobClaim, selection.LessThan, []string{strconv.FormatInt(expiry, 10)})
	if err != nil {
		span.RecordError(err)
		return nil, apifmt.Errorf("could not create requirement: %w", err)
	}

	span.SetAttributes(
		attribute.String("expiry_threshold", expiredBefore.Format(time.RFC3339)),
		attribute.Int("limit", limit),
	)

	jobList, err := s.client.Jobs("").List(ctx, metav1.ListOptions{
		LabelSelector: labels.NewSelector().Add(*requirement).String(),
		Limit:         int64(limit),
	})
	if err != nil {
		span.RecordError(err)
		return nil, apifmt.Errorf("failed to list jobs with expired leases: %w", err)
	}

	result := make([]*provisioning.Job, len(jobList.Items))
	for i := range jobList.Items {
		result[i] = &jobList.Items[i]
	}

	span.SetAttributes(attribute.Int("jobs_found", len(result)))
	logger.Debug("found expired jobs", "count", len(result))

	return result, nil
}

// RenewLease renews the lease for a claimed job, extending its expiry time.
// Returns an error if the lease cannot be renewed (e.g., job was completed or lease expired).
func (s *persistentStore) RenewLease(ctx context.Context, job *provisioning.Job) error {
	ctx, span := tracing.Start(ctx, "provisioning.jobs.renew_lease")
	defer span.End()

	logger := logging.FromContext(ctx).With(
		"operation", "renew_lease",
		"job", job.GetName(),
		"namespace", job.GetNamespace(),
	)

	span.SetAttributes(
		attribute.String("job.name", job.GetName()),
		attribute.String("job.namespace", job.GetNamespace()),
	)

	if job.Labels == nil || job.Labels[LabelJobClaim] == "" {
		err := apifmt.Errorf("job '%s' in '%s' is not claimed", job.GetName(), job.GetNamespace())
		span.RecordError(err)
		return err
	}

	// Set up the provisioning identity for this namespace
	ctx, _, err := identity.WithProvisioningIdentity(ctx, job.GetNamespace())
	if err != nil {
		span.RecordError(err)
		return apifmt.Errorf("failed to get provisioning identity for '%s': %w", job.GetNamespace(), err)
	}

	// Fetch the latest version to avoid conflicts
	latestJob, err := s.client.Jobs(job.GetNamespace()).Get(ctx, job.GetName(), metav1.GetOptions{})
	if err != nil {
		span.RecordError(err)
		if apierrors.IsNotFound(err) {
			return apifmt.Errorf("failed to renew lease for job '%s' in '%s': job no longer exists", job.GetName(), job.GetNamespace())
		}
		return apifmt.Errorf("failed to fetch job for lease renewal '%s' in '%s': %w", job.GetName(), job.GetNamespace(), err)
	}

	// Verify we still own the lease
	if latestJob.Labels == nil || latestJob.Labels[LabelJobClaim] == "" {
		err := apifmt.Errorf("lease lost for job '%s' in '%s': no longer claimed", job.GetName(), job.GetNamespace())
		span.RecordError(err)
		return err
	}

	// Update the claim timestamp to current time
	updatedJob := latestJob.DeepCopy()
	updatedJob.Labels[LabelJobClaim] = strconv.FormatInt(s.clock().UnixMilli(), 10)

	// Update the job in storage with the latest resource version
	_, err = s.client.Jobs(job.GetNamespace()).Update(ctx, updatedJob, metav1.UpdateOptions{})
	if apierrors.IsConflict(err) {
		err := apifmt.Errorf("failed to renew lease for job '%s' in '%s': lease conflict", job.GetName(), job.GetNamespace())
		span.RecordError(err)
		return err
	}
	if apierrors.IsNotFound(err) {
		err := apifmt.Errorf("failed to renew lease for job '%s' in '%s': job no longer exists", job.GetName(), job.GetNamespace())
		span.RecordError(err)
		return err
	}
	if err != nil {
		span.RecordError(err)
		return apifmt.Errorf("failed to renew lease for job '%s' in '%s': %w", job.GetName(), job.GetNamespace(), err)
	}

	// Update the job's claim timestamp and resource version in memory
	job.Labels[LabelJobClaim] = updatedJob.Labels[LabelJobClaim]
	job.ResourceVersion = updatedJob.ResourceVersion

	logger.Debug("renew lease complete")
	return nil
}

func (s *persistentStore) Insert(ctx context.Context, namespace string, spec provisioning.JobSpec) (*provisioning.Job, error) {
	ctx, span := tracing.Start(ctx, "provisioning.jobs.insert")
	defer span.End()

	logger := logging.FromContext(ctx).With(
		"operation", "insert",
		"namespace", namespace,
		"repository", spec.Repository,
		"action", spec.Action,
	)

	span.SetAttributes(
		attribute.String("job.namespace", namespace),
		attribute.String("job.repository", spec.Repository),
		attribute.String("job.action", string(spec.Action)),
	)

	if spec.Repository == "" {
		err := errors.New("missing repository in job")
		span.RecordError(err)
		return nil, err
	}

	// Set up the provisioning identity for this namespace
	ctx, _, err := identity.WithProvisioningIdentity(ctx, namespace)
	if err != nil {
		span.RecordError(err)
		return nil, apifmt.Errorf("failed to get provisioning identity for '%s': %w", namespace, err)
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
		span.RecordError(err)
		return nil, err
	}
	generateJobName(job) // Side-effect: updates the job's name.

	logger = logger.With("job", job.GetName())
	span.SetAttributes(attribute.String("job.name", job.GetName()))

	created, err := s.client.Jobs(namespace).Create(ctx, job, metav1.CreateOptions{})
	if apierrors.IsAlreadyExists(err) {
		span.RecordError(err)
		return nil, apifmt.Errorf("job '%s' in '%s' already exists: %w", job.GetName(), job.GetNamespace(), err)
	}
	if err != nil {
		span.RecordError(err)
		return nil, apifmt.Errorf("failed to create job '%s' in '%s': %w", job.GetName(), job.GetNamespace(), err)
	}

	s.queueMetrics.IncreaseQueueSize(string(job.Spec.Action))

	logger.Info("insert job complete")
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
