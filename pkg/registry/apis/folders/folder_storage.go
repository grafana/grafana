package folders

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/client-go/dynamic"

	claims "github.com/grafana/authlib/types"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/api/apierrors"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/org"
)

var (
	_ rest.Scoper               = (*folderStorage)(nil)
	_ rest.SingularNameProvider = (*folderStorage)(nil)
	_ rest.Getter               = (*folderStorage)(nil)
	_ rest.Lister               = (*folderStorage)(nil)
	_ rest.Storage              = (*folderStorage)(nil)
	_ rest.Creater              = (*folderStorage)(nil)
	_ rest.Updater              = (*folderStorage)(nil)
	_ rest.GracefulDeleter      = (*folderStorage)(nil)
)

type folderStorage struct {
	// Wrapped storage
	store          grafanarest.Storage
	tableConverter rest.TableConvertor

	permissionsOnCreate    bool // cfg.RBAC.PermissionsOnCreation("folder")
	folderPermissionsSvc   accesscontrol.FolderPermissionsService
	resourcePermissionsSvc *dynamic.NamespaceableResourceInterface
	acService              accesscontrol.Service
}

func (s *folderStorage) New() runtime.Object {
	return resourceInfo.NewFunc()
}

func (s *folderStorage) Destroy() {}

func (s *folderStorage) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *folderStorage) GetSingularName() string {
	return resourceInfo.GetSingularName()
}

func (s *folderStorage) NewList() runtime.Object {
	return resourceInfo.NewListFunc()
}

func (s *folderStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *folderStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	return s.store.List(ctx, options)
}

func (s *folderStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	return s.store.Get(ctx, name, options)
}

func (s *folderStorage) Create(ctx context.Context,
	obj runtime.Object,
	createValidation rest.ValidateObjectFunc,
	options *metav1.CreateOptions,
) (runtime.Object, error) {
	obj, err := s.store.Create(ctx, obj, createValidation, options)
	if err != nil {
		statusErr := apierrors.ToFolderStatusError(err)
		return nil, &statusErr
	}

	// When cfg.RBAC.PermissionsOnCreation("folder") is not enabled
	if !s.permissionsOnCreate {
		return obj, err
	}

	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	p, ok := obj.(*folders.Folder)
	if !ok {
		return nil, fmt.Errorf("expected folder?")
	}

	accessor, err := utils.MetaAccessor(p)
	if err != nil {
		return nil, err
	}

	parentUid := accessor.GetFolder()

	err = s.setDefaultFolderPermissions(ctx, info.OrgID, user, p.Name, parentUid, p.Namespace)
	if err != nil {
		return nil, err
	}

	return obj, nil
}

func (s *folderStorage) Update(ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	createValidation rest.ValidateObjectFunc,
	updateValidation rest.ValidateObjectUpdateFunc,
	forceAllowCreate bool,
	options *metav1.UpdateOptions,
) (runtime.Object, bool, error) {
	return s.store.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
}

// GracefulDeleter
func (s *folderStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}

	obj, async, err := s.store.Delete(ctx, name, deleteValidation, options)
	if err != nil {
		return obj, async, err
	}

	if accessErr := s.folderPermissionsSvc.DeleteResourcePermissions(ctx, info.OrgID, name); accessErr != nil {
		// TODO: add a proper logger to this struct.
		logger := log.New().FromContext(ctx)
		logger.Warn("failed to delete folder permission after successfully deleting folder resource", "folder", name, "error", accessErr)
	}

	return obj, async, err
}

// GracefulDeleter
func (s *folderStorage) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return nil, fmt.Errorf("DeleteCollection for folders not implemented")
}

var defaultPermissions = []map[string]any{
	{
		"kind": "BasicRole",
		"name": "Admin",
		"verb": "admin",
	},
	{
		"kind": "BasicRole",
		"name": "Editor",
		"verb": "edit",
	},
	{
		"kind": "BasicRole",
		"name": "Viewer",
		"verb": "view",
	},
}

func (s *folderStorage) setDefaultFolderPermissions(ctx context.Context, orgID int64, user identity.Requester, uid, parentUID, namespace string) error {
	if s.resourcePermissionsSvc != nil {
		client := (*s.resourcePermissionsSvc).Namespace(namespace)
		name := fmt.Sprintf("%s-%s-%s", folders.FolderResourceInfo.GroupVersionResource().Group, folders.FolderResourceInfo.GroupVersionResource().Resource, uid)

		// the resource permission will likely already exist with admin can admin, so we will need to update it
		if _, err := client.Get(ctx, name, metav1.GetOptions{}); err == nil {
			_, err := client.Update(ctx, &unstructured.Unstructured{
				Object: map[string]interface{}{
					"metadata": map[string]any{
						"name":      name,
						"namespace": namespace,
					},
					"spec": map[string]any{
						"resource": map[string]any{
							"apiGroup": folders.FolderResourceInfo.GroupVersionResource().Group,
							"resource": folders.FolderResourceInfo.GroupVersionResource().Resource,
							"name":     uid,
						},
						"permissions": defaultPermissions,
					},
				},
			}, metav1.UpdateOptions{})
			if err != nil {
				return fmt.Errorf("update root permissions: %w", err)
			}

			return nil
		}

		_, err := client.Create(ctx, &unstructured.Unstructured{
			Object: map[string]interface{}{
				"metadata": map[string]any{
					"name":      name,
					"namespace": namespace,
				},
				"spec": map[string]any{
					"resource": map[string]any{
						"apiGroup": folders.FolderResourceInfo.GroupVersionResource().Group,
						"resource": folders.FolderResourceInfo.GroupVersionResource().Resource,
						"name":     uid,
					},
					"permissions": defaultPermissions,
				},
			},
		}, metav1.CreateOptions{})
		if err != nil {
			return fmt.Errorf("create root permissions: %w", err)
		}
		return nil
	}

	// once the feature flag kubernetesAuthzResourcePermissionApis is removed, the below should be removed and we should solely depend on those apis
	// rather than the folder permissions service
	var permissions []accesscontrol.SetResourcePermissionCommand

	if user.IsIdentityType(claims.TypeUser, claims.TypeServiceAccount) {
		userID, err := user.GetInternalID()
		if err != nil {
			return err
		}

		permissions = append(permissions, accesscontrol.SetResourcePermissionCommand{
			UserID: userID, Permission: dashboardaccess.PERMISSION_ADMIN.String(),
		})
	}
	isNested := parentUID != ""
	if !isNested {
		permissions = append(permissions, []accesscontrol.SetResourcePermissionCommand{
			{BuiltinRole: string(org.RoleEditor), Permission: dashboardaccess.PERMISSION_EDIT.String()},
			{BuiltinRole: string(org.RoleViewer), Permission: dashboardaccess.PERMISSION_VIEW.String()},
		}...)
	}

	_, err := s.folderPermissionsSvc.SetPermissions(ctx, orgID, uid, permissions...)
	if err != nil {
		return err
	}

	if user.IsIdentityType(claims.TypeUser, claims.TypeServiceAccount) {
		s.acService.ClearUserPermissionCache(user)
	}

	return nil
}
