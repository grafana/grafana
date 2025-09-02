package user

import (
	"context"
	"fmt"
	"time"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	claims "github.com/grafana/authlib/types"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/user"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

const AnnoKeyLastSeenAt = "iam.grafana.app/lastSeenAt"

var (
	_ rest.Scoper               = (*LegacyStore)(nil)
	_ rest.SingularNameProvider = (*LegacyStore)(nil)
	_ rest.Getter               = (*LegacyStore)(nil)
	_ rest.Lister               = (*LegacyStore)(nil)
	_ rest.Storage              = (*LegacyStore)(nil)
	_ rest.CreaterUpdater       = (*LegacyStore)(nil)
	_ rest.GracefulDeleter      = (*LegacyStore)(nil)
	_ rest.CollectionDeleter    = (*LegacyStore)(nil)
	_ rest.TableConvertor       = (*LegacyStore)(nil)
)

var resource = iamv0alpha1.UserResourceInfo

func NewLegacyStore(store legacy.LegacyIdentityStore, ac claims.AccessClient, enableAuthnMutation bool) *LegacyStore {
	return &LegacyStore{store, ac, enableAuthnMutation}
}

type LegacyStore struct {
	store               legacy.LegacyIdentityStore
	ac                  claims.AccessClient
	enableAuthnMutation bool
}

// Update implements rest.Updater.
func (s *LegacyStore) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	return nil, false, apierrors.NewMethodNotSupported(resource.GroupResource(), "update")
}

// DeleteCollection implements rest.CollectionDeleter.
func (s *LegacyStore) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return nil, apierrors.NewMethodNotSupported(resource.GroupResource(), "deletecollection")
}

// Delete implements rest.GracefulDeleter.
func (s *LegacyStore) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	if !s.enableAuthnMutation {
		return nil, false, apierrors.NewMethodNotSupported(resource.GroupResource(), "delete")
	}

	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}

	found, err := s.store.ListUsers(ctx, ns, legacy.ListUserQuery{
		OrgID:      ns.OrgID,
		UID:        name,
		Pagination: common.Pagination{Limit: 1},
	})
	if err != nil {
		return nil, false, err
	}
	if found == nil || len(found.Users) < 1 {
		return nil, false, resource.NewNotFound(name)
	}

	userToDelete := &found.Users[0]

	if deleteValidation != nil {
		userObj := toUserItem(userToDelete, ns.Value)
		if err := deleteValidation(ctx, &userObj); err != nil {
			return nil, false, err
		}
	}

	deleteCmd := legacy.DeleteUserCommand{
		UID: name,
	}

	_, err = s.store.DeleteUser(ctx, ns, deleteCmd)
	if err != nil {
		return nil, false, fmt.Errorf("failed to delete user: %w", err)
	}

	deletedUser := toUserItem(userToDelete, ns.Value)
	return &deletedUser, true, nil
}

func (s *LegacyStore) New() runtime.Object {
	return resource.NewFunc()
}

func (s *LegacyStore) Destroy() {}

func (s *LegacyStore) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *LegacyStore) GetSingularName() string {
	return resource.GetSingularName()
}

func (s *LegacyStore) NewList() runtime.Object {
	return resource.NewListFunc()
}

func (s *LegacyStore) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return resource.TableConverter().ConvertToTable(ctx, object, tableOptions)
}

func (s *LegacyStore) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	res, err := common.List(
		ctx, resource, s.ac, common.PaginationFromListOptions(options),
		func(ctx context.Context, ns claims.NamespaceInfo, p common.Pagination) (*common.ListResponse[iamv0alpha1.User], error) {
			found, err := s.store.ListUsers(ctx, ns, legacy.ListUserQuery{
				Pagination: p,
			})

			if err != nil {
				return nil, err
			}

			users := make([]iamv0alpha1.User, 0, len(found.Users))
			for _, u := range found.Users {
				users = append(users, toUserItem(&u, ns.Value))
			}

			return &common.ListResponse[iamv0alpha1.User]{
				Items:    users,
				RV:       found.RV,
				Continue: found.Continue,
			}, nil
		},
	)

	if err != nil {
		return nil, err
	}

	obj := &iamv0alpha1.UserList{Items: res.Items}
	obj.Continue = common.OptionalFormatInt(res.Continue)
	obj.ResourceVersion = common.OptionalFormatInt(res.RV)
	return obj, nil
}

func (s *LegacyStore) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	found, err := s.store.ListUsers(ctx, ns, legacy.ListUserQuery{
		OrgID:      ns.OrgID,
		UID:        name,
		Pagination: common.Pagination{Limit: 1},
	})
	if found == nil || err != nil {
		return nil, resource.NewNotFound(name)
	}
	if len(found.Users) < 1 {
		return nil, resource.NewNotFound(name)
	}

	obj := toUserItem(&found.Users[0], ns.Value)
	return &obj, nil
}

// Create implements rest.Creater.
func (s *LegacyStore) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	if !s.enableAuthnMutation {
		return nil, apierrors.NewMethodNotSupported(resource.GroupResource(), "create")
	}

	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	userObj, ok := obj.(*iamv0alpha1.User)
	if !ok {
		return nil, fmt.Errorf("expected User object, got %T", obj)
	}

	if createValidation != nil {
		if err := createValidation(ctx, obj); err != nil {
			return nil, err
		}
	}

	if userObj.Spec.Login == "" && userObj.Spec.Email == "" {
		return nil, fmt.Errorf("user must have either login or email")
	}

	createCmd := legacy.CreateUserCommand{
		UID:           userObj.Name,
		Login:         userObj.Spec.Login,
		Email:         userObj.Spec.Email,
		Name:          userObj.Spec.Name,
		IsAdmin:       userObj.Spec.GrafanaAdmin,
		IsDisabled:    userObj.Spec.Disabled,
		EmailVerified: userObj.Spec.EmailVerified,
		IsProvisioned: userObj.Spec.Provisioned,
	}

	result, err := s.store.CreateUser(ctx, ns, createCmd)
	if err != nil {
		return nil, err
	}

	iamUser := toUserItem(&result.User, ns.Value)
	return &iamUser, nil
}

func toUserItem(u *user.User, ns string) iamv0alpha1.User {
	item := &iamv0alpha1.User{
		ObjectMeta: metav1.ObjectMeta{
			Name:              u.UID,
			Namespace:         ns,
			ResourceVersion:   fmt.Sprintf("%d", u.Updated.UnixMilli()),
			CreationTimestamp: metav1.NewTime(u.Created),
		},
		Spec: iamv0alpha1.UserSpec{
			Name:          u.Name,
			Login:         u.Login,
			Email:         u.Email,
			EmailVerified: u.EmailVerified,
			Disabled:      u.IsDisabled,
			GrafanaAdmin:  u.IsAdmin,
			Provisioned:   u.IsProvisioned,
		},
	}
	obj, _ := utils.MetaAccessor(item)
	obj.SetUpdatedTimestamp(&u.Updated)
	obj.SetAnnotation(AnnoKeyLastSeenAt, formatTime(&u.LastSeenAt))
	obj.SetDeprecatedInternalID(u.ID) // nolint:staticcheck
	return *item
}

func formatTime(v *time.Time) string {
	txt := ""
	if v != nil && v.Unix() != 0 {
		txt = v.UTC().Format(time.RFC3339)
	}
	return txt
}
