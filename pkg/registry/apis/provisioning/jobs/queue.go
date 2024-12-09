package jobs

import (
	"context"
	"fmt"
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
	}
}

type jobStore struct {
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
func (s *jobStore) Add(ctx context.Context, job provisioning.Job) (string, error) {
	if job.Namespace == "" {
		return "", fmt.Errorf("expecting namespace")
	}
	_, ok := job.Labels["repository"]
	if !ok {
		return "", fmt.Errorf("expecting repository name label")
	}
	_, ok = job.Labels["repository.type"] // TODO: ideally just based on the action type
	if !ok {
		return "", fmt.Errorf("expecting repository name label")
	}
	if job.Spec.Action == "" {
		return "", fmt.Errorf("missing spec.action")
	}

	// Only for add
	if job.Status.State != "" {
		return "", fmt.Errorf("must add jobs with empty state")
	}
	job.Status.State = "pending" // start pending

	s.mutex.Lock()
	defer s.mutex.Unlock()

	s.rv++
	job.ResourceVersion = strconv.FormatInt(s.rv, 10)
	job.Labels["action"] = string(job.Spec.Action) // make it searchable
	job.Labels["state"] = job.Status.State
	job.Status.State = "pending" // it is queued
	job.Name = "j" + uuid.NewString()
	job.CreationTimestamp = metav1.NewTime(time.Now())

	jobs := make([]provisioning.Job, 0, len(s.jobs)+2)
	jobs = append(jobs, job)
	for i, j := range s.jobs {
		if i >= s.capacity {
			break
		}
		jobs = append(jobs, j)
	}

	go func() {
		time.Sleep(time.Millisecond * 100)
		s.runWorkers()
	}()

	s.jobs = jobs // replace existing list
	return job.Name, nil
}

func (s *jobStore) processPendingJob() bool {
	for i, job := range s.jobs {
		if job.Status.State == "pending" {
			ctx, cancel := context.WithCancel(context.WithoutCancel(context.Background()))
			defer cancel()

			for _, worker := range s.workers {
				if worker.Supports(ctx, job) {
					// TODO: checkout
					s.mutex.Lock()
					s.rv++
					s.jobs[i].ResourceVersion = strconv.FormatInt(s.rv, 10)
					s.jobs[i].Status.State = "running"
					s.jobs[i].Status.Updated = metav1.NewTime(time.Now())
					s.mutex.Unlock()

					time.Sleep(time.Millisecond * 100)

					status, err := worker.Process(ctx, job)
					if err != nil {
						status = &provisioning.JobStatus{
							State:  "error",
							Errors: []string{err.Error()},
						}
					}
					status.Updated = metav1.NewTime(time.Now())

					s.mutex.Lock()
					s.rv++
					s.jobs[i].ResourceVersion = strconv.FormatInt(s.rv, 10)
					s.jobs[i].Status = *status
					s.mutex.Unlock()
					return true
				}
			}

			s.mutex.Lock()
			s.rv++
			s.jobs[i].ResourceVersion = strconv.FormatInt(s.rv, 10)
			s.jobs[i].Status = provisioning.JobStatus{
				State:   "error",
				Updated: metav1.NewTime(time.Now()),
				Errors: []string{
					"no workers registered support this job",
				},
			}
			return true
		}
	}
	return false
}

// Checkout implements JobQueue.
func (s *jobStore) runWorkers() {
	// TODO... there must be a better async strategy, but this is good enough for now
	for s.processPendingJob() {
		time.Sleep(time.Microsecond * 100)
	}
}

// Checkout implements JobQueue.
func (s *jobStore) Checkout(ctx context.Context, query labels.Selector) (*provisioning.Job, error) {
	return nil, fmt.Errorf("not implemented yet")
}

// Complete implements JobQueue.
func (s *jobStore) Complete(ctx context.Context, namespace string, name string, status provisioning.JobStatus) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	s.rv++

	for idx, job := range s.jobs {
		if job.Name == name && job.Namespace == namespace {
			status.Updated = metav1.NewTime(time.Now())
			job.ResourceVersion = strconv.FormatInt(s.rv, 10)
			job.Status = status
			job.Labels["state"] = status.State
			s.jobs[idx] = job
			return nil
		}
	}

	return fmt.Errorf("not found")
}
