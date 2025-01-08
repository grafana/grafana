package jobs

import (
	"context"
	"fmt"
	"log/slog"
	"strconv"
	"sync"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/storage"

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
		logger:    slog.Default().With("logger", "job-queue"),
	}
}

type jobStore struct {
	logger   *slog.Logger
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
		return nil, fmt.Errorf("expecting namespace")
	}
	_, ok := job.Labels["repository"]
	if !ok {
		return nil, fmt.Errorf("expecting repository name label")
	}
	if job.Spec.Action == "" {
		return nil, fmt.Errorf("missing spec.action")
	}

	// Only for add
	if job.Status.State != "" {
		return nil, fmt.Errorf("must add jobs with empty state")
	}

	s.mutex.Lock()
	defer s.mutex.Unlock()

	s.rv++
	job.ResourceVersion = strconv.FormatInt(s.rv, 10)
	job.Status.State = provisioning.JobStatePending
	job.Labels["action"] = string(job.Spec.Action) // make it searchable
	job.Labels["state"] = string(job.Status.State)
	job.Name = util.GenerateShortUID()
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
	var err error
	for {
		time.Sleep(time.Microsecond * 200)
		ctx := context.Background()

		job := s.Checkout(ctx, nil)
		if job == nil {
			return // done
		}
		logger := s.logger.With("job", job.GetName(), "namespace", job.GetNamespace())

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
			status, err = s.worker.Process(ctx, *job)
			if err != nil {
				logger.ErrorContext(ctx, "error processing job", "error", err)
				status = &provisioning.JobStatus{
					State:  provisioning.JobStateError,
					Errors: []string{err.Error()},
				}
			} else if status.State == "" {
				status.State = provisioning.JobStateSuccess
			}
			logger.DebugContext(ctx, "job processing finished", "status", status.State)
		}

		status.Started = started.UnixMilli()
		status.Finished = time.Now().UnixMilli()

		err = s.Complete(ctx, job.Namespace, job.Name, *status)
		if err != nil {
			logger.ErrorContext(ctx, "error running job", "error", err)
		}
		logger.DebugContext(ctx, "job has been fully completed")
	}
}

// Checkout the next "pending" job
func (s *jobStore) Checkout(ctx context.Context, query labels.Selector) *provisioning.Job {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	// The oldest jobs should be checked out first
	for i := len(s.jobs) - 1; i >= 0; i-- {
		if s.jobs[i].Status.State == provisioning.JobStatePending {
			oldObj := s.jobs[i].DeepCopyObject()

			s.rv++
			s.jobs[i].ResourceVersion = strconv.FormatInt(s.rv, 10)
			s.jobs[i].Status.State = provisioning.JobStateWorking
			s.jobs[i].Labels["state"] = string(provisioning.JobStateWorking)
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
func (s *jobStore) Complete(ctx context.Context, namespace string, name string, status provisioning.JobStatus) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	s.rv++

	for idx, job := range s.jobs {
		if job.Name == name && job.Namespace == namespace {
			oldObj := job.DeepCopyObject()

			status.Finished = time.Now().UnixMilli()
			job.ResourceVersion = strconv.FormatInt(s.rv, 10)
			job.Status = status
			job.Labels["state"] = string(status.State)
			s.jobs[idx] = job

			s.watchSet.notifyWatchers(watch.Event{
				Object: job.DeepCopyObject(),
				Type:   watch.Modified,
			}, oldObj)
			return nil
		}
	}

	return fmt.Errorf("not found")
}
