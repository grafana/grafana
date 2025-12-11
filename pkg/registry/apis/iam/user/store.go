package user

import (
	"context"
	"fmt"

	"go.opentelemetry.io/otel/trace"
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
	"github.com/grafana/grafana/pkg/util"
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

var userResource = iamv0alpha1.UserResourceInfo

func NewLegacyStore(store legacy.LegacyIdentityStore, ac claims.AccessClient, enableAuthnMutation bool, tracer trace.Tracer) *LegacyStore {
	return &LegacyStore{store, ac, enableAuthnMutation, tracer}
}

type LegacyStore struct {
	store               legacy.LegacyIdentityStore
	ac                  claims.AccessClient
	enableAuthnMutation bool
	tracer              trace.Tracer
}

// Update implements rest.Updater.
func (s *LegacyStore) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	ctx, span := s.tracer.Start(ctx, "user.Update")
	defer span.End()

	if !s.enableAuthnMutation {
		return nil, false, apierrors.NewMethodNotSupported(userResource.GroupResource(), "update")
	}

	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}

	oldObj, err := s.Get(ctx, name, nil)
	if err != nil {
		return nil, false, err
	}

	newObj, err := objInfo.UpdatedObject(ctx, oldObj)
	if err != nil {
		return nil, false, err
	}

	if updateValidation != nil {
		if err := updateValidation(ctx, newObj, oldObj); err != nil {
			return nil, false, err
		}
	}

	userObj, ok := newObj.(*iamv0alpha1.User)
	if !ok {
		return nil, false, fmt.Errorf("expected User object, got %T", newObj)
	}

	updateCmd := legacy.UpdateUserCommand{
		UID:           name,
		Login:         userObj.Spec.Login,
		Email:         userObj.Spec.Email,
		Name:          userObj.Spec.Title,
		IsAdmin:       userObj.Spec.GrafanaAdmin,
		IsDisabled:    userObj.Spec.Disabled,
		EmailVerified: userObj.Spec.EmailVerified,
		Role:          userObj.Spec.Role,
	}

	result, err := s.store.UpdateUser(ctx, ns, updateCmd)
	if err != nil {
		return nil, false, err
	}

	iamUser := toUserItem(&result.User, ns.Value)
	return &iamUser, false, nil
}

// DeleteCollection implements rest.CollectionDeleter.
func (s *LegacyStore) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return nil, apierrors.NewMethodNotSupported(userResource.GroupResource(), "deletecollection")
}

// Delete implements rest.GracefulDeleter.
func (s *LegacyStore) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	ctx, span := s.tracer.Start(ctx, "user.Delete")
	defer span.End()

	if !s.enableAuthnMutation {
		return nil, false, apierrors.NewMethodNotSupported(userResource.GroupResource(), "delete")
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
	if found == nil || len(found.Items) < 1 {
		return nil, false, userResource.NewNotFound(name)
	}

	userToDelete := &found.Items[0]

	if deleteValidation != nil {
		userObj := toUserItem(userToDelete, ns.Value)
		if err := deleteValidation(ctx, &userObj); err != nil {
			return nil, false, err
		}
	}

	deleteCmd := legacy.DeleteUserCommand{
		UID: name,
	}

	err = s.store.DeleteUser(ctx, ns, deleteCmd)
	if err != nil {
		return nil, false, fmt.Errorf("failed to delete user: %w", err)
	}

	deletedUser := toUserItem(userToDelete, ns.Value)
	return &deletedUser, true, nil
}

func (s *LegacyStore) New() runtime.Object {
	return userResource.NewFunc()
}

func (s *LegacyStore) Destroy() {}

func (s *LegacyStore) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *LegacyStore) GetSingularName() string {
	return userResource.GetSingularName()
}

func (s *LegacyStore) NewList() runtime.Object {
	return userResource.NewListFunc()
}

func (s *LegacyStore) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return userResource.TableConverter().ConvertToTable(ctx, object, tableOptions)
}

func (s *LegacyStore) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	ctx, span := s.tracer.Start(ctx, "user.List")
	defer span.End()

	res, err := common.List(
		ctx, userResource, s.ac, common.PaginationFromListOptions(options),
		func(ctx context.Context, ns claims.NamespaceInfo, p common.Pagination) (*common.ListResponse[iamv0alpha1.User], error) {
			found, err := s.store.ListUsers(ctx, ns, legacy.ListUserQuery{
				Pagination: p,
			})

			if err != nil {
				return nil, err
			}

			users := make([]iamv0alpha1.User, 0, len(found.Items))
			for _, u := range found.Items {
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
	ctx, span := s.tracer.Start(ctx, "user.Get")
	defer span.End()

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
		return nil, userResource.NewNotFound(name)
	}
	if len(found.Items) < 1 {
		return nil, userResource.NewNotFound(name)
	}

	obj := toUserItem(&found.Items[0], ns.Value)
	return &obj, nil
}

// Create implements rest.Creater.
func (s *LegacyStore) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	ctx, span := s.tracer.Start(ctx, "user.Create")
	defer span.End()

	if !s.enableAuthnMutation {
		return nil, apierrors.NewMethodNotSupported(userResource.GroupResource(), "create")
	}

	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	userObj, ok := obj.(*iamv0alpha1.User)
	if !ok {
		return nil, fmt.Errorf("expected User object, got %T", obj)
	}

	if userObj.GenerateName != "" {
		userObj.Name = userObj.GenerateName + util.GenerateShortUID()
		userObj.GenerateName = ""
	}

	if createValidation != nil {
		if err := createValidation(ctx, obj); err != nil {
			return nil, err
		}
	}

	createCmd := legacy.CreateUserCommand{
		UID:           userObj.Name,
		Login:         userObj.Spec.Login,
		Email:         userObj.Spec.Email,
		Name:          userObj.Spec.Title,
		IsAdmin:       userObj.Spec.GrafanaAdmin,
		IsDisabled:    userObj.Spec.Disabled,
		EmailVerified: userObj.Spec.EmailVerified,
		IsProvisioned: userObj.Spec.Provisioned,
		Role:          userObj.Spec.Role,
	}

	result, err := s.store.CreateUser(ctx, ns, createCmd)
	if err != nil {
		return nil, err
	}

	iamUser := toUserItem(&result.User, ns.Value)
	return &iamUser, nil
}

func toUserItem(u *common.UserWithRole, ns string) iamv0alpha1.User {
	item := &iamv0alpha1.User{
		ObjectMeta: metav1.ObjectMeta{
			Name:              u.UID,
			Namespace:         ns,
			ResourceVersion:   fmt.Sprintf("%d", u.Updated.UnixMilli()),
			CreationTimestamp: metav1.NewTime(u.Created),
		},
		Spec: iamv0alpha1.UserSpec{
			Title:         u.Name,
			Login:         u.Login,
			Email:         u.Email,
			EmailVerified: u.EmailVerified,
			Disabled:      u.IsDisabled,
			GrafanaAdmin:  u.IsAdmin,
			Provisioned:   u.IsProvisioned,
			Role:          u.Role,
		},
		Status: iamv0alpha1.UserStatus{
			LastSeenAt: u.LastSeenAt.Unix(),
		},
	}
	obj, _ := utils.MetaAccessor(item)
	obj.SetUpdatedTimestamp(&u.Updated)
	obj.SetDeprecatedInternalID(u.ID) // nolint:staticcheck
	return *item
}
