package identity

import (
	"context"
	"fmt"
	"strconv"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	identity "github.com/grafana/grafana/pkg/apimachinery/apis/identity/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/user"
)

var (
	_ rest.Scoper               = (*legacyServiceAccountStorage)(nil)
	_ rest.SingularNameProvider = (*legacyServiceAccountStorage)(nil)
	_ rest.Getter               = (*legacyServiceAccountStorage)(nil)
	_ rest.Lister               = (*legacyServiceAccountStorage)(nil)
	_ rest.Storage              = (*legacyServiceAccountStorage)(nil)
)

type legacyServiceAccountStorage struct {
	service        user.Service
	tableConverter rest.TableConvertor
	resourceInfo   common.ResourceInfo
}

func (s *legacyServiceAccountStorage) New() runtime.Object {
	return s.resourceInfo.NewFunc()
}

func (s *legacyServiceAccountStorage) Destroy() {}

func (s *legacyServiceAccountStorage) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *legacyServiceAccountStorage) GetSingularName() string {
	return s.resourceInfo.GetSingularName()
}

func (s *legacyServiceAccountStorage) NewList() runtime.Object {
	return s.resourceInfo.NewListFunc()
}

func (s *legacyServiceAccountStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *legacyServiceAccountStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	query := &user.ListUsersCommand{
		OrgID:            ns.OrgID,
		Limit:            options.Limit,
		IsServiceAccount: true,
	}
	if options.Continue != "" {
		query.ContinueID, err = strconv.ParseInt(options.Continue, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid continue token")
		}
	}

	found, err := s.service.List(ctx, query)
	if err != nil {
		return nil, err
	}
	list := &identity.ServiceAccountList{}
	for _, item := range found.Users {
		list.Items = append(list.Items, *toSAItem(item, ns.Value))
	}
	if found.ContinueID > 0 {
		list.ListMeta.Continue = strconv.FormatInt(found.ContinueID, 10)
	}
	if found.RV > 0 {
		list.ListMeta.ResourceVersion = strconv.FormatInt(found.RV, 10)
	}
	return list, err
}

func toSAItem(u *user.User, ns string) *identity.ServiceAccount {
	item := &identity.ServiceAccount{
		ObjectMeta: metav1.ObjectMeta{
			Name:              u.UID,
			Namespace:         ns,
			ResourceVersion:   fmt.Sprintf("%d", u.Updated.UnixMilli()),
			CreationTimestamp: metav1.NewTime(u.Created),
		},
		Spec: identity.ServiceAccountSpec{
			Name:          u.Name,
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
	return item
}

func (s *legacyServiceAccountStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	found, err := s.service.GetByUID(ctx, &user.GetUserByUIDQuery{
		OrgID: ns.OrgID,
		UID:   name,
	})
	if found == nil || err != nil {
		return nil, s.resourceInfo.NewNotFound(name)
	}
	if !found.IsServiceAccount {
		return nil, s.resourceInfo.NewNotFound(name) // looking up the wrong type
	}
	return toUserItem(found, ns.Value), nil
}
