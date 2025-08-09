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

type PluginRegistry interface {
	Plugin(ctx context.Context, name string) (*pluginsv0alpha1.PluginInstall, bool)
	Plugins(ctx context.Context) []pluginsv0alpha1.PluginInstall
}

var (
	_ rest.Scoper               = (*PluginInstallStorage)(nil)
	_ rest.SingularNameProvider = (*PluginInstallStorage)(nil)
	_ rest.Getter               = (*PluginInstallStorage)(nil)
	_ rest.Lister               = (*PluginInstallStorage)(nil)
	_ rest.Storage              = (*PluginInstallStorage)(nil)
	_ rest.TableConvertor       = (*PluginInstallStorage)(nil)
)

type PluginInstallStorage struct {
	gr             schema.GroupResource
	namespacer     claims.NamespaceFormatter
	tableConverter rest.TableConvertor
	pluginRegistry PluginRegistry
}

func NewPluginInstallStorage(
	namespacer claims.NamespaceFormatter,
	pluginRegistry PluginRegistry,
) *PluginInstallStorage {
	gr := schema.GroupResource{
		Group:    pluginsv0alpha1.PluginInstallKind().Group(),
		Resource: strings.ToLower(pluginsv0alpha1.PluginInstallKind().Plural()),
	}
	return &PluginInstallStorage{
		gr:             gr,
		namespacer:     namespacer,
		tableConverter: rest.NewDefaultTableConvertor(gr),
		pluginRegistry: pluginRegistry,
	}
}

func (s *PluginInstallStorage) New() runtime.Object {
	return pluginsv0alpha1.PluginInstallKind().ZeroValue()
}

func (s *PluginInstallStorage) Destroy() {}

func (s *PluginInstallStorage) NamespaceScoped() bool {
	return true
}

func (s *PluginInstallStorage) GetSingularName() string {
	return strings.ToLower(pluginsv0alpha1.PluginInstallKind().Kind())
}

func (s *PluginInstallStorage) NewList() runtime.Object {
	return pluginsv0alpha1.PluginInstallKind().ZeroListValue()
}

func (s *PluginInstallStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *PluginInstallStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	list := s.NewList().(*pluginsv0alpha1.PluginInstallList)
	list.Items = s.pluginRegistry.Plugins(ctx)
	return list, nil
}

func (s *PluginInstallStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	plugin, ok := s.pluginRegistry.Plugin(ctx, name)
	if !ok {
		return nil, apierrors.NewNotFound(s.gr, name)
	}
	return plugin, nil
}
