package query

import (
	"context"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apis"
	example "github.com/grafana/grafana/pkg/apis/example/v0alpha1"
	"github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/services/grafana-apiserver/registry/generic"
)

var (
	_ rest.Storage              = (*expressionStorage)(nil)
	_ rest.Scoper               = (*expressionStorage)(nil)
	_ rest.SingularNameProvider = (*expressionStorage)(nil)
	_ rest.Lister               = (*expressionStorage)(nil)
)

type expressionStorage struct {
	resourceInfo *apis.ResourceInfo
	store        *genericregistry.Store
	exprs        *v0alpha1.ExpressionInfoList
}

func newExpressionStorage(scheme *runtime.Scheme) *expressionStorage {
	var resourceInfo = v0alpha1.ExpressionResourceInfo
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

	return &expressionStorage{
		resourceInfo: &resourceInfo,
		store:        store,
		exprs: &v0alpha1.ExpressionInfoList{
			Items: []v0alpha1.ExpressionInfo{},
		},
	}
}

func (s *expressionStorage) New() runtime.Object {
	return s.store.New()
}

func (s *expressionStorage) Destroy() {}

func (s *expressionStorage) NamespaceScoped() bool {
	return false
}

func (s *expressionStorage) GetSingularName() string {
	return example.DummyResourceInfo.GetSingularName()
}

func (s *expressionStorage) NewList() runtime.Object {
	return s.store.NewListFunc()
}

func (s *expressionStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.store.TableConvertor.ConvertToTable(ctx, object, tableOptions)
}

func (s *expressionStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	return s.exprs, nil
}
