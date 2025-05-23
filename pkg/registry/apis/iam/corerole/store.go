package corerole

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	claims "github.com/grafana/authlib/types"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

var (
	_ rest.Scoper               = (*LegacyStore)(nil)
	_ rest.SingularNameProvider = (*LegacyStore)(nil)
	_ rest.Getter               = (*LegacyStore)(nil)
	_ rest.Lister               = (*LegacyStore)(nil)
	_ rest.Storage              = (*LegacyStore)(nil)
)

var resource = iamv0.CoreRoleInfo

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
	// FIXME: Should be false for core roles
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
		ctx, resource.GetName(), s.ac, common.PaginationFromListOptions(options),
		func(ctx context.Context, ns claims.NamespaceInfo, p common.Pagination) (*common.ListResponse[iamv0.CoreRole], error) {
			found, err := s.store.ListCoreRoles(ctx, ns, legacy.ListCoreRolesQuery{
				Pagination: p,
			})

			if err != nil {
				return nil, err
			}

			items := make([]iamv0.CoreRole, 0, len(found.Roles))
			for _, r := range found.Roles {
				items = append(items, toCRItem(r, ns.Value))
			}

			return &common.ListResponse[iamv0.CoreRole]{
				Items:    items,
				RV:       found.RV,
				Continue: found.Continue,
			}, nil
		},
	)

	if err != nil {
		return nil, err
	}

	obj := &iamv0.CoreRoleList{Items: res.Items}
	obj.Continue = common.OptionalFormatInt(res.Continue)
	obj.ResourceVersion = common.OptionalFormatInt(res.RV)
	return obj, nil
}

func toCRItem(r accesscontrol.RoleDTO, ns string) iamv0.CoreRole {
	item := iamv0.CoreRole{
		ObjectMeta: metav1.ObjectMeta{
			Name:              r.Name,
			Namespace:         ns,
			ResourceVersion:   fmt.Sprintf("%d", r.Version),
			CreationTimestamp: metav1.NewTime(r.Created),
		},
		Spec: iamv0.CoreRoleSpec{
			Title:       r.Name,
			Version:     r.Version,
			Group:       r.Group,
			Permissions: []iamv0.CoreRolespecPermission{},
		},
	}
	for _, p := range r.Permissions {
		item.Spec.Permissions = append(item.Spec.Permissions, iamv0.CoreRolespecPermission{
			Action: p.Action,
			Scope:  p.Scope,
		})
	}
	obj, _ := utils.MetaAccessor(&item)
	obj.SetUpdatedTimestamp(&r.Updated)
	obj.SetDeprecatedInternalID(r.ID) // nolint:staticcheck
	return item
}

func (s *LegacyStore) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	found, err := s.store.ListCoreRoles(ctx, ns, legacy.ListCoreRolesQuery{
		UID:        name,
		Pagination: common.Pagination{Limit: 1},
	})
	if found == nil || err != nil {
		return nil, resource.NewNotFound(name)
	}
	if len(found.Roles) < 1 {
		return nil, resource.NewNotFound(name)
	}

	res := toCRItem(found.Roles[0], ns.Value)
	return &res, nil
}
