package serviceaccount

import (
	"context"
	"fmt"

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
)

var (
	_ rest.Scoper               = (*LegacyStore)(nil)
	_ rest.SingularNameProvider = (*LegacyStore)(nil)
	_ rest.Getter               = (*LegacyStore)(nil)
	_ rest.Lister               = (*LegacyStore)(nil)
	_ rest.Storage              = (*LegacyStore)(nil)
)

var resource = iamv0alpha1.ServiceAccountResourceInfo

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
	res, err := common.List(
		ctx, resource, s.ac, common.PaginationFromListOptions(options),
		func(ctx context.Context, ns claims.NamespaceInfo, p common.Pagination) (*common.ListResponse[iamv0alpha1.ServiceAccount], error) {
			found, err := s.store.ListServiceAccounts(ctx, ns, legacy.ListServiceAccountsQuery{
				Pagination: p,
			})

			if err != nil {
				return nil, err
			}

			items := make([]iamv0alpha1.ServiceAccount, 0, len(found.Items))
			for _, sa := range found.Items {
				items = append(items, toSAItem(sa, ns.Value))
			}

			return &common.ListResponse[iamv0alpha1.ServiceAccount]{
				Items:    items,
				RV:       found.RV,
				Continue: found.Continue,
			}, nil
		},
	)

	if err != nil {
		return nil, err
	}

	obj := &iamv0alpha1.ServiceAccountList{Items: res.Items}
	obj.Continue = common.OptionalFormatInt(res.Continue)
	obj.ResourceVersion = common.OptionalFormatInt(res.RV)
	return obj, nil
}

func toSAItem(sa legacy.ServiceAccount, ns string) iamv0alpha1.ServiceAccount {
	item := iamv0alpha1.ServiceAccount{
		ObjectMeta: metav1.ObjectMeta{
			Name:              sa.UID,
			Namespace:         ns,
			ResourceVersion:   fmt.Sprintf("%d", sa.Updated.UnixMilli()),
			CreationTimestamp: metav1.NewTime(sa.Created),
		},
		Spec: iamv0alpha1.ServiceAccountSpec{
			Title:    sa.Name,
			Disabled: sa.Disabled,
		},
	}
	obj, _ := utils.MetaAccessor(&item)
	obj.SetUpdatedTimestamp(&sa.Updated)
	obj.SetDeprecatedInternalID(sa.ID) // nolint:staticcheck
	return item
}

func (s *LegacyStore) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	found, err := s.store.ListServiceAccounts(ctx, ns, legacy.ListServiceAccountsQuery{
		UID:        name,
		OrgID:      ns.OrgID,
		Pagination: common.Pagination{Limit: 1},
	})
	if found == nil || err != nil {
		return nil, resource.NewNotFound(name)
	}
	if len(found.Items) < 1 {
		return nil, resource.NewNotFound(name)
	}

	res := toSAItem(found.Items[0], ns.Value)
	return &res, nil
}
