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
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/team"
)

var (
	_ rest.Scoper               = (*legacyTeamStorage)(nil)
	_ rest.SingularNameProvider = (*legacyTeamStorage)(nil)
	_ rest.Getter               = (*legacyTeamStorage)(nil)
	_ rest.Lister               = (*legacyTeamStorage)(nil)
	_ rest.Storage              = (*legacyTeamStorage)(nil)
)

type legacyTeamStorage struct {
	service        team.Service
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

func (s *legacyTeamStorage) doList(ctx context.Context, ns string, query *team.ListTeamsCommand) (*identity.TeamList, error) {
	if query.Limit < 1 {
		query.Limit = 100
	}
	teams, err := s.service.ListTeams(ctx, query)
	if err != nil {
		return nil, err
	}
	list := &identity.TeamList{}
	for _, team := range teams {
		item := identity.Team{
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
	return list, nil
}

func (s *legacyTeamStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	return s.doList(ctx, ns.Value, &team.ListTeamsCommand{
		Limit: int(options.Limit),
		OrgID: ns.OrgID,
	})
}

func (s *legacyTeamStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	rsp, err := s.doList(ctx, ns.Value, &team.ListTeamsCommand{
		Limit: 1,
		OrgID: ns.OrgID,
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
