package app

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"

	claims "github.com/grafana/authlib/types"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/apps/plugins/pkg/app/meta"
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
	metaManager   *meta.ProviderManager
	client        *pluginsv0alpha1.PluginClient
	clientFactory func(context.Context) (*pluginsv0alpha1.PluginClient, error)
	clientErr     error
	clientOnce    sync.Once

	gr             schema.GroupResource
	namespacer     claims.NamespaceFormatter
	tableConverter rest.TableConvertor
}

func NewPluginMetaStorage(
	metaManager *meta.ProviderManager,
	clientFactory func(context.Context) (*pluginsv0alpha1.PluginClient, error),
	namespacer claims.NamespaceFormatter,
) *PluginMetaStorage {
	gr := schema.GroupResource{
		Group:    pluginsv0alpha1.APIGroup,
		Resource: strings.ToLower(pluginsv0alpha1.PluginMetaKind().Plural()),
	}

	return &PluginMetaStorage{
		metaManager:    metaManager,
		clientFactory:  clientFactory,
		gr:             gr,
		namespacer:     namespacer,
		tableConverter: rest.NewDefaultTableConvertor(gr),
	}
}

func (s *PluginMetaStorage) getClient(ctx context.Context) (*pluginsv0alpha1.PluginClient, error) {
	s.clientOnce.Do(func() {
		client, err := s.clientFactory(ctx)
		if err != nil {
			s.clientErr = err
			s.client = nil
			return
		}
		s.client = client
	})

	return s.client, s.clientErr
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
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	pluginClient, err := s.getClient(ctx)
	if err != nil {
		return nil, apierrors.NewInternalError(fmt.Errorf("failed to get plugin client: %w", err))
	}

	plugins, err := pluginClient.ListAll(ctx, ns.Value, resource.ListOptions{})
	if err != nil {
		logging.DefaultLogger.Error("Failed to list plugins", "namespace", ns.Value, "error", err)
		return nil, apierrors.NewInternalError(fmt.Errorf("failed to list plugins: %w", err))
	}

	// Convert each Plugin to PluginMeta
	metaItems := make([]pluginsv0alpha1.PluginMeta, 0, len(plugins.Items))
	for _, plugin := range plugins.Items {
		result, err := s.metaManager.GetMeta(ctx, plugin.Spec.Id, plugin.Spec.Version)
		if err != nil {
			// Log error but continue with other plugins
			logging.DefaultLogger.Warn("Failed to fetch metadata for plugin", "pluginId", plugin.Spec.Id, "version", plugin.Spec.Version, "error", err)
			continue
		}

		pluginMeta := createPluginMetaFromSpec(result.Meta, plugin.Name, plugin.Namespace)
		metaItems = append(metaItems, *pluginMeta)
	}

	list := &pluginsv0alpha1.PluginMetaList{
		TypeMeta: metav1.TypeMeta{
			APIVersion: pluginsv0alpha1.APIGroup + "/" + pluginsv0alpha1.APIVersion,
			Kind:       pluginsv0alpha1.PluginMetaKind().Kind() + "List",
		},
		Items: metaItems,
	}

	return list, nil
}

func (s *PluginMetaStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	pluginClient, err := s.getClient(ctx)
	if err != nil {
		return nil, apierrors.NewInternalError(fmt.Errorf("failed to get plugin client: %w", err))
	}

	plugin, err := pluginClient.Get(ctx, resource.Identifier{
		Namespace: ns.Value,
		Name:      name,
	})
	if err != nil {
		return nil, err
	}

	result, err := s.metaManager.GetMeta(ctx, plugin.Spec.Id, plugin.Spec.Version)
	if err != nil {
		if errors.Is(err, meta.ErrMetaNotFound) {
			gr := schema.GroupResource{
				Group:    pluginsv0alpha1.APIGroup,
				Resource: name,
			}
			return nil, apierrors.NewNotFound(gr, plugin.Spec.Id)
		}

		logging.DefaultLogger.Error("Failed to fetch plugin metadata", "pluginId", plugin.Spec.Id, "version", plugin.Spec.Version, "error", err)
		return nil, apierrors.NewInternalError(fmt.Errorf("failed to fetch plugin metadata: %w", err))
	}

	return createPluginMetaFromSpec(result.Meta, name, ns.Value), nil
}

// createPluginMetaFromSpec creates a PluginMeta k8s object from PluginMetaSpec and plugin metadata.
func createPluginMetaFromSpec(spec pluginsv0alpha1.PluginMetaSpec, name, namespace string) *pluginsv0alpha1.PluginMeta {
	pluginMeta := &pluginsv0alpha1.PluginMeta{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
		},
		Spec: spec,
	}

	// Set the GroupVersionKind
	pluginMeta.SetGroupVersionKind(schema.GroupVersionKind{
		Group:   pluginsv0alpha1.APIGroup,
		Version: pluginsv0alpha1.APIVersion,
		Kind:    pluginsv0alpha1.PluginMetaKind().Kind(),
	})

	return pluginMeta
}
