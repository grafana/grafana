package identity

import (
	"context"
	"strconv"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	identity "github.com/grafana/grafana/pkg/apis/identity/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/team"
)

var (
	_ rest.Scoper               = (*legacyStorage)(nil)
	_ rest.SingularNameProvider = (*legacyStorage)(nil)
	_ rest.Getter               = (*legacyStorage)(nil)
	_ rest.Lister               = (*legacyStorage)(nil)
	_ rest.Storage              = (*legacyStorage)(nil)
)

var resourceInfo = identity.TeamResourceInfo

type legacyStorage struct {
	service        team.Service
	tableConverter rest.TableConvertor
}

func (s *legacyStorage) New() runtime.Object {
	return resourceInfo.NewFunc()
}

func (s *legacyStorage) Destroy() {}

func (s *legacyStorage) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *legacyStorage) GetSingularName() string {
	return resourceInfo.GetSingularName()
}

func (s *legacyStorage) NewList() runtime.Object {
	return resourceInfo.NewListFunc()
}

func (s *legacyStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *legacyStorage) doList(ctx context.Context, ns string, query *team.ListTeamsCommand) (*identity.TeamList, error) {
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

func (s *legacyStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	return s.doList(ctx, ns.Value, &team.ListTeamsCommand{
		Limit: int(options.Limit),
		OrgID: ns.OrgID,
	})
}

func (s *legacyStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
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
	return nil, resourceInfo.NewNotFound(name)
}
