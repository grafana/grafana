package install

import (
	"context"
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
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
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

type PluginStorage struct {
	installManager InstallManager
	client         *pluginsv0alpha1.PluginClient
	clientFactory  func(context.Context) (*pluginsv0alpha1.PluginClient, error)
	clientErr      error
	clientOnce     sync.Once
	logger         logging.Logger
	gr             schema.GroupResource
	tableConverter rest.TableConvertor
}

func NewPluginStorage(
	logger logging.Logger,
	installManager InstallManager,
	clientFactory func(context.Context) (*pluginsv0alpha1.PluginClient, error),
) *PluginStorage {
	gr := schema.GroupResource{
		Group:    pluginsv0alpha1.APIGroup,
		Resource: strings.ToLower(pluginsv0alpha1.PluginKind().Plural()),
	}

	return &PluginStorage{
		installManager: installManager,
		clientFactory:  clientFactory,
		logger:         logger,
		gr:             gr,
		tableConverter: rest.NewDefaultTableConvertor(gr),
	}
}

func (s *PluginStorage) getClient(ctx context.Context) (*pluginsv0alpha1.PluginClient, error) {
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
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	client, err := s.getClient(ctx)
	if err != nil {
		return nil, apierrors.NewInternalError(fmt.Errorf("failed to get plugin client: %w", err))
	}

	ps, err := client.ListAll(ctx, ns.Value, resource.ListOptions{})
	if err != nil {
		return nil, apierrors.NewInternalError(fmt.Errorf("failed to list plugins: %w", err))
	}

	return ps, nil
}

func (s *PluginStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	client, err := s.getClient(ctx)
	if err != nil {
		return nil, apierrors.NewInternalError(fmt.Errorf("failed to get plugin client: %w", err))
	}

	p, err := client.Get(ctx, resource.Identifier{
		Namespace: ns.Value,
		Name:      name,
	})
	if err != nil {
		return nil, err
	}

	return p, nil
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

	// Validate the object if a validation function is provided
	if createValidation != nil {
		if err := createValidation(ctx, obj); err != nil {
			return nil, err
		}
	}

	// Install the plugin using the install manager
	logger.Info("Installing plugin")
	err := s.installManager.Install(ctx, plugin)
	if err != nil {
		logger.Error("Failed to install plugin", "error", err)
		return nil, apierrors.NewInternalError(fmt.Errorf("failed to install plugin: %w", err))
	}

	// Create the resource in storage
	client, err := s.getClient(ctx)
	if err != nil {
		return nil, apierrors.NewInternalError(fmt.Errorf("failed to get plugin client: %w", err))
	}

	created, err := client.Create(ctx, plugin, resource.CreateOptions{})
	if err != nil {
		// If resource creation fails after successful install, we should try to cleanup
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
	// Get the current plugin
	oldObj, err := s.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, false, err
	}

	oldPlugin, ok := oldObj.(*pluginsv0alpha1.Plugin)
	if !ok {
		return nil, false, fmt.Errorf("expected Plugin object")
	}

	// Get the updated object
	newObj, err := objInfo.UpdatedObject(ctx, oldObj)
	if err != nil {
		return nil, false, err
	}

	newPlugin, ok := newObj.(*pluginsv0alpha1.Plugin)
	if !ok {
		return nil, false, fmt.Errorf("expected Plugin object")
	}

	logger := s.logger.WithContext(ctx).With(
		"pluginId", newPlugin.Spec.Id,
		"oldVersion", oldPlugin.Spec.Version,
		"newVersion", newPlugin.Spec.Version,
	)

	// Validate the update if a validation function is provided
	if updateValidation != nil {
		if err := updateValidation(ctx, newObj, oldObj); err != nil {
			return nil, false, err
		}
	}

	// Update the plugin using the install manager
	err = s.installManager.Update(ctx, oldPlugin, newPlugin)
	if err != nil {
		logger.Error("Failed to update plugin", "error", err)
		return nil, false, apierrors.NewInternalError(fmt.Errorf("failed to update plugin: %w", err))
	}

	// Update the resource in storage
	pluginClient, err := s.getClient(ctx)
	if err != nil {
		return nil, false, apierrors.NewInternalError(fmt.Errorf("failed to get plugin client: %w", err))
	}

	updated, err := pluginClient.Update(ctx, newPlugin, resource.UpdateOptions{})
	if err != nil {
		return nil, false, err
	}

	logger.Info("Successfully updated plugin resource")
	return updated, false, nil
}

func (s *PluginStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	// Get the plugin to retrieve its spec before deletion
	obj, err := s.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, false, err
	}

	plugin, ok := obj.(*pluginsv0alpha1.Plugin)
	if !ok {
		return nil, false, fmt.Errorf("expected Plugin object")
	}

	logger := s.logger.WithContext(ctx).With("pluginId", plugin.Spec.Id, "version", plugin.Spec.Version)

	// Validate the deletion if a validation function is provided
	if deleteValidation != nil {
		if err := deleteValidation(ctx, obj); err != nil {
			return nil, false, err
		}
	}

	// Uninstall the plugin FIRST before deleting the resource
	// This ensures we don't end up in a state where the resource is deleted but the plugin is still installed
	logger.Info("Uninstalling plugin")
	err = s.installManager.Uninstall(ctx, plugin)
	if err != nil {
		logger.Error("Failed to uninstall plugin", "error", err)
		return nil, false, apierrors.NewInternalError(fmt.Errorf("failed to uninstall plugin: %w", err))
	}

	// Delete the resource from storage after successful uninstallation
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}

	pluginClient, err := s.getClient(ctx)
	if err != nil {
		return nil, false, apierrors.NewInternalError(fmt.Errorf("failed to get plugin client: %w", err))
	}

	err = pluginClient.Delete(ctx, resource.Identifier{
		Namespace: ns.Value,
		Name:      name,
	}, resource.DeleteOptions{})
	if err != nil {
		logger.Error("Failed to delete plugin resource after successful uninstall", "error", err)
		// Plugin is already uninstalled, but resource deletion failed
		// This is less problematic than the reverse, but still not ideal
		return nil, false, err
	}

	logger.Info("Successfully uninstalled plugin and deleted resource")
	return nil, true, nil
}
