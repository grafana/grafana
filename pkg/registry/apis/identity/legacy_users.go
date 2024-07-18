package identity

import (
	"context"
	"strconv"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	identity "github.com/grafana/grafana/pkg/apimachinery/apis/identity/v0alpha1"
	identityapi "github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/user"
)

var (
	_ rest.Scoper               = (*legacyUserStorage)(nil)
	_ rest.SingularNameProvider = (*legacyUserStorage)(nil)
	_ rest.Getter               = (*legacyUserStorage)(nil)
	_ rest.Lister               = (*legacyUserStorage)(nil)
	_ rest.Storage              = (*legacyUserStorage)(nil)
)

type legacyUserStorage struct {
	service        user.Service
	tableConverter rest.TableConvertor
	resourceInfo   common.ResourceInfo
}

func (s *legacyUserStorage) New() runtime.Object {
	return s.resourceInfo.NewFunc()
}

func (s *legacyUserStorage) Destroy() {}

func (s *legacyUserStorage) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *legacyUserStorage) GetSingularName() string {
	return s.resourceInfo.GetSingularName()
}

func (s *legacyUserStorage) NewList() runtime.Object {
	return s.resourceInfo.NewListFunc()
}

func (s *legacyUserStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *legacyUserStorage) doList(ctx context.Context, ns string, query *user.SearchUsersQuery) (*identity.UserList, error) {
	ident, err := identityapi.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	query.SignedInUser = ident

	if query.Limit < 1 {
		query.Limit = 100
	}
	users, err := s.service.Search(ctx, query)
	if err != nil {
		return nil, err
	}
	list := &identity.UserList{}
	for _, user := range users.Users {
		item := identity.User{
			ObjectMeta: metav1.ObjectMeta{
				Name:      user.UID,
				Namespace: ns,
				// CreationTimestamp: metav1.NewTime(user.),
				// ResourceVersion:   strconv.FormatInt(team.Updated.UnixMilli(), 10),
			},
			Spec: identity.UserSpec{
				Name:     user.Name,
				Login:    user.Login,
				Email:    user.Email,
				Disabled: user.IsDisabled,
				// EmailVerified: ???,
			},
		}
		meta, err := utils.MetaAccessor(&item)
		if err != nil {
			return nil, err
		}
		//meta.SetUpdatedTimestamp(&team.Updated)
		meta.SetOriginInfo(&utils.ResourceOriginInfo{
			Name: "SQL",
			Path: strconv.FormatInt(user.ID, 10),
		})
		list.Items = append(list.Items, item)
	}
	return list, nil
}

func (s *legacyUserStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	return s.doList(ctx, ns.Value, &user.SearchUsersQuery{
		Limit: int(options.Limit),
		OrgID: ns.OrgID,
	})
}

func (s *legacyUserStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	rsp, err := s.doList(ctx, ns.Value, &user.SearchUsersQuery{
		Limit: 1,
		OrgID: ns.OrgID,
		// Filters: , ???
	})
	if err != nil {
		return nil, err
	}
	if len(rsp.Items) > 0 {
		return &rsp.Items[0], nil
	}
	return nil, s.resourceInfo.NewNotFound(name)
}
