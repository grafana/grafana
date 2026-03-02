package app

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
	"golang.org/x/sync/errgroup"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/apps/plugins/pkg/app/meta"
	"github.com/grafana/grafana/apps/plugins/pkg/app/metrics"
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
	logger        logging.Logger

	gr             schema.GroupResource
	tableConverter rest.TableConvertor
}

func NewMetaStorage(
	logger logging.Logger,
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
		logger:         logger,
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

	logger := s.logger.WithContext(ctx).With("requestNamespace", ns.Value)

	pluginClient, err := s.getClient(ctx)
	if err != nil {
		metrics.APIRequestsTotal.WithLabelValues("list", "error").Inc()
		return nil, apierrors.NewInternalError(fmt.Errorf("failed to get plugin client: %w", err))
	}

	plugins, err := pluginClient.ListAll(ctx, ns.Value, resource.ListOptions{})
	if err != nil {
		logger.Error("Failed to list plugins", "error", err)
		metrics.APIRequestsTotal.WithLabelValues("list", "error").Inc()
		return nil, apierrors.NewInternalError(fmt.Errorf("failed to list plugins: %w", err))
	}

	// Resolve metadata for all plugins concurrently.
	// Results are written into a fixed-size slice so ordering is preserved
	// and no mutex is needed on the output. Nil entries are plugins whose
	// metadata lookup failed.
	results := make([]*pluginsv0alpha1.Meta, len(plugins.Items))

	g, gCtx := errgroup.WithContext(ctx)
	g.SetLimit(10)
	for i, plugin := range plugins.Items {
		g.Go(func() error {
			result, err := s.metaManager.GetMeta(gCtx, meta.PluginRef{
				ID:       plugin.Spec.Id,
				Version:  plugin.Spec.Version,
				ParentID: plugin.Spec.ParentId,
			})
			if err != nil {
				logger.Warn("Failed to fetch metadata for plugin", "pluginId", plugin.Spec.Id, "version", plugin.Spec.Version, "error", err)
				return nil
			}

			m := &pluginsv0alpha1.Meta{
				ObjectMeta: metav1.ObjectMeta{
					Name:      plugin.Name,
					Namespace: plugin.Namespace,
				},
				Spec: result.Meta,
			}
			m.SetGroupVersionKind(schema.GroupVersionKind{
				Group:   pluginsv0alpha1.APIGroup,
				Version: pluginsv0alpha1.APIVersion,
				Kind:    pluginsv0alpha1.MetaKind().Kind(),
			})
			results[i] = m
			return nil
		})
	}

	if err = g.Wait(); err != nil {
		return nil, err
	}

	metaItems := make([]pluginsv0alpha1.Meta, 0, len(results))
	for _, r := range results {
		if r != nil {
			metaItems = append(metaItems, *r)
		}
	}

	list := &pluginsv0alpha1.MetaList{
		TypeMeta: metav1.TypeMeta{
			APIVersion: pluginsv0alpha1.APIGroup + "/" + pluginsv0alpha1.APIVersion,
			Kind:       pluginsv0alpha1.MetaKind().Kind() + "List",
		},
		Items: metaItems,
	}

	metrics.APIRequestsTotal.WithLabelValues("list", "success").Inc()
	return list, nil
}

func (s *MetaStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	logger := s.logger.WithContext(ctx).With("requestNamespace", ns.Value)

	pluginClient, err := s.getClient(ctx)
	if err != nil {
		metrics.APIRequestsTotal.WithLabelValues("get", "error").Inc()
		return nil, apierrors.NewInternalError(fmt.Errorf("failed to get plugin client: %w", err))
	}

	plugin, err := pluginClient.Get(ctx, resource.Identifier{
		Namespace: ns.Value,
		Name:      name,
	})
	if err != nil {
		metrics.APIRequestsTotal.WithLabelValues("get", "error").Inc()
		return nil, err
	}

	result, err := s.metaManager.GetMeta(ctx, meta.PluginRef{
		ID:       plugin.Spec.Id,
		Version:  plugin.Spec.Version,
		ParentID: plugin.Spec.ParentId,
	})
	if err != nil {
		if errors.Is(err, meta.ErrMetaNotFound) {
			gr := schema.GroupResource{
				Group:    pluginsv0alpha1.APIGroup,
				Resource: name,
			}
			metrics.APIRequestsTotal.WithLabelValues("get", "error").Inc()
			return nil, apierrors.NewNotFound(gr, plugin.Spec.Id)
		}

		logger.Error("Failed to fetch plugin metadata", "pluginId", plugin.Spec.Id, "version", plugin.Spec.Version, "error", err)
		metrics.APIRequestsTotal.WithLabelValues("get", "error").Inc()
		return nil, apierrors.NewInternalError(fmt.Errorf("failed to fetch plugin metadata: %w", err))
	}

	pluginMeta := &pluginsv0alpha1.Meta{
		ObjectMeta: metav1.ObjectMeta{
			Name:      plugin.Name,
			Namespace: plugin.Namespace,
		},
		Spec: result.Meta,
	}
	pluginMeta.SetGroupVersionKind(schema.GroupVersionKind{
		Group:   pluginsv0alpha1.APIGroup,
		Version: pluginsv0alpha1.APIVersion,
		Kind:    pluginsv0alpha1.MetaKind().Kind(),
	})

	metrics.APIRequestsTotal.WithLabelValues("get", "success").Inc()
	return pluginMeta, nil
}
