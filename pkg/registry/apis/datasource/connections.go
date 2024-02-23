package datasource

import (
	"context"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

var (
	_ rest.Scoper               = (*connectionAccess)(nil)
	_ rest.SingularNameProvider = (*connectionAccess)(nil)
	_ rest.Getter               = (*connectionAccess)(nil)
	_ rest.Lister               = (*connectionAccess)(nil)
	_ rest.Storage              = (*connectionAccess)(nil)
)

type connectionAccess struct {
	pluginID       string
	resourceInfo   common.ResourceInfo
	tableConverter rest.TableConvertor
	datasources    PluginDatasourceProvider
}

func (s *connectionAccess) New() runtime.Object {
	return s.resourceInfo.NewFunc()
}

func (s *connectionAccess) Destroy() {}

func (s *connectionAccess) NamespaceScoped() bool {
	return true
}

func (s *connectionAccess) GetSingularName() string {
	return s.resourceInfo.GetSingularName()
}

func (s *connectionAccess) ShortNames() []string {
	return s.resourceInfo.GetShortNames()
}

func (s *connectionAccess) NewList() runtime.Object {
	return s.resourceInfo.NewListFunc()
}

func (s *connectionAccess) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *connectionAccess) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	return s.datasources.Get(ctx, s.pluginID, name)
}

func (s *connectionAccess) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	return s.datasources.List(ctx, s.pluginID)
}
