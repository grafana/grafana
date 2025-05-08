package user

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	types "github.com/grafana/authlib/types"

	claims "github.com/grafana/authlib/types"
	authzV0 "github.com/grafana/grafana/apps/authz/pkg/apis/authz/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/authz/common"
	"github.com/grafana/grafana/pkg/registry/apis/authz/legacy"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/user"
)

var (
	_ rest.Scoper               = (*LegacyStore)(nil)
	_ rest.SingularNameProvider = (*LegacyStore)(nil)
	_ rest.Getter               = (*LegacyStore)(nil)
	_ rest.Lister               = (*LegacyStore)(nil)
	_ rest.Storage              = (*LegacyStore)(nil)
)

// var resource = authzV0.

func NewLegacyStore(store legacy.LegacyAccessStore, ac claims.AccessClient) *LegacyStore {
	return &LegacyStore{store, ac}
}

type LegacyStore struct {
	store          legacy.LegacyAccessStore
	ac             claims.AccessClient
	tableConverter rest.TableConvertor
}

func (s *LegacyStore) New() runtime.Object {
	return authzV0.RoleKind().ZeroValue()
}

func (s *LegacyStore) Destroy() {}

func (s *LegacyStore) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *LegacyStore) GetSingularName() string {
	return strings.ToLower(authzV0.RoleKind().Kind())
}

func (s *LegacyStore) NewList() runtime.Object {
	return authzV0.RoleKind().ZeroListValue()
}

func (s *LegacyStore) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *LegacyStore) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	id, ok := types.AuthInfoFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("failed to get auth info from context")
	}

	res, err := common.List(
		ctx, resource.GetName(), s.ac, common.PaginationFromListOptions(options),
		func(ctx context.Context, ns claims.NamespaceInfo, p common.Pagination) (*common.ListResponse[authzV0.User], error) {
			found, err := s.store.ListRoles(ctx, ns, legacy.ListRolesQuery{
				Pagination: p,
			})

			if err != nil {
				return nil, err
			}

			users := make([]authzV0.User, 0, len(found.Users))
			for _, u := range found.Users {
				users = append(users, toUserItem(&u, ns.Value))
			}

			return &common.ListResponse[authzV0.User]{
				Items:    users,
				RV:       found.RV,
				Continue: found.Continue,
			}, nil
		},
	)

	if err != nil {
		return nil, err
	}

	obj := &authzV0.UserList{Items: res.Items}
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

func toUserItem(u *user.User, ns string) authzV0.User {
	item := &authzV0.User{
		ObjectMeta: metav1.ObjectMeta{
			Name:              u.UID,
			Namespace:         ns,
			ResourceVersion:   fmt.Sprintf("%d", u.Updated.UnixMilli()),
			CreationTimestamp: metav1.NewTime(u.Created),
		},
		Spec: authzV0.UserSpec{
			Name:          u.Name,
			Login:         u.Login,
			Email:         u.Email,
			EmailVerified: u.EmailVerified,
			Disabled:      u.IsDisabled,
			InternalID:    u.ID,
		},
	}
	obj, _ := utils.MetaAccessor(item)
	obj.SetUpdatedTimestamp(&u.Updated)
	obj.SetDeprecatedInternalID(u.ID) // nolint:staticcheck
	return *item
}
