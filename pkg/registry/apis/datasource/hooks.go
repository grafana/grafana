package datasource

import (
	"context"
	"fmt"

	authlib "github.com/grafana/authlib/types"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	registry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/util/dryrun"

	"github.com/grafana/grafana-app-sdk/logging"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
)

type unifiedDatasourceStorage struct {
	*registry.Store
	permissions datasources.PermissionsLifecycle
}

func (s *unifiedDatasourceStorage) Create(ctx context.Context, obj runtime.Object, validate rest.ValidateObjectFunc, opts *metav1.CreateOptions) (runtime.Object, error) {
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return nil, err
	}
	// This store sets defaults after Create. Consume the explicit request for the
	// same defaults before unified storage tries to dispatch its annotation hook.
	if meta.GetAnnotation(utils.AnnoKeyGrantPermissions) == utils.AnnoGrantPermissionsDefault {
		meta.SetAnnotation(utils.AnnoKeyGrantPermissions, "")
	}
	created, err := s.Store.Create(ctx, obj, validate, opts)
	if err != nil || dryrun.IsDryRun(opts.DryRun) || dualwrite.IsMirroredCreate(ctx) {
		return created, err
	}
	if err := s.setDefaults(ctx, created); err != nil {
		return nil, err
	}
	return created, nil
}

func (s *unifiedDatasourceStorage) Update(ctx context.Context, name string, info rest.UpdatedObjectInfo, validateCreate rest.ValidateObjectFunc, validateUpdate rest.ValidateObjectUpdateFunc, forceAllowCreate bool, opts *metav1.UpdateOptions) (runtime.Object, bool, error) {
	obj, created, err := s.Store.Update(ctx, name, info, validateCreate, validateUpdate, forceAllowCreate, opts)
	if err != nil || !created || dryrun.IsDryRun(opts.DryRun) || dualwrite.IsMirroredUpdate(ctx) {
		return obj, created, err
	}
	if err := s.setDefaults(ctx, obj); err != nil {
		return nil, false, err
	}
	return obj, true, nil
}

func (s *unifiedDatasourceStorage) setDefaults(ctx context.Context, obj runtime.Object) error {
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return err
	}
	permissions := []iamv0.ResourcePermissionspecPermission{
		{Kind: iamv0.ResourcePermissionSpecPermissionKindBasicRole, Name: "Viewer", Verb: "query"},
		{Kind: iamv0.ResourcePermissionSpecPermissionKindBasicRole, Name: "Editor", Verb: "query"},
	}
	if actor, ok := authlib.AuthInfoFrom(ctx); ok && actor.GetIdentifier() != "" {
		var kind iamv0.ResourcePermissionSpecPermissionKind
		switch actor.GetIdentityType() {
		case authlib.TypeUser:
			kind = iamv0.ResourcePermissionSpecPermissionKindUser
		case authlib.TypeServiceAccount:
			kind = iamv0.ResourcePermissionSpecPermissionKindServiceAccount
		}
		if kind != "" {
			permissions = append(permissions, iamv0.ResourcePermissionspecPermission{Kind: kind, Name: actor.GetIdentifier(), Verb: "admin"})
		}
	}
	if err := s.permissions.SetDefault(ctx, meta.GetNamespace(), meta.GetName(), permissions); err != nil {
		return fmt.Errorf("set default datasource permissions: %w", err)
	}
	return nil
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
	if err := b.permissionsLifecycle.DeletePermissions(ctx, meta.GetNamespace(), meta.GetName()); err != nil {
		logging.DefaultLogger.Error("Failed to delete datasource permissions", "error", err)
	}
}
