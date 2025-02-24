package jobs

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/storage"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/util"
)

var (
	_ JobQueue                  = (*jobStore)(nil)
	_ rest.Scoper               = (*jobStore)(nil)
	_ rest.SingularNameProvider = (*jobStore)(nil)
	_ rest.Getter               = (*jobStore)(nil)
	_ rest.Lister               = (*jobStore)(nil)
	_ rest.Storage              = (*jobStore)(nil)
	_ rest.Watcher              = (*jobStore)(nil)
)

func NewJobStore(capacity int, getter RepoGetter) *jobStore {
	return &jobStore{
		workers:   make([]Worker, 0),
		getter:    getter,
		rv:        1,
		capacity:  capacity,
		jobs:      []provisioning.Job{},
		watchSet:  NewWatchSet(),
		versioner: &storage.APIObjectVersioner{},
	}
}

type jobStore struct {
	getter   RepoGetter
	capacity int
	workers  []Worker

	// All jobs
	jobs      []provisioning.Job
	rv        int64 // updates whenever changed
	watchSet  *WatchSet
	versioner storage.Versioner

	mutex sync.RWMutex
}

// Implementing Kube interfaces

func (s *jobStore) New() runtime.Object {
	return provisioning.JobResourceInfo.NewFunc()
}

func (s *jobStore) Destroy() {}

func (s *jobStore) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *jobStore) GetSingularName() string {
	return provisioning.JobResourceInfo.GetSingularName()
}

func (s *jobStore) NewList() runtime.Object {
	return provisioning.JobResourceInfo.NewListFunc()
}

func (s *jobStore) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return provisioning.JobResourceInfo.TableConverter().ConvertToTable(ctx, object, tableOptions)
}

func (s *jobStore) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
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

	s.mutex.RLock()
	defer s.mutex.RUnlock()

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

	return nil, apierrors.NewNotFound(provisioning.JobResourceInfo.GroupResource(), name)
}

func (s *jobStore) Watch(ctx context.Context, opts *internalversion.ListOptions) (watch.Interface, error) {
	ns, ok := request.NamespaceFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("missing namespace")
	}

	p := storage.SelectionPredicate{
		Label: labels.Everything(), // TODO... limit
		Field: fields.Everything(),
	}

	// Can watch by label selection
	jw := s.watchSet.newWatch(ctx, 0, p, s.versioner, &ns)
	jw.Start()
	return jw, nil
}

// Implementing JobQueue

// Register a worker (inline for now)
func (s *jobStore) Register(worker Worker) {
	s.workers = append(s.workers, worker)
}

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

		var foundWorker bool
		recorder := newJobProgressRecorder(func(ctx context.Context, j provisioning.JobStatus) error {
			return s.Update(ctx, job.Namespace, job.Name, j)
		})

		for _, worker := range s.workers {
			if !worker.IsSupported(ctx, *job) {
				continue
			}

			// Already found a worker, no need to continue
			foundWorker = true
			err = s.processByWorker(ctx, worker, *job, recorder)
			break
		}

		if !foundWorker {
			err = errors.New("no registered worker supports this job")
		}

		status := recorder.Complete(ctx, err)
		err = s.Update(ctx, job.Namespace, job.Name, status)
		if err != nil {
			logger.Error("error running job", "error", err)
		}
		logger.Debug("job has been fully completed")
	}
}

func (s *jobStore) processByWorker(ctx context.Context, worker Worker, job provisioning.Job, recorder JobProgressRecorder) error {
	ctx = request.WithNamespace(ctx, job.Namespace)
	ctx, _, err := identity.WithProvisioningIdentitiy(ctx, job.Namespace)
	if err != nil {
		return fmt.Errorf("get worker identity: %w", err)
	}
	repoName := job.Spec.Repository

	logger := logging.FromContext(ctx)
	logger = logger.With("repository", repoName)
	ctx = logging.Context(ctx, logger)

	repo, err := s.getter.GetRepository(ctx, repoName)
	if err != nil {
		return fmt.Errorf("get repository: %w", err)
	}

	// TODO: does this really happen?
	if repo == nil {
		return errors.New("unknown repository")
	}

	return worker.Process(ctx, repo, job, recorder)
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
