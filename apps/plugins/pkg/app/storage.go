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

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/apps/plugins/pkg/app/meta"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

var (
	_ rest.Scoper               = (*MetaStorage)(nil)
	_ rest.SingularNameProvider = (*MetaStorage)(nil)
	_ rest.Getter               = (*MetaStorage)(nil)
	_ rest.Lister               = (*MetaStorage)(nil)
	_ rest.Storage              = (*MetaStorage)(nil)
	_ rest.TableConvertor       = (*MetaStorage)(nil)
)

type MetaStorage struct {
	metaManager   *meta.ProviderManager
	client        *pluginsv0alpha1.PluginClient
	clientFactory func(context.Context) (*pluginsv0alpha1.PluginClient, error)
	clientErr     error
	clientOnce    sync.Once

	gr             schema.GroupResource
	tableConverter rest.TableConvertor
}

func NewMetaStorage(
	metaManager *meta.ProviderManager,
	clientFactory func(context.Context) (*pluginsv0alpha1.PluginClient, error),
) *MetaStorage {
	gr := schema.GroupResource{
		Group:    pluginsv0alpha1.APIGroup,
		Resource: strings.ToLower(pluginsv0alpha1.MetaKind().Plural()),
	}

	return &MetaStorage{
		metaManager:    metaManager,
		clientFactory:  clientFactory,
		gr:             gr,
		tableConverter: rest.NewDefaultTableConvertor(gr),
	}
}

func (s *MetaStorage) getClient(ctx context.Context) (*pluginsv0alpha1.PluginClient, error) {
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

func (s *MetaStorage) New() runtime.Object {
	return pluginsv0alpha1.MetaKind().ZeroValue()
}

func (s *MetaStorage) Destroy() {}

func (s *MetaStorage) NamespaceScoped() bool {
	return true
}

func (s *MetaStorage) GetSingularName() string {
	return strings.ToLower(pluginsv0alpha1.MetaKind().Kind())
}

func (s *MetaStorage) NewList() runtime.Object {
	return pluginsv0alpha1.MetaKind().ZeroListValue()
}

func (s *MetaStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *MetaStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
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

	// Convert each Plugin to Meta
	metaItems := make([]pluginsv0alpha1.Meta, 0, len(plugins.Items))
	for _, plugin := range plugins.Items {
		result, err := s.metaManager.GetMeta(ctx, plugin.Spec.Id, plugin.Spec.Version)
		if err != nil {
			// Log error but continue with other plugins
			logging.DefaultLogger.Warn("Failed to fetch metadata for plugin", "pluginId", plugin.Spec.Id, "version", plugin.Spec.Version, "error", err)
			continue
		}

		pluginMeta := createMetaFromMetaJSONData(result.Meta, plugin.Name, plugin.Namespace)
		metaItems = append(metaItems, *pluginMeta)
	}

	list := &pluginsv0alpha1.MetaList{
		TypeMeta: metav1.TypeMeta{
			APIVersion: pluginsv0alpha1.APIGroup + "/" + pluginsv0alpha1.APIVersion,
			Kind:       pluginsv0alpha1.MetaKind().Kind() + "List",
		},
		Items: metaItems,
	}

	return list, nil
}

func (s *MetaStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
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

	return createMetaFromMetaJSONData(result.Meta, name, ns.Value), nil
}

// createMetaFromMetaJSONData creates a Meta k8s object from MetaJSONData and plugin metadata.
func createMetaFromMetaJSONData(pluginJSON pluginsv0alpha1.MetaJSONData, name, namespace string) *pluginsv0alpha1.Meta {
	pluginMeta := &pluginsv0alpha1.Meta{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
		},
		Spec: pluginsv0alpha1.MetaSpec{
			PluginJSON: pluginJSON,
		},
	}

	// Set the GroupVersionKind
	pluginMeta.SetGroupVersionKind(schema.GroupVersionKind{
		Group:   pluginsv0alpha1.APIGroup,
		Version: pluginsv0alpha1.APIVersion,
		Kind:    pluginsv0alpha1.MetaKind().Kind(),
	})

	return pluginMeta
}
