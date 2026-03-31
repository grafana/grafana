package install

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana-app-sdk/logging"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
)

var (
	_ rest.Scoper               = (*PluginStorage)(nil)
	_ rest.SingularNameProvider = (*PluginStorage)(nil)
	_ rest.Getter               = (*PluginStorage)(nil)
	_ rest.Lister               = (*PluginStorage)(nil)
	_ rest.Storage              = (*PluginStorage)(nil)
	_ rest.Creater              = (*PluginStorage)(nil)
	_ rest.Updater              = (*PluginStorage)(nil)
	_ rest.GracefulDeleter      = (*PluginStorage)(nil)
	_ rest.TableConvertor       = (*PluginStorage)(nil)
)

// delegateStore is the combined interface the underlying SDK storage must satisfy.
type delegateStore interface {
	rest.Storage
	rest.Getter
	rest.Lister
	rest.CreaterUpdater
	rest.GracefulDeleter
}

type PluginStorage struct {
	installManager  InstallManager
	delegateStorage delegateStore
	logger          logging.Logger
	gr              schema.GroupResource
	tableConverter  rest.TableConvertor
}

func NewPluginStorage(
	logger logging.Logger,
	installManager InstallManager,
) *PluginStorage {
	gr := schema.GroupResource{
		Group:    pluginsv0alpha1.APIGroup,
		Resource: strings.ToLower(pluginsv0alpha1.PluginKind().Plural()),
	}

	return &PluginStorage{
		installManager: installManager,
		logger:         logger,
		gr:             gr,
		tableConverter: rest.NewDefaultTableConvertor(gr),
	}
}

// SetDelegateStorage wires in the underlying SDK storage after it has been
// captured by the customStorageWrapper. List/Get and persistence operations
// delegate directly to this storage, avoiding loopback HTTP calls.
func (s *PluginStorage) SetDelegateStorage(delegate rest.Storage) error {
	store, ok := delegate.(delegateStore)
	if !ok {
		return fmt.Errorf("delegate storage %T does not implement required interfaces (Getter, Lister, Creater, Updater, GracefulDeleter)", delegate)
	}
	s.delegateStorage = store
	return nil
}

func (s *PluginStorage) delegate() (delegateStore, error) {
	if s.delegateStorage == nil {
		return nil, apierrors.NewServiceUnavailable("plugin storage not yet initialized")
	}
	return s.delegateStorage, nil
}

func (s *PluginStorage) New() runtime.Object {
	return pluginsv0alpha1.PluginKind().ZeroValue()
}

func (s *PluginStorage) Destroy() {}

func (s *PluginStorage) NamespaceScoped() bool {
	return true
}

func (s *PluginStorage) GetSingularName() string {
	return strings.ToLower(pluginsv0alpha1.PluginKind().Kind())
}

func (s *PluginStorage) NewList() runtime.Object {
	return pluginsv0alpha1.PluginKind().ZeroListValue()
}

func (s *PluginStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *PluginStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	delegate, err := s.delegate()
	if err != nil {
		return nil, err
	}
	return delegate.List(ctx, options)
}

func (s *PluginStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	delegate, err := s.delegate()
	if err != nil {
		return nil, err
	}
	return delegate.Get(ctx, name, options)
}

func (s *PluginStorage) Create(ctx context.Context,
	obj runtime.Object,
	createValidation rest.ValidateObjectFunc,
	options *metav1.CreateOptions,
) (runtime.Object, error) {
	plugin, ok := obj.(*pluginsv0alpha1.Plugin)
	if !ok {
		return nil, fmt.Errorf("expected Plugin object")
	}

	logger := s.logger.WithContext(ctx).With("pluginId", plugin.Spec.Id, "version", plugin.Spec.Version)

	if createValidation != nil {
		if err := createValidation(ctx, obj); err != nil {
			return nil, err
		}
	}

	delegate, err := s.delegate()
	if err != nil {
		return nil, err
	}

	logger.Info("Installing plugin")
	if err := s.installManager.Install(ctx, plugin); err != nil {
		logger.Error("Failed to install plugin", "error", err)
		return nil, apierrors.NewInternalError(fmt.Errorf("failed to install plugin: %w", err))
	}

	created, err := delegate.Create(ctx, obj, nil, options)
	if err != nil {
		logger.Warn("Failed to create plugin resource after successful install, attempting cleanup", "error", err)
		if removeErr := s.installManager.Uninstall(ctx, plugin); removeErr != nil {
			logger.Error("Failed to cleanup plugin after resource creation failure", "cleanupError", removeErr)
		}
		return nil, err
	}

	logger.Info("Successfully installed and created plugin resource")
	return created, nil
}

func (s *PluginStorage) Update(ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	createValidation rest.ValidateObjectFunc,
	updateValidation rest.ValidateObjectUpdateFunc,
	forceAllowCreate bool,
	options *metav1.UpdateOptions,
) (runtime.Object, bool, error) {
	delegate, err := s.delegate()
	if err != nil {
		return nil, false, err
	}

	// Wrap objInfo to intercept the old/new objects for lifecycle management.
	interceptor := &updateInterceptor{
		inner:          objInfo,
		installManager: s.installManager,
		logger:         s.logger.WithContext(ctx),
	}

	return delegate.Update(ctx, name, interceptor, createValidation, updateValidation, forceAllowCreate, options)
}

func (s *PluginStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	obj, err := s.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, false, err
	}

	plugin, ok := obj.(*pluginsv0alpha1.Plugin)
	if !ok {
		return nil, false, fmt.Errorf("expected Plugin object")
	}

	logger := s.logger.WithContext(ctx).With("pluginId", plugin.Spec.Id, "version", plugin.Spec.Version)

	if deleteValidation != nil {
		if err := deleteValidation(ctx, obj); err != nil {
			return nil, false, err
		}
	}

	delegate, err := s.delegate()
	if err != nil {
		return nil, false, err
	}

	logger.Info("Uninstalling plugin")
	if err := s.installManager.Uninstall(ctx, plugin); err != nil {
		logger.Error("Failed to uninstall plugin", "error", err)
		return nil, false, apierrors.NewInternalError(fmt.Errorf("failed to uninstall plugin: %w", err))
	}

	result, deleted, err := delegate.Delete(ctx, name, nil, options)
	if err != nil {
		logger.Error("Failed to delete plugin resource after successful uninstall", "error", err)
		return nil, false, err
	}

	logger.Info("Successfully uninstalled plugin and deleted resource")
	return result, deleted, nil
}

// updateInterceptor wraps rest.UpdatedObjectInfo to call the install manager
// when the new object is resolved, so the delegate storage handles persistence.
type updateInterceptor struct {
	inner          rest.UpdatedObjectInfo
	installManager InstallManager
	logger         logging.Logger
	called         bool
}

var _ rest.UpdatedObjectInfo = (*updateInterceptor)(nil)

func (u *updateInterceptor) Preconditions() *metav1.Preconditions {
	return u.inner.Preconditions()
}

func (u *updateInterceptor) UpdatedObject(ctx context.Context, oldObj runtime.Object) (runtime.Object, error) {
	newObj, err := u.inner.UpdatedObject(ctx, oldObj)
	if err != nil {
		return nil, err
	}

	if u.called {
		return newObj, nil
	}
	u.called = true

	oldPlugin, ok := oldObj.(*pluginsv0alpha1.Plugin)
	if !ok {
		return nil, apierrors.NewInternalError(fmt.Errorf("expected Plugin object for old object"))
	}
	newPlugin, ok := newObj.(*pluginsv0alpha1.Plugin)
	if !ok {
		return nil, apierrors.NewInternalError(fmt.Errorf("expected Plugin object for new object"))
	}

	if err = u.installManager.Update(ctx, oldPlugin, newPlugin); err != nil {
		u.logger.Error("Failed to update plugin", "error", err,
			"pluginId", newPlugin.Spec.Id,
			"oldVersion", oldPlugin.Spec.Version,
			"newVersion", newPlugin.Spec.Version,
		)
		return nil, apierrors.NewInternalError(fmt.Errorf("failed to update plugin: %w", err))
	}

	return newObj, nil
}
