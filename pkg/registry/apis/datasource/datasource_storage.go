package datasource

import (
	"context"
	"errors"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/util/dryrun"
	"sigs.k8s.io/structured-merge-diff/v6/fieldpath"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/registry/apis/iam/resourcepermission/rpclient"
	"github.com/grafana/grafana/pkg/services/datasources"
)

var (
	errWatchUnsupported            = errors.New("datasource storage does not support watch")
	errCollectionDeleteUnsupported = errors.New("datasource storage does not support collection delete")
)

type permissionWrapper struct {
	grafanarest.Storage
	permissionClient      *rpclient.Client
	permissionsOnCreation func(context.Context, string) (bool, error)
}

func newPermissionWrapper(store grafanarest.Storage, permissions *rpclient.Client, policy func(context.Context, string) (bool, error)) grafanarest.Storage {
	return &permissionWrapper{Storage: store, permissionClient: permissions, permissionsOnCreation: policy}
}

func (s *permissionWrapper) Create(ctx context.Context, obj runtime.Object, validate rest.ValidateObjectFunc, opts *metav1.CreateOptions) (runtime.Object, error) {
	created, err := s.Storage.Create(ctx, obj, validate, opts)
	if err != nil || s.permissionClient == nil || dryrun.IsDryRun(opts.DryRun) {
		return created, err
	}
	s.setDefaultsIfEnabled(ctx, created)
	return created, nil
}

func (s *permissionWrapper) Update(ctx context.Context, name string, info rest.UpdatedObjectInfo, validateCreate rest.ValidateObjectFunc, validateUpdate rest.ValidateObjectUpdateFunc, forceAllowCreate bool, opts *metav1.UpdateOptions) (runtime.Object, bool, error) {
	obj, created, err := s.Storage.Update(ctx, name, info, validateCreate, validateUpdate, forceAllowCreate, opts)
	if err != nil || !created || s.permissionClient == nil || dryrun.IsDryRun(opts.DryRun) {
		return obj, created, err
	}
	s.setDefaultsIfEnabled(ctx, obj)
	return obj, true, nil
}

func (s *permissionWrapper) setDefaultsIfEnabled(ctx context.Context, obj runtime.Object) {
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

func (s *permissionWrapper) Watch(ctx context.Context, options *internalversion.ListOptions) (watch.Interface, error) {
	watcher, ok := s.Storage.(rest.Watcher)
	if !ok {
		return nil, errWatchUnsupported
	}
	return watcher.Watch(ctx, options)
}

func (s *permissionWrapper) DeleteCollection(ctx context.Context, validate rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	deleter, ok := s.Storage.(rest.CollectionDeleter)
	if !ok {
		return nil, errCollectionDeleteUnsupported
	}
	return deleter.DeleteCollection(ctx, validate, options, listOptions)
}

func (s *permissionWrapper) StorageVersion() runtime.GroupVersioner {
	provider, ok := s.Storage.(rest.StorageVersionProvider)
	if !ok {
		return nil
	}
	return provider.StorageVersion()
}

func (s *permissionWrapper) GetResetFields() map[fieldpath.APIVersion]*fieldpath.Set {
	strategy, ok := s.Storage.(rest.ResetFieldsStrategy)
	if !ok {
		return nil
	}
	return strategy.GetResetFields()
}

func (s *permissionWrapper) ReadinessCheck() error {
	ready, ok := s.Storage.(rest.StorageWithReadiness)
	if !ok {
		return nil
	}
	return ready.ReadinessCheck()
}

func (s *permissionWrapper) GetCorruptObjDeleter() rest.GracefulDeleter {
	provider, ok := s.Storage.(rest.CorruptObjectDeleterProvider)
	if !ok {
		return nil
	}
	return provider.GetCorruptObjDeleter()
}

func (s *permissionWrapper) DeleteReturnsDeletedObject() bool {
	deleter, ok := s.Storage.(rest.MayReturnFullObjectDeleter)
	return ok && deleter.DeleteReturnsDeletedObject()
}

var _ grafanarest.Storage = (*permissionWrapper)(nil)
var _ rest.Watcher = (*permissionWrapper)(nil)
