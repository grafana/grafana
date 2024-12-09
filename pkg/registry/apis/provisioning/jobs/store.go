package jobs

import (
	"context"
	"fmt"
	"strconv"
	"sync"
	"time"

	"github.com/google/uuid"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
)

var (
	_ rest.Scoper               = (*jobStore)(nil)
	_ rest.SingularNameProvider = (*jobStore)(nil)
	_ rest.Getter               = (*jobStore)(nil)
	_ rest.Lister               = (*jobStore)(nil)
	_ rest.Storage              = (*jobStore)(nil)
	_ JobQueue                  = (*jobStore)(nil)

	resourceInfo = provisioning.JobResourceInfo
)

// Basic job queue infrastructure
type JobQueue interface {
	rest.Storage // temporary.. simplifies registration

	Add(ctx context.Context, job provisioning.Job) (string, error)
	Checkout(ctx context.Context, query labels.Selector) (*provisioning.Job, error)
	Complete(ctx context.Context, namespace string, name string, status provisioning.JobStatus) error
}

func NewJobQueue(capacity int) JobQueue {
	return &jobStore{
		rv:       1,
		capacity: capacity,
		jobs:     []provisioning.Job{},
	}
}

type jobStore struct {
	capacity int

	// All jobs
	jobs []provisioning.Job
	rv   int64 // updates whenever changed

	mutex sync.RWMutex
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

	s.jobs = jobs // replace existing list
	return job.Name, nil
}

// Checkout implements JobQueue.
func (s *jobStore) Checkout(ctx context.Context, query labels.Selector) (*provisioning.Job, error) {
	panic("unimplemented")
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

func (s *jobStore) New() runtime.Object {
	return resourceInfo.NewFunc()
}

func (s *jobStore) Destroy() {}

func (s *jobStore) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *jobStore) GetSingularName() string {
	return resourceInfo.GetSingularName()
}

func (s *jobStore) NewList() runtime.Object {
	return resourceInfo.NewListFunc()
}

func (s *jobStore) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return resourceInfo.TableConverter().ConvertToTable(ctx, object, tableOptions)
}

func (s *jobStore) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	ns, ok := request.NamespaceFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("missing namespace")
	}

	queue := &provisioning.JobList{
		ListMeta: metav1.ListMeta{
			ResourceVersion: strconv.FormatInt(s.rv, 10),
		},
	}

	query := options.LabelSelector

	for _, job := range s.jobs {
		if job.Namespace != ns {
			continue
		}

		// maybe filter
		if query != nil && !query.Matches(labels.Set(job.Labels)) {
			continue
		}

		copy := job.DeepCopy()
		queue.Items = append(queue.Items, *copy)
	}

	return queue, nil
}

func (s *jobStore) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	ns, ok := request.NamespaceFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("missing namespace")
	}

	for _, job := range s.jobs {
		if job.Name == name && job.Namespace == ns {
			return job.DeepCopy(), nil
		}
	}

	return nil, apierrors.NewNotFound(resourceInfo.GroupResource(), name)
}
