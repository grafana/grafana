package example

import (
	"context"
	"fmt"
	"slices"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	example "github.com/grafana/grafana/pkg/apis/example/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarequest "github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

var (
	_ rest.Storage              = (*dummyStorage)(nil)
	_ rest.Scoper               = (*dummyStorage)(nil)
	_ rest.SingularNameProvider = (*dummyStorage)(nil)
	_ rest.Getter               = (*dummyStorage)(nil)
	_ rest.Lister               = (*dummyStorage)(nil)
)

type dummyStorage struct {
	store             *genericregistry.Store
	names             []string
	creationTimestamp metav1.Time
}

func newDummyStorage(gv schema.GroupVersion, scheme *runtime.Scheme, names ...string) *dummyStorage {
	var resourceInfo = example.DummyResourceInfo
	strategy := grafanaregistry.NewStrategy(scheme)
	store := &genericregistry.Store{
		NewFunc:                   resourceInfo.NewFunc,
		NewListFunc:               resourceInfo.NewListFunc,
		PredicateFunc:             grafanaregistry.Matcher,
		DefaultQualifiedResource:  resourceInfo.GroupResource(),
		SingularQualifiedResource: resourceInfo.SingularGroupResource(),
		TableConvertor:            rest.NewDefaultTableConvertor(resourceInfo.GroupResource()),
		CreateStrategy:            strategy,
		UpdateStrategy:            strategy,
		DeleteStrategy:            strategy,
	}

	return &dummyStorage{
		store:             store,
		names:             names,
		creationTimestamp: metav1.Now(),
	}
}

func (s *dummyStorage) New() runtime.Object {
	return s.store.New()
}

func (s *dummyStorage) Destroy() {}

func (s *dummyStorage) NamespaceScoped() bool {
	return true
}

func (s *dummyStorage) GetSingularName() string {
	return example.DummyResourceInfo.GetSingularName()
}

func (s *dummyStorage) NewList() runtime.Object {
	return s.store.NewListFunc()
}

func (s *dummyStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.store.TableConvertor.ConvertToTable(ctx, object, tableOptions)
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
		Spec: common.Unstructured{
			Object: map[string]any{
				"Dummy": name,
			},
		},
	}, nil
}

func (s *dummyStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	info, err := grafanarequest.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	res := &example.DummyResourceList{}
	for _, name := range s.names {
		res.Items = append(res.Items, example.DummyResource{
			ObjectMeta: metav1.ObjectMeta{
				Name:              name,
				Namespace:         info.Value,
				CreationTimestamp: s.creationTimestamp,
				ResourceVersion:   "1",
			},
			Spec: common.Unstructured{
				Object: map[string]any{
					"Dummy": name,
				},
			},
		})
	}
	return res, nil
}
