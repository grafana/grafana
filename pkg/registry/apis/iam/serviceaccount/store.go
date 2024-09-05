package serviceaccount

import (
	"context"
	"fmt"
	"strconv"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	iamv0 "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
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

var resource = iamv0.ServiceAccountResourceInfo

func NewLegacyStore(store legacy.LegacyIdentityStore) *LegacyStore {
	return &LegacyStore{store}
}

type LegacyStore struct {
	store legacy.LegacyIdentityStore
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

	found, err := s.store.ListServiceAccounts(ctx, ns, legacy.ListServiceAccountsQuery{
		OrgID:      ns.OrgID,
		Pagination: common.PaginationFromListOptions(options),
	})
	if err != nil {
		return nil, err
	}

	list := &iamv0.ServiceAccountList{}
	for _, item := range found.Items {
		list.Items = append(list.Items, toSAItem(item, ns.Value))
	}

	list.ListMeta.Continue = common.OptionalFormatInt(found.Continue)
	list.ListMeta.ResourceVersion = common.OptionalFormatInt(found.RV)

	return list, err
}

func toSAItem(sa legacy.ServiceAccount, ns string) iamv0.ServiceAccount {
	item := iamv0.ServiceAccount{
		ObjectMeta: metav1.ObjectMeta{
			Name:              sa.UID,
			Namespace:         ns,
			ResourceVersion:   fmt.Sprintf("%d", sa.Updated.UnixMilli()),
			CreationTimestamp: metav1.NewTime(sa.Created),
		},
		Spec: iamv0.ServiceAccountSpec{
			Title:    sa.Name,
			Disabled: sa.Disabled,
		},
	}
	obj, _ := utils.MetaAccessor(&item)
	obj.SetUpdatedTimestamp(&sa.Updated)
	obj.SetOriginInfo(&utils.ResourceOriginInfo{
		Name: "SQL",
		Path: strconv.FormatInt(sa.ID, 10),
	})
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
