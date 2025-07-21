package app

import (
	"context"
	"strings"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

var (
	_ rest.Scoper               = (*PluginMetaStorage)(nil)
	_ rest.SingularNameProvider = (*PluginMetaStorage)(nil)
	_ rest.Getter               = (*PluginMetaStorage)(nil)
	_ rest.Lister               = (*PluginMetaStorage)(nil)
	_ rest.Storage              = (*PluginMetaStorage)(nil)
	_ rest.TableConvertor       = (*PluginMetaStorage)(nil)
)

type PluginMetaStorage struct {
	namespacer     request.NamespaceMapper
	tableConverter rest.TableConvertor
}

func NewPluginMetaStorage(
	namespacer request.NamespaceMapper,
) *PluginMetaStorage {
	gr := schema.GroupResource{
		Group:    pluginsv0alpha1.PluginMetaKind().Group(),
		Resource: strings.ToLower(pluginsv0alpha1.PluginMetaKind().Plural()),
	}
	return &PluginMetaStorage{
		namespacer:     namespacer,
		tableConverter: rest.NewDefaultTableConvertor(gr),
	}
}

func (s *PluginMetaStorage) New() runtime.Object {
	return pluginsv0alpha1.PluginMetaKind().ZeroValue()
}

func (s *PluginMetaStorage) Destroy() {}

func (s *PluginMetaStorage) NamespaceScoped() bool {
	return true
}

func (s *PluginMetaStorage) GetSingularName() string {
	return strings.ToLower(pluginsv0alpha1.PluginMetaKind().Kind())
}

func (s *PluginMetaStorage) NewList() runtime.Object {
	return pluginsv0alpha1.PluginMetaKind().ZeroListValue()
}

func (s *PluginMetaStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *PluginMetaStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	obj, _ := s.Get(ctx, "grafana-example-plugin", &metav1.GetOptions{})
	exampleObj := obj.(*pluginsv0alpha1.PluginMeta)
	list := s.NewList().(*pluginsv0alpha1.PluginMetaList)
	list.Items = append(list.Items, *exampleObj)
	return list, nil
}

func (s *PluginMetaStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	exampleObj := s.New().(*pluginsv0alpha1.PluginMeta)
	exampleObj.Spec.PluginJSON.Id = name
	exampleObj.Spec.PluginJSON.Name = "Example Plugin"
	exampleObj.Spec.PluginJSON.Info.Version = "1.0.0"
	return exampleObj, nil
}
