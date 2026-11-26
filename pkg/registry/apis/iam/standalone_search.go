package iam

import (
	"context"
	"errors"

	"github.com/grafana/authlib/types"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/iam/team"
	"github.com/grafana/grafana/pkg/registry/apis/iam/user"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

func (b *IdentityAccessManagementAPIBuilder) configureStandaloneAdmissionSearch(opts builder.APIGroupOptions, teamsEnabled, usersEnabled bool) error {
	if !b.standalone || (!teamsEnabled && !usersEnabled) {
		return nil
	}
	if opts.DualWriteService == nil {
		return errors.New("standalone IAM admission requires the storage mode service")
	}
	getter, ok := opts.OptsGetter.(*apistore.RESTOptionsGetter)
	if !ok || getter == nil || getter.ResourceIndex() == nil {
		return errors.New("standalone IAM admission requires a unified storage search client")
	}
	index := getter.ResourceIndex()
	b.userSearchClient = dualwrite.NewSelector[user.SearchBackend](opts.DualWriteService, iamv0.UserResourceInfo.GroupResource(),
		standaloneUserSearch{b.store}, user.NewUnifiedSearchClient(index, &setting.Cfg{}))
	b.teamSearchClient = dualwrite.NewSelector[team.SearchBackend](opts.DualWriteService, iamv0.TeamResourceInfo.GroupResource(),
		standaloneTeamSearch{b.store}, team.NewUnifiedSearchClient(index))
	return nil
}

// Standalone only uses these backends for exact admission lookups, not search routes.
type standaloneUserSearch struct{ store legacy.LegacyIdentityStore }

type standaloneTeamSearch struct{ store legacy.LegacyIdentityStore }

func (s standaloneUserSearch) Search(ctx context.Context, q user.SearchQuery) (*iamv0.GetSearchUsersResponse, error) {
	ns, err := types.ParseNamespace(q.Namespace)
	if err != nil {
		return nil, err
	}
	query := legacy.ListUserQuery{Pagination: common.Pagination{Limit: 2}}
	if q.Email != nil {
		query.Email = *q.Email
	}
	if q.Login != nil {
		query.Login = *q.Login
	}
	result := iamv0.NewGetSearchUsersResponse()
	if query.Email == "" && query.Login == "" {
		return result, nil
	}
	users, err := s.store.ListUsers(ctx, ns, query)
	if err != nil {
		return nil, err
	}
	result.TotalHits = int64(len(users.Items))
	for _, u := range users.Items {
		result.Hits = append(result.Hits, iamv0.GetSearchUsersUserHit{Name: u.UID})
	}
	return result, nil
}

func (s standaloneTeamSearch) Search(ctx context.Context, q team.SearchQuery) (*iamv0.GetSearchTeamsResponse, error) {
	if q.Title == "" {
		return nil, errors.New("team title is required for standalone admission lookup")
	}
	ns, err := types.ParseNamespace(q.Namespace)
	if err != nil {
		return nil, err
	}
	teams, err := s.store.ListTeams(ctx, ns, legacy.ListTeamQuery{
		Name: q.Title, Pagination: common.Pagination{Limit: q.Limit},
	})
	if err != nil {
		return nil, err
	}
	result := &iamv0.GetSearchTeamsResponse{}
	for _, t := range teams.Teams {
		result.Hits = append(result.Hits, iamv0.GetSearchTeamsTeamHit{Name: t.UID})
	}
	return result, nil
}
