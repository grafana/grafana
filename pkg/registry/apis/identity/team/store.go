package team

import (
	"context"
	"strconv"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	identityv0 "github.com/grafana/grafana/pkg/apis/identity/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/identity/legacy"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/team"
)

var (
	_ rest.Scoper               = (*LegacyStore)(nil)
	_ rest.SingularNameProvider = (*LegacyStore)(nil)
	_ rest.Getter               = (*LegacyStore)(nil)
	_ rest.Lister               = (*LegacyStore)(nil)
	_ rest.Storage              = (*LegacyStore)(nil)
)

var resource = identityv0.TeamResourceInfo

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
	// namespace == org
	return true
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

func (s *LegacyStore) doList(ctx context.Context, ns claims.NamespaceInfo, query legacy.ListTeamQuery) (*identityv0.TeamList, error) {
	if query.Limit < 1 {
		query.Limit = 100
	}

	rsp, err := s.store.ListTeams(ctx, ns, query)
	if err != nil {
		return nil, err
	}
	list := &identityv0.TeamList{
		ListMeta: metav1.ListMeta{
			ResourceVersion: strconv.FormatInt(rsp.RV, 10),
		},
	}
	for _, team := range rsp.Teams {
		item := identityv0.Team{
			ObjectMeta: metav1.ObjectMeta{
				Name:              team.UID,
				Namespace:         ns.Value,
				CreationTimestamp: metav1.NewTime(team.Created),
				ResourceVersion:   strconv.FormatInt(team.Updated.UnixMilli(), 10),
			},
			Spec: identityv0.TeamSpec{
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

func (s *LegacyStore) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
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

func (s *LegacyStore) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
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
	return nil, resource.NewNotFound(name)
}

func asTeam(team *team.Team, ns string) (*identityv0.Team, error) {
	item := &identityv0.Team{
		ObjectMeta: metav1.ObjectMeta{
			Name:              team.UID,
			Namespace:         ns,
			CreationTimestamp: metav1.NewTime(team.Created),
			ResourceVersion:   strconv.FormatInt(team.Updated.UnixMilli(), 10),
		},
		Spec: identityv0.TeamSpec{
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
