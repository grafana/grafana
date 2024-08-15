package identity

import (
	"context"
	"strconv"

	"github.com/grafana/authlib/claims"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	identity "github.com/grafana/grafana/pkg/apimachinery/apis/identity/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/identity/legacy"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/team"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
)

var (
	_ rest.Scoper               = (*legacyTeamStorage)(nil)
	_ rest.SingularNameProvider = (*legacyTeamStorage)(nil)
	_ rest.Getter               = (*legacyTeamStorage)(nil)
	_ rest.Lister               = (*legacyTeamStorage)(nil)
	_ rest.Storage              = (*legacyTeamStorage)(nil)
)

type legacyTeamStorage struct {
	service        legacy.LegacyIdentityStore
	tableConverter rest.TableConvertor
	resourceInfo   common.ResourceInfo
}

func (s *legacyTeamStorage) New() runtime.Object {
	return s.resourceInfo.NewFunc()
}

func (s *legacyTeamStorage) Destroy() {}

func (s *legacyTeamStorage) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *legacyTeamStorage) GetSingularName() string {
	return s.resourceInfo.GetSingularName()
}

func (s *legacyTeamStorage) NewList() runtime.Object {
	return s.resourceInfo.NewListFunc()
}

func (s *legacyTeamStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *legacyTeamStorage) doList(ctx context.Context, ns claims.NamespaceInfo, query legacy.ListTeamQuery) (*identity.TeamList, error) {
	if query.Limit < 1 {
		query.Limit = 100
	}

	rsp, err := s.service.ListTeams(ctx, ns, query)
	if err != nil {
		return nil, err
	}
	list := &identity.TeamList{
		ListMeta: metav1.ListMeta{
			ResourceVersion: strconv.FormatInt(rsp.RV, 10),
		},
	}
	for _, team := range rsp.Teams {
		item := identity.Team{
			ObjectMeta: metav1.ObjectMeta{
				Name:              team.UID,
				Namespace:         ns.Value,
				CreationTimestamp: metav1.NewTime(team.Created),
				ResourceVersion:   strconv.FormatInt(team.Updated.UnixMilli(), 10),
			},
			Spec: identity.TeamSpec{
				Title: team.Name,
				Email: team.Email,
			},
		}
		meta, err := utils.MetaAccessor(&item)
		if err != nil {
			return nil, err
		}
		meta.SetUpdatedTimestamp(&team.Updated)
		meta.SetOriginInfo(&utils.ResourceOriginInfo{
			Name: "SQL",
			Path: strconv.FormatInt(team.ID, 10),
		})
		list.Items = append(list.Items, item)
	}
	if rsp.ContinueID > 0 {
		list.ListMeta.Continue = strconv.FormatInt(rsp.ContinueID, 10)
	}
	return list, nil
}

func (s *legacyTeamStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	query := legacy.ListTeamQuery{
		OrgID: ns.OrgID,
		Limit: options.Limit,
	}
	if options.Continue != "" {
		query.ContinueID, err = strconv.ParseInt(options.Continue, 10, 64)
		if err != nil {
			return nil, err
		}
	}
	return s.doList(ctx, ns, query)
}

func (s *legacyTeamStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	rsp, err := s.doList(ctx, ns, legacy.ListTeamQuery{
		OrgID: ns.OrgID,
		Limit: 1,
		UID:   name,
	})
	if err != nil {
		return nil, err
	}
	if len(rsp.Items) > 0 {
		return &rsp.Items[0], nil
	}
	return nil, s.resourceInfo.NewNotFound(name)
}

func asTeam(team *team.Team, ns string) (*identity.Team, error) {
	item := &identity.Team{
		ObjectMeta: metav1.ObjectMeta{
			Name:              team.UID,
			Namespace:         ns,
			CreationTimestamp: metav1.NewTime(team.Created),
			ResourceVersion:   strconv.FormatInt(team.Updated.UnixMilli(), 10),
		},
		Spec: identity.TeamSpec{
			Title: team.Name,
			Email: team.Email,
		},
	}
	meta, err := utils.MetaAccessor(item)
	if err != nil {
		return nil, err
	}
	meta.SetUpdatedTimestamp(&team.Updated)
	meta.SetOriginInfo(&utils.ResourceOriginInfo{
		Name: "SQL",
		Path: strconv.FormatInt(team.ID, 10),
	})
	return item, nil
}
