package folders

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	claims "github.com/grafana/authlib/types"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
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
	tableConverter       rest.TableConvertor
	cfg                  *setting.Cfg
	features             featuremgmt.FeatureToggles
	folderPermissionsSvc accesscontrol.FolderPermissionsService
	acService            accesscontrol.Service
	store                grafanarest.Storage
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
		return nil, err
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

	err = s.setDefaultFolderPermissions(ctx, info.OrgID, user, p.Name, parentUid)
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
	return s.store.Delete(ctx, name, deleteValidation, options)
}

// GracefulDeleter
func (s *folderStorage) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return nil, fmt.Errorf("DeleteCollection for folders not implemented")
}

func (s *folderStorage) setDefaultFolderPermissions(ctx context.Context, orgID int64, user identity.Requester, uid string, parentUID string) error {
	if !s.cfg.RBAC.PermissionsOnCreation("folder") {
		return nil
	}

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
	if !isNested || !s.features.IsEnabled(ctx, featuremgmt.FlagNestedFolders) {
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
