package query

import (
	"context"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	example "github.com/grafana/grafana/pkg/apis/example/v0alpha1"
	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
)

var (
	_ rest.Storage              = (*pluginsStorage)(nil)
	_ rest.Scoper               = (*pluginsStorage)(nil)
	_ rest.SingularNameProvider = (*pluginsStorage)(nil)
	_ rest.Lister               = (*pluginsStorage)(nil)
)

type pluginsStorage struct {
	resourceInfo   *common.ResourceInfo
	tableConverter rest.TableConvertor
	registry       query.DataSourceApiServerRegistry
}

func newPluginsStorage(reg query.DataSourceApiServerRegistry) *pluginsStorage {
	var resourceInfo = query.DataSourceApiServerResourceInfo
	return &pluginsStorage{
		resourceInfo:   &resourceInfo,
		tableConverter: rest.NewDefaultTableConvertor(resourceInfo.GroupResource()),
		registry:       reg,
	}
}

func (s *pluginsStorage) New() runtime.Object {
	return s.resourceInfo.NewFunc()
}

func (s *pluginsStorage) Destroy() {}

func (s *pluginsStorage) NamespaceScoped() bool {
	return false
}

func (s *pluginsStorage) GetSingularName() string {
	return example.DummyResourceInfo.GetSingularName()
}

func (s *pluginsStorage) NewList() runtime.Object {
	return s.resourceInfo.NewListFunc()
}

func (s *pluginsStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *pluginsStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	return s.registry.GetDatasourceApiServers(ctx)
}
