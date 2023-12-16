package service

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

	service "github.com/grafana/grafana/pkg/apis/service/v0alpha1"
	grafanarequest "github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
	grafanaregistry "github.com/grafana/grafana/pkg/services/grafana-apiserver/registry/generic"
)

var (
	_ rest.Storage              = (*serviceStorage)(nil)
	_ rest.Scoper               = (*serviceStorage)(nil)
	_ rest.SingularNameProvider = (*serviceStorage)(nil)
	_ rest.Getter               = (*serviceStorage)(nil)
	_ rest.Lister               = (*serviceStorage)(nil)
)

type serviceStorage struct {
	store             *genericregistry.Store
	names             []string
	creationTimestamp metav1.Time
}

func newServiceStorage(gv schema.GroupVersion, scheme *runtime.Scheme, names ...string) *serviceStorage {
	var resourceInfo = service.RuntimeResourceInfo
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

	return &serviceStorage{
		store:             store,
		names:             names,
		creationTimestamp: metav1.Now(),
	}
}

func (s *serviceStorage) New() runtime.Object {
	return s.store.New()
}

func (s *serviceStorage) Destroy() {}

func (s *serviceStorage) NamespaceScoped() bool {
	return true
}

func (s *serviceStorage) GetSingularName() string {
	return service.RuntimeResourceInfo.GetSingularName()
}

func (s *serviceStorage) NewList() runtime.Object {
	return s.store.NewListFunc()
}

func (s *serviceStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.store.TableConvertor.ConvertToTable(ctx, object, tableOptions)
}

func (s *serviceStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	info, err := grafanarequest.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	idx := slices.Index(s.names, name)
	if idx < 0 {
		return nil, fmt.Errorf("service not found")
	}

	return &service.ExternalName{
		ObjectMeta: metav1.ObjectMeta{
			Name:              name,
			Namespace:         info.Value,
			CreationTimestamp: s.creationTimestamp,
			ResourceVersion:   "1",
		},
		Spec: service.ExternalNameSpec{
			Host: "localhost",
		},
	}, nil
}

func (s *serviceStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	info, err := grafanarequest.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	res := &service.ExternalNameList{}
	for _, name := range s.names {
		res.Items = append(res.Items, service.ExternalName{
			ObjectMeta: metav1.ObjectMeta{
				Name:              name,
				Namespace:         info.Value,
				CreationTimestamp: s.creationTimestamp,
				ResourceVersion:   "1",
			},
			Spec: service.ExternalNameSpec{
				Host: "localhost",
			},
		})
	}
	return res, nil
}
