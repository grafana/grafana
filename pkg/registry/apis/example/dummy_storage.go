package example

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/utils/strings/slices"

	example "github.com/grafana/grafana/pkg/apis/example/v0alpha1"

	grafanarequest "github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
)

var (
	_ rest.Scoper               = (*dummyStorage)(nil)
	_ rest.SingularNameProvider = (*dummyStorage)(nil)
	_ rest.Getter               = (*dummyStorage)(nil)
	_ rest.Lister               = (*dummyStorage)(nil)
	_ rest.Storage              = (*dummyStorage)(nil)
)

type dummyStorage struct {
	names             []string
	gvr               schema.GroupVersionResource
	creationTimestamp metav1.Time
}

func newDummyStorage(gvr schema.GroupVersionResource, names ...string) *dummyStorage {
	return &dummyStorage{
		gvr:               gvr,
		names:             names,
		creationTimestamp: metav1.Now(),
	}
}

func (s *dummyStorage) New() runtime.Object {
	return &example.DummyResource{}
}

func (s *dummyStorage) Destroy() {}

func (s *dummyStorage) NamespaceScoped() bool {
	return true
}

func (s *dummyStorage) GetSingularName() string {
	return "dummy"
}

func (s *dummyStorage) NewList() runtime.Object {
	return &example.DummyResourceList{}
}

func (s *dummyStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return rest.NewDefaultTableConvertor(s.gvr.GroupResource()).ConvertToTable(ctx, object, tableOptions)
}

func (s *dummyStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	info, err := grafanarequest.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	idx := slices.Index(s.names, name)
	if idx < 0 {
		return nil, fmt.Errorf("dummy not found")
	}

	return &example.DummyResource{
		ObjectMeta: metav1.ObjectMeta{
			Name:              name,
			Namespace:         info.Value,
			CreationTimestamp: s.creationTimestamp,
			ResourceVersion:   "1",
		},
		Spec: fmt.Sprintf("dummy: %d", idx),
	}, nil
}

func (s *dummyStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	info, err := grafanarequest.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	res := &example.DummyResourceList{}
	for idx, name := range s.names {
		res.Items = append(res.Items, example.DummyResource{
			ObjectMeta: metav1.ObjectMeta{
				Name:              name,
				Namespace:         info.Value,
				CreationTimestamp: s.creationTimestamp,
				ResourceVersion:   "1",
			},
			Spec: fmt.Sprintf("dummy: %d", idx),
		})
	}
	return res, nil
}
