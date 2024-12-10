package jobs

import (
	"context"
	"fmt"
	"strconv"

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

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
)

var (
	_ rest.Scoper               = (*jobStore)(nil)
	_ rest.SingularNameProvider = (*jobStore)(nil)
	_ rest.Getter               = (*jobStore)(nil)
	_ rest.Lister               = (*jobStore)(nil)
	_ rest.Storage              = (*jobStore)(nil)
	_ rest.Watcher              = (*jobStore)(nil)

	resourceInfo = provisioning.JobResourceInfo
)

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
