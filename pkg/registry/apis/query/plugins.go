package query

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
)

var (
	_ rest.Storage              = (*pluginsStorage)(nil)
	_ rest.Scoper               = (*pluginsStorage)(nil)
	_ rest.SingularNameProvider = (*pluginsStorage)(nil)
	_ rest.Lister               = (*pluginsStorage)(nil)
)

type pluginsStorage struct {
	resourceInfo   *utils.ResourceInfo
	tableConverter rest.TableConvertor
	registry       query.DataSourceApiServerRegistry

	// Always return an empty list regardless what we think exists
	returnEmptyList bool
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
	return s.resourceInfo.GetSingularName()
}

func (s *pluginsStorage) NewList() runtime.Object {
	return s.resourceInfo.NewListFunc()
}

func (s *pluginsStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *pluginsStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	if s.returnEmptyList {
		return s.NewList(), nil
	}
	return s.registry.GetDatasourceApiServers(ctx)
}
