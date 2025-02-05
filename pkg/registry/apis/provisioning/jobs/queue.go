package jobs

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/storage"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/util"
)

func NewJobQueue(capacity int) JobQueue {
	return &jobStore{
		rv:        1,
		capacity:  capacity,
		jobs:      []provisioning.Job{},
		watchSet:  NewWatchSet(),
		versioner: &storage.APIObjectVersioner{},
	}
}

type jobStore struct {
	capacity int
	worker   Worker

	// All jobs
	jobs      []provisioning.Job
	rv        int64 // updates whenever changed
	watchSet  *WatchSet
	versioner storage.Versioner

	mutex sync.RWMutex
}

// Register a worker (inline for now)
func (s *jobStore) Register(worker Worker) {
	s.worker = worker
}

// Add implements JobQueue.
func (s *jobStore) Add(ctx context.Context, job *provisioning.Job) (*provisioning.Job, error) {
	if job.Namespace == "" {
		return nil, apierrors.NewBadRequest("missing metadata.namespace")
	}
	if job.Name != "" {
		return nil, apierrors.NewBadRequest("name will always be generated")
	}
	if job.Spec.Repository == "" {
		return nil, apierrors.NewBadRequest("missing spec.repository")
	}
	if job.Spec.Action == "" {
		return nil, apierrors.NewBadRequest("missing spec.action")
	}
	if job.Spec.Action == provisioning.JobActionExport && job.Spec.Export == nil {
		return nil, apierrors.NewBadRequest("missing spec.export")
	}

	if job.Spec.Action == provisioning.JobActionSync && job.Spec.Sync == nil {
		return nil, apierrors.NewBadRequest("missing spec.sync")
	}

	// Only for add
	if job.Status.State != "" {
		return nil, apierrors.NewBadRequest("must add jobs with empty status")
	}

	if job.Labels == nil {
		job.Labels = make(map[string]string)
	}
	job.Labels["repository"] = job.Spec.Repository // for now, make sure we can search Multi-tenant
	job.Name = fmt.Sprintf("%s:%s:%s", job.Spec.Repository, job.Spec.Action, util.GenerateShortUID())

	s.mutex.Lock()
	defer s.mutex.Unlock()

	s.rv++
	job.ResourceVersion = strconv.FormatInt(s.rv, 10)
	job.Status.State = provisioning.JobStatePending
	job.CreationTimestamp = metav1.NewTime(time.Now())

	jobs := make([]provisioning.Job, 0, len(s.jobs)+2)
	jobs = append(jobs, *job)
	for i, j := range s.jobs {
		if i >= s.capacity {
			// Remove the old jobs
			s.watchSet.notifyWatchers(watch.Event{
				Object: j.DeepCopyObject(),
				Type:   watch.Deleted,
			}, nil)
			continue
		}
		jobs = append(jobs, j)
	}

	// Send add event
	s.watchSet.notifyWatchers(watch.Event{
		Object: job.DeepCopyObject(),
		Type:   watch.Added,
	}, nil)

	// For now, start a thread processing each job
	go s.drainPending()

	s.jobs = jobs // replace existing list
	return job, nil
}

// Reads the queue until no jobs remain
func (s *jobStore) drainPending() {
	logger := logging.DefaultLogger.With("logger", "job-store")
	ctx := logging.Context(context.Background(), logger)

	var err error
	for {
		time.Sleep(time.Microsecond * 200)

		job := s.Next(ctx)
		if job == nil {
			return // done
		}
		logger := logger.With("job", job.GetName(), "namespace", job.GetNamespace())
		ctx := logging.Context(ctx, logger)

		started := time.Now()
		var status *provisioning.JobStatus
		if s.worker == nil {
			status = &provisioning.JobStatus{
				State: provisioning.JobStateError,
				Errors: []string{
					"no registered worker supports this job",
				},
			}
		} else {
			status, err = s.worker.Process(ctx, *job, func(j provisioning.JobStatus) error {
				return s.Update(ctx, job.Namespace, job.Name, j)
			})
			if err != nil {
				logger.Error("error processing job", "error", err)
				status = &provisioning.JobStatus{
					State:  provisioning.JobStateError,
					Errors: []string{err.Error()},
				}
			}
			if status == nil {
				status = &provisioning.JobStatus{
					State:  provisioning.JobStateError,
					Errors: []string{"no status response from worker"},
				}
			}
			if status.State == "" {
				status.State = provisioning.JobStateSuccess
			}
			logger.Debug("job processing finished", "status", status.State)
		}

		status.Started = started.UnixMilli()
		status.Finished = time.Now().UnixMilli()

		err = s.Update(ctx, job.Namespace, job.Name, *status)
		if err != nil {
			logger.Error("error running job", "error", err)
		}
		logger.Debug("job has been fully completed")
	}
}

// Checkout the next "pending" job
func (s *jobStore) Next(ctx context.Context) *provisioning.Job {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	// The oldest jobs should be checked out first
	for i := len(s.jobs) - 1; i >= 0; i-- {
		if s.jobs[i].Status.State == provisioning.JobStatePending {
			oldObj := s.jobs[i].DeepCopyObject()

			s.rv++
			s.jobs[i].ResourceVersion = strconv.FormatInt(s.rv, 10)
			s.jobs[i].Status.State = provisioning.JobStateWorking
			s.jobs[i].Status.Started = time.Now().UnixMilli()
			job := s.jobs[i]

			s.watchSet.notifyWatchers(watch.Event{
				Object: job.DeepCopyObject(),
				Type:   watch.Modified,
			}, oldObj)
			return &job
		}
	}
	return nil
}

// Complete implements JobQueue.
func (s *jobStore) Update(ctx context.Context, namespace string, name string, status provisioning.JobStatus) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	s.rv++

	if status.State == "" {
		return apierrors.NewBadRequest("The state must be set")
	}
	if status.Progress > 100 || status.Progress < 0 {
		return apierrors.NewBadRequest("progress must be between 0 and 100")
	}

	for idx, job := range s.jobs {
		if job.Name == name && job.Namespace == namespace {
			if job.Status.State.Finished() {
				return &apierrors.StatusError{ErrStatus: metav1.Status{
					Code:    http.StatusPreconditionFailed,
					Message: "The job is already finished and can not be updated",
				}}
			}
			if status.State.Finished() {
				status.Finished = time.Now().UnixMilli()
			}

			oldObj := job.DeepCopyObject()
			job.ResourceVersion = strconv.FormatInt(s.rv, 10)
			job.Status = status
			s.jobs[idx] = job

			s.watchSet.notifyWatchers(watch.Event{
				Object: job.DeepCopyObject(),
				Type:   watch.Modified,
			}, oldObj)
			return nil
		}
	}

	return apierrors.NewNotFound(provisioning.JobResourceInfo.GroupResource(), name)
}
