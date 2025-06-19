package datasource

import (
	"context"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

var (
	_ rest.Scoper               = (*legacyStorage)(nil)
	_ rest.SingularNameProvider = (*legacyStorage)(nil)
	_ rest.Getter               = (*legacyStorage)(nil)
	_ rest.Lister               = (*legacyStorage)(nil)
	_ rest.Storage              = (*legacyStorage)(nil)
	// _ rest.Creater              = (*legacyStorage)(nil)
	// _ rest.Updater              = (*legacyStorage)(nil)
	// _ rest.GracefulDeleter      = (*legacyStorage)(nil)
)

type legacyStorage struct {
	datasources  PluginDatasourceProvider
	resourceInfo *utils.ResourceInfo
}

func (s *legacyStorage) New() runtime.Object {
	return s.resourceInfo.NewFunc()
}

func (s *legacyStorage) Destroy() {}

func (s *legacyStorage) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *legacyStorage) GetSingularName() string {
	return s.resourceInfo.GetSingularName()
}

func (s *legacyStorage) NewList() runtime.Object {
	return s.resourceInfo.NewListFunc()
}

func (s *legacyStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.resourceInfo.TableConverter().ConvertToTable(ctx, object, tableOptions)
}

func (s *legacyStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	return s.datasources.ListDataSource(ctx)
}

func (s *legacyStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	return s.datasources.GetDataSource(ctx, name)
}
