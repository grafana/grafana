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

	"github.com/google/uuid"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
)

func NewJobQueue(capacity int) JobQueue {
	return &jobStore{
		rv:       1,
		capacity: capacity,
		jobs:     []provisioning.Job{},
		logger:   slog.Default().With("logger", "job-queue"),
	}
}

type jobStore struct {
	logger   *slog.Logger
	capacity int
	workers  []Worker

	// All jobs
	jobs []provisioning.Job
	rv   int64 // updates whenever changed

	mutex sync.RWMutex
}

// Register a worker (inline for now)
func (s *jobStore) Register(worker Worker) {
	s.mutex.Lock()
	s.workers = append(s.workers, worker)
	s.mutex.Unlock()
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
	_, ok = job.Labels["repository.type"] // TODO: ideally just based on the action type
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
	job.Name = "j" + uuid.NewString()
	job.CreationTimestamp = metav1.NewTime(time.Now())

	jobs := make([]provisioning.Job, 0, len(s.jobs)+2)
	jobs = append(jobs, *job)
	for i, j := range s.jobs {
		if i >= s.capacity {
			break
		}
		jobs = append(jobs, j)
	}

	// For now, start a thread processing each job
	go func() {
		time.Sleep(time.Millisecond * 100)
		s.drainPending()
	}()

	s.jobs = jobs // replace existing list
	return job, nil
}

// Reads the queue until no jobs remain
func (s *jobStore) drainPending() {
	var err error
	for {
		time.Sleep(time.Microsecond * 100)
		ctx := context.Background()

		job := s.Checkout(ctx, nil)
		if job == nil {
			return // done
		}

		var status *provisioning.JobStatus
		var worker Worker
		for _, w := range s.workers {
			if w.Supports(ctx, job) {
				worker = w
				break
			}
		}
		if worker == nil {
			status = &provisioning.JobStatus{
				State: provisioning.JobStateError,
				Errors: []string{
					"no registered worker supports this job",
				},
			}
		} else {
			status, err = worker.Process(ctx, *job)
			if err != nil {
				status = &provisioning.JobStatus{
					State:  "error",
					Errors: []string{err.Error()},
				}
			} else if status.State == "" {
				status.State = provisioning.JobStateFinished
			}
		}

		err = s.Complete(ctx, job.Namespace, job.Name, *status)
		if err != nil {
			s.logger.Error("error running job", "job", job.Name, "error", err)
		}
	}
}

// Checkout the next "pending" job
func (s *jobStore) Checkout(ctx context.Context, query labels.Selector) *provisioning.Job {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	// The oldest jobs should be checked out first
	for i := len(s.jobs) - 1; i >= 0; i-- {
		if s.jobs[i].Status.State == provisioning.JobStatePending {
			s.rv++
			s.jobs[i].ResourceVersion = strconv.FormatInt(s.rv, 10)
			s.jobs[i].Status.State = provisioning.JobStateWorking
			s.jobs[i].Labels["state"] = string(provisioning.JobStateWorking)
			s.jobs[i].Status.Started = time.Now().UnixMilli()
			job := s.jobs[i]
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
			status.Finished = time.Now().UnixMilli()
			job.ResourceVersion = strconv.FormatInt(s.rv, 10)
			job.Status = status
			job.Labels["state"] = string(status.State)
			s.jobs[idx] = job
			return nil
		}
	}

	return fmt.Errorf("not found")
}
