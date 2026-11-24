package datasource

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	registry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/util/dryrun"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/registry/apis/iam/resourcepermission/rpclient"
	"github.com/grafana/grafana/pkg/services/datasources"
)

type datasourcePermissionStorage struct {
	grafanarest.Storage
	permissionClient      *rpclient.Client
	permissionsOnCreation func(context.Context, string) (bool, error)
}

type datasourceRegistryStorage struct {
	*registry.Store
	hooks *datasourcePermissionStorage
}

func (s *datasourceRegistryStorage) Create(ctx context.Context, obj runtime.Object, validate rest.ValidateObjectFunc, opts *metav1.CreateOptions) (runtime.Object, error) {
	return s.hooks.Create(ctx, obj, validate, opts)
}

func (s *datasourceRegistryStorage) Update(ctx context.Context, name string, info rest.UpdatedObjectInfo, validateCreate rest.ValidateObjectFunc, validateUpdate rest.ValidateObjectUpdateFunc, forceAllowCreate bool, opts *metav1.UpdateOptions) (runtime.Object, bool, error) {
	return s.hooks.Update(ctx, name, info, validateCreate, validateUpdate, forceAllowCreate, opts)
}

type datasourceStorageWithCollectionDelete struct {
	grafanarest.Storage
	rest.CollectionDeleter
}

func newDatasourceStorage(store grafanarest.Storage, permissions *rpclient.Client, policy func(context.Context, string) (bool, error)) grafanarest.Storage {
	if registryStore, ok := store.(*registry.Store); ok {
		return &datasourceRegistryStorage{
			Store: registryStore,
			hooks: &datasourcePermissionStorage{Storage: registryStore, permissionClient: permissions, permissionsOnCreation: policy},
		}
	}
	wrapped := &datasourcePermissionStorage{Storage: store, permissionClient: permissions, permissionsOnCreation: policy}
	collectionDeleter, supportsCollectionDelete := store.(rest.CollectionDeleter)
	if supportsCollectionDelete {
		return &datasourceStorageWithCollectionDelete{Storage: wrapped, CollectionDeleter: collectionDeleter}
	}
	return wrapped
}

func (s *datasourcePermissionStorage) Create(ctx context.Context, obj runtime.Object, validate rest.ValidateObjectFunc, opts *metav1.CreateOptions) (runtime.Object, error) {
	created, err := s.Storage.Create(ctx, obj, validate, opts)
	if err != nil || s.permissionClient == nil || dryrun.IsDryRun(opts.DryRun) {
		return created, err
	}
	s.setDefaultsIfEnabled(ctx, created)
	return created, nil
}

func (s *datasourcePermissionStorage) Update(ctx context.Context, name string, info rest.UpdatedObjectInfo, validateCreate rest.ValidateObjectFunc, validateUpdate rest.ValidateObjectUpdateFunc, forceAllowCreate bool, opts *metav1.UpdateOptions) (runtime.Object, bool, error) {
	obj, created, err := s.Storage.Update(ctx, name, info, validateCreate, validateUpdate, forceAllowCreate, opts)
	if err != nil || !created || s.permissionClient == nil || dryrun.IsDryRun(opts.DryRun) {
		return obj, created, err
	}
	s.setDefaultsIfEnabled(ctx, obj)
	return obj, true, nil
}

func (s *datasourcePermissionStorage) setDefaultsIfEnabled(ctx context.Context, obj runtime.Object) {
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		logging.FromContext(ctx).Error("Failed to access datasource metadata for default permissions", "error", err)
		return
	}
	if s.permissionsOnCreation == nil {
		logging.FromContext(ctx).Error("Missing datasource default permission policy")
		return
	}
	enabled, err := s.permissionsOnCreation(ctx, meta.GetNamespace())
	if err != nil {
		logging.FromContext(ctx).Error("Failed to read datasource default permission policy", "namespace", meta.GetNamespace(), "error", err)
		return
	}
	if !enabled {
		return
	}
	if err := s.permissionClient.SetDefault(ctx, meta.GetNamespace(), meta.GetName(), datasources.DefaultDatasourceResourcePermissions(ctx)); err != nil {
		logging.FromContext(ctx).Error("Failed to set default datasource permissions", "namespace", meta.GetNamespace(), "uid", meta.GetName(), "error", err)
	}
}

// afterDelete runs only after unified storage deleted the datasource, including for each item of a
// collection delete. With dual writes the legacy service may also call the deleter; a repeated delete is a no-op.
func (b *DataSourceAPIBuilder) afterDelete(obj runtime.Object, _ *metav1.DeleteOptions) {
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		logging.DefaultLogger.Error("Failed to access deleted datasource object metadata", "error", err)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), datasources.PermissionsDeleteTimeout)
	defer cancel()
	if err := b.permissionClient.DeletePermissions(ctx, meta.GetNamespace(), meta.GetName()); err != nil {
		logging.DefaultLogger.Error("Failed to delete datasource permissions", "error", err)
	}
}
