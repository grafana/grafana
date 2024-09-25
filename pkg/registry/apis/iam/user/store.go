package user

import (
	"context"
	"fmt"
	"strconv"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	iamv0 "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
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

var resource = iamv0.UserResourceInfo

func NewLegacyStore(store legacy.LegacyIdentityStore, ac claims.AccessClient) *LegacyStore {
	return &LegacyStore{store, ac}
}

type LegacyStore struct {
	store legacy.LegacyIdentityStore
	ac    claims.AccessClient
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
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	if s.ac != nil {
		return s.listWithCheck(ctx, ns, common.PaginationFromListOptions(options))
	}

	return s.listWithoutCheck(ctx, ns, common.PaginationFromListOptions(options))
}

func (s *LegacyStore) listWithCheck(ctx context.Context, ns claims.NamespaceInfo, p common.Pagination) (runtime.Object, error) {
	ident, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	check, err := s.ac.Compile(ctx, ident, claims.AccessRequest{
		Verb:      "list",
		Resource:  resource.GetName(),
		Namespace: ns.Value,
	})

	if err != nil {
		return nil, err
	}

	list := func(p common.Pagination) ([]iamv0.User, int64, int64, error) {
		found, err := s.store.ListUsers(ctx, ns, legacy.ListUserQuery{
			Pagination: p,
		})

		if err != nil {
			return nil, 0, 0, err
		}

		out := make([]iamv0.User, 0, len(found.Users))
		for _, u := range found.Users {
			if check(ns.Value, strconv.FormatInt(u.ID, 10)) {
				out = append(out, toUserItem(&u, ns.Value))
			}
		}

		return out, found.Continue, found.RV, nil
	}

	items, c, rv, err := list(p)
	if err != nil {
		return nil, err
	}

outer:
	for len(items) < int(p.Limit) && c != 0 {
		var more []iamv0.User
		more, c, _, err = list(common.Pagination{Limit: p.Limit, Continue: c})
		if err != nil {
			return nil, err
		}

		for _, u := range more {
			if len(items) == int(p.Limit) {
				break outer
			}
			items = append(items, u)
		}
	}

	obj := &iamv0.UserList{Items: items}
	obj.ListMeta.Continue = common.OptionalFormatInt(c)
	obj.ListMeta.ResourceVersion = common.OptionalFormatInt(rv)
	return obj, nil
}

func (s *LegacyStore) listWithoutCheck(ctx context.Context, ns claims.NamespaceInfo, p common.Pagination) (runtime.Object, error) {
	found, err := s.store.ListUsers(ctx, ns, legacy.ListUserQuery{
		Pagination: p,
	})

	if err != nil {
		return nil, err
	}

	list := &iamv0.UserList{}
	for _, item := range found.Users {
		list.Items = append(list.Items, toUserItem(&item, ns.Value))
	}

	list.ListMeta.Continue = common.OptionalFormatInt(found.Continue)
	list.ListMeta.ResourceVersion = common.OptionalFormatInt(found.RV)
	return list, nil
}

func (s *LegacyStore) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	query := legacy.ListUserQuery{
		OrgID:      ns.OrgID,
		Pagination: common.Pagination{Limit: 1},
	}

	found, err := s.store.ListUsers(ctx, ns, query)
	if found == nil || err != nil {
		return nil, resource.NewNotFound(name)
	}
	if len(found.Users) < 1 {
		return nil, resource.NewNotFound(name)
	}

	obj := toUserItem(&found.Users[0], ns.Value)
	return &obj, nil
}

func toUserItem(u *user.User, ns string) iamv0.User {
	item := &iamv0.User{
		ObjectMeta: metav1.ObjectMeta{
			Name:              u.UID,
			Namespace:         ns,
			ResourceVersion:   fmt.Sprintf("%d", u.Updated.UnixMilli()),
			CreationTimestamp: metav1.NewTime(u.Created),
		},
		Spec: iamv0.UserSpec{
			Name:          u.Name,
			Login:         u.Login,
			Email:         u.Email,
			EmailVerified: u.EmailVerified,
			Disabled:      u.IsDisabled,
		},
	}
	obj, _ := utils.MetaAccessor(item)
	obj.SetUpdatedTimestamp(&u.Updated)
	obj.SetOriginInfo(&utils.ResourceOriginInfo{
		Name: "SQL",
		Path: strconv.FormatInt(u.ID, 10),
	})
	return *item
}
