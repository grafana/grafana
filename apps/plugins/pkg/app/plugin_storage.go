package app

import (
	"context"
	"fmt"
	"sync"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	errorsK8s "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/watch"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/apps/plugins/pkg/app/install"
	"github.com/grafana/grafana/apps/plugins/pkg/app/meta"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
)

type pluginResourceStorage interface {
	rest.Storage
	rest.Scoper
	rest.SingularNameProvider
	rest.Lister
	rest.Getter
	rest.CreaterUpdater
	rest.GracefulDeleter
	rest.CollectionDeleter
	rest.TableConvertor
}

var (
	_ rest.Storage              = (*PluginStorage)(nil)
	_ rest.Watcher              = (*PluginStorage)(nil)
	_ install.Registrar         = (*clientFactoryRegistrar)(nil)
	_ pluginResourceStorage     = (*PluginStorage)(nil)
	_ rest.SingularNameProvider = (*PluginStorage)(nil)
)

type PluginStorage struct {
	inner           pluginResourceStorage
	childReconciler *install.ChildPluginReconciler
	logger          logging.Logger
}

func NewPluginStorage(
	logger logging.Logger,
	metaManager *meta.ProviderManager,
	clientFactory func(context.Context) (*pluginsv0alpha1.PluginClient, error),
	gr schema.GroupResource,
	storage rest.Storage,
) (rest.Storage, error) {
	inner, ok := storage.(pluginResourceStorage)
	if !ok {
		return nil, fmt.Errorf("plugins storage does not implement required interfaces: %T", storage)
	}
	store, ok := inner.(*genericregistry.Store)
	if !ok {
		logger.Warn("plugins storage wrapper expected *genericregistry.Store, skipping key function override", "storageType", fmt.Sprintf("%T", inner))
	} else {
		store.KeyFunc = grafanaregistry.NamespaceKeyFunc(gr)
		store.KeyRootFunc = grafanaregistry.KeyRootFunc(gr)
	}

	registrar := &clientFactoryRegistrar{
		clientFactory: clientFactory,
	}
	childReconciler := install.NewChildPluginReconciler(logger, metaManager, registrar)

	return &PluginStorage{
		inner:           inner,
		childReconciler: childReconciler,
		logger:          logger,
	}, nil
}

func (s *PluginStorage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	createdObj, err := s.inner.Create(ctx, obj, createValidation, options)
	if err != nil {
		return createdObj, err
	}
	if options != nil && len(options.DryRun) > 0 {
		return createdObj, nil
	}
	s.reconcileChildren(ctx, createdObj, operator.ReconcileActionCreated)
	return createdObj, nil
}

func (s *PluginStorage) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	updatedObj, created, err := s.inner.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
	if err != nil {
		return updatedObj, created, err
	}
	if options != nil && len(options.DryRun) > 0 {
		return updatedObj, created, nil
	}

	action := operator.ReconcileActionUpdated
	if created {
		action = operator.ReconcileActionCreated
	}
	s.reconcileChildren(ctx, updatedObj, action)
	return updatedObj, created, nil
}

func (s *PluginStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	return s.inner.Delete(ctx, name, deleteValidation, options)
}

func (s *PluginStorage) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return s.inner.DeleteCollection(ctx, deleteValidation, options, listOptions)
}

func (s *PluginStorage) Watch(ctx context.Context, options *internalversion.ListOptions) (watch.Interface, error) {
	watcher, ok := s.inner.(rest.Watcher)
	if !ok {
		return nil, fmt.Errorf("watch is not supported on the underlying plugins storage")
	}
	return watcher.Watch(ctx, options)
}

func (s *PluginStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.inner.ConvertToTable(ctx, object, tableOptions)
}

func (s *PluginStorage) New() runtime.Object {
	return s.inner.New()
}

func (s *PluginStorage) NewList() runtime.Object {
	return s.inner.NewList()
}

func (s *PluginStorage) Destroy() {
	s.inner.Destroy()
}

func (s *PluginStorage) NamespaceScoped() bool {
	return s.inner.NamespaceScoped()
}

func (s *PluginStorage) GetSingularName() string {
	return s.inner.GetSingularName()
}

func (s *PluginStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	return s.inner.List(ctx, options)
}

func (s *PluginStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	return s.inner.Get(ctx, name, options)
}

func (s *PluginStorage) reconcileChildren(ctx context.Context, obj runtime.Object, action operator.ReconcileAction) {
	plugin, ok := obj.(*pluginsv0alpha1.Plugin)
	if !ok {
		s.logger.Warn("Skipping child plugin reconcile for unexpected type", "objectType", fmt.Sprintf("%T", obj), "action", action)
		return
	}

	result, err := s.childReconciler.ReconcilePlugin(ctx, action, plugin)
	if err != nil {
		s.logger.Error("Child plugin reconcile failed after plugin write", "error", err, "pluginId", plugin.Spec.Id, "version", plugin.Spec.Version, "action", action)
		return
	}
	if result.RequeueAfter != nil {
		s.logger.Warn("Child plugin reconcile incomplete after plugin write", "pluginId", plugin.Spec.Id, "version", plugin.Spec.Version, "action", action, "retryAfter", result.RequeueAfter.String())
	}
}

type clientFactoryRegistrar struct {
	clientFactory func(context.Context) (*pluginsv0alpha1.PluginClient, error)
	client        *pluginsv0alpha1.PluginClient
	clientErr     error
	clientOnce    sync.Once
}

func (r *clientFactoryRegistrar) getClient(ctx context.Context) (*pluginsv0alpha1.PluginClient, error) {
	r.clientOnce.Do(func() {
		client, err := r.clientFactory(ctx)
		if err != nil {
			r.clientErr = err
			return
		}
		r.client = client
	})
	return r.client, r.clientErr
}

func (r *clientFactoryRegistrar) Register(ctx context.Context, namespace string, pluginInstall *install.PluginInstall) error {
	client, err := r.getClient(ctx)
	if err != nil {
		return err
	}
	identifier := resource.Identifier{
		Namespace: namespace,
		Name:      pluginInstall.ID,
	}

	existing, err := client.Get(ctx, identifier)
	if err != nil && !errorsK8s.IsNotFound(err) {
		return err
	}

	if existing != nil {
		if !pluginInstall.ShouldUpdate(existing) {
			return nil
		}
		_, err = client.Update(ctx, pluginInstall.ToPluginInstallV0Alpha1(namespace), resource.UpdateOptions{ResourceVersion: existing.ResourceVersion})
		return err
	}

	_, err = client.Create(ctx, pluginInstall.ToPluginInstallV0Alpha1(namespace), resource.CreateOptions{})
	return err
}

func (r *clientFactoryRegistrar) Unregister(ctx context.Context, namespace string, name string, source install.Source) error {
	client, err := r.getClient(ctx)
	if err != nil {
		return err
	}
	identifier := resource.Identifier{
		Namespace: namespace,
		Name:      name,
	}
	existing, err := client.Get(ctx, identifier)
	if err != nil && !errorsK8s.IsNotFound(err) {
		return err
	}
	if existing == nil {
		return nil
	}
	if existingSource, ok := existing.Annotations[install.PluginInstallSourceAnnotation]; ok && existingSource != source {
		return nil
	}
	return client.Delete(ctx, identifier, resource.DeleteOptions{})
}
