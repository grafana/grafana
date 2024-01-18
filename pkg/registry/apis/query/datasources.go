package query

import (
	"context"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	common "github.com/grafana/grafana/pkg/apis/common/v0alpha1"
	example "github.com/grafana/grafana/pkg/apis/example/v0alpha1"
	"github.com/grafana/grafana/pkg/apis/query/v0alpha1"
)

var (
	_ rest.Storage              = (*dataSourceStorage)(nil)
	_ rest.Scoper               = (*dataSourceStorage)(nil)
	_ rest.SingularNameProvider = (*dataSourceStorage)(nil)
	_ rest.Lister               = (*dataSourceStorage)(nil)
)

type dataSourceStorage struct {
	resourceInfo   *common.ResourceInfo
	tableConverter rest.TableConvertor
	cache          *registry
}

func newDataSourceStorage(reg *registry) *dataSourceStorage {
	var resourceInfo = v0alpha1.DataSourceResourceInfo
	return &dataSourceStorage{
		resourceInfo:   &resourceInfo,
		tableConverter: rest.NewDefaultTableConvertor(resourceInfo.GroupResource()),
		cache:          reg,
	}
}

func (s *dataSourceStorage) New() runtime.Object {
	return s.resourceInfo.NewFunc()
}

func (s *dataSourceStorage) Destroy() {}

func (s *dataSourceStorage) NamespaceScoped() bool {
	return true
}

func (s *dataSourceStorage) GetSingularName() string {
	return example.DummyResourceInfo.GetSingularName()
}

func (s *dataSourceStorage) NewList() runtime.Object {
	return s.resourceInfo.NewListFunc()
}

func (s *dataSourceStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *dataSourceStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	datasources, err := s.cache.GetDataSources(ctx, options)
	if err != nil {
		return nil, err
	}
	viewable := &v0alpha1.DataSourceList{ListMeta: datasources.ListMeta}
	for _, item := range datasources.Items {
		// TODO: access control on the datasources
		if true {
			viewable.Items = append(viewable.Items, item)
		}
	}
	return viewable, err
}
