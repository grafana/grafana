package team

import (
	"context"
	"fmt"
	"strconv"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	claims "github.com/grafana/authlib/types"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	iamv0 "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
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

var resource = iamv0.TeamResourceInfo

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

func (s *LegacyStore) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	res, err := common.List(
		ctx, resource, s.ac, common.PaginationFromListOptions(options),
		func(ctx context.Context, ns claims.NamespaceInfo, p common.Pagination) (*common.ListResponse[iamv0alpha1.Team], error) {
			found, err := s.store.ListTeams(ctx, ns, legacy.ListTeamQuery{
				Pagination: p,
			})

			if err != nil {
				return nil, err
			}

			teams := make([]iamv0alpha1.Team, 0, len(found.Teams))
			for _, t := range found.Teams {
				teams = append(teams, toTeamObject(t, ns))
			}

			return &common.ListResponse[iamv0alpha1.Team]{
				Items:    teams,
				RV:       found.RV,
				Continue: found.Continue,
			}, nil
		},
	)

	if err != nil {
		return nil, fmt.Errorf("failed to list teams: %w", err)
	}

	list := &iamv0alpha1.TeamList{Items: res.Items}
	list.Continue = common.OptionalFormatInt(res.Continue)
	list.ResourceVersion = common.OptionalFormatInt(res.RV)

	return list, nil
}

func (s *LegacyStore) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	found, err := s.store.ListTeams(ctx, ns, legacy.ListTeamQuery{
		OrgID:      ns.OrgID,
		UID:        name,
		Pagination: common.Pagination{Limit: 1},
	})
	if found == nil || err != nil {
		return nil, resource.NewNotFound(name)
	}
	if len(found.Teams) < 1 {
		return nil, resource.NewNotFound(name)
	}

	obj := toTeamObject(found.Teams[0], ns)
	return &obj, nil
}

func toTeamObject(t team.Team, ns claims.NamespaceInfo) iamv0alpha1.Team {
	obj := iamv0alpha1.Team{
		ObjectMeta: metav1.ObjectMeta{
			Name:              t.UID,
			Namespace:         ns.Value,
			CreationTimestamp: metav1.NewTime(t.Created),
			ResourceVersion:   strconv.FormatInt(t.Updated.UnixMilli(), 10),
		},
		Spec: iamv0alpha1.TeamSpec{
			Title: t.Name,
			Email: t.Email,
		},
	}
	meta, _ := utils.MetaAccessor(&obj)
	meta.SetUpdatedTimestamp(&t.Updated)
	meta.SetDeprecatedInternalID(t.ID) // nolint:staticcheck

	return obj
}
