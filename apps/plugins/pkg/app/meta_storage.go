package app

import (
	"context"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"

	claims "github.com/grafana/authlib/types"
	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
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
	gr             schema.GroupResource
	namespacer     claims.NamespaceFormatter
	tableConverter rest.TableConvertor
}

func NewPluginMetaStorage(
	namespacer claims.NamespaceFormatter,
) *PluginMetaStorage {
	gr := schema.GroupResource{
		Group:    pluginsv0alpha1.PluginMetaKind().Group(),
		Resource: strings.ToLower(pluginsv0alpha1.PluginMetaKind().Plural()),
	}
	return &PluginMetaStorage{
		gr:             gr,
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
	return s.NewList(), nil
}

func (s *PluginMetaStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	return nil, apierrors.NewNotFound(s.gr, name)
}
