package user

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/selection"
	apirequest "k8s.io/apiserver/pkg/endpoints/request"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

func TestUnifiedUserTeamsRequest(t *testing.T) {
	client := &userTeamsIndexClient{}
	query := UserTeamsQuery{Namespace: "stacks-1", UserUID: "alice", Limit: 10, After: []string{"team-a"}, Explain: true}
	page, err := NewUnifiedUserTeamsBackend(client, nil).ListUserTeams(t.Context(), query)
	require.NoError(t, err)
	require.Equal(t, &UserTeamsPage{}, page)
	req := client.request
	require.Equal(t, &resourcepb.ResourceKey{Namespace: "stacks-1", Group: "iam.grafana.app", Resource: "teams"}, req.Options.Key)
	require.Equal(t, []*resourcepb.Requirement{{Key: builders.TEAM_SEARCH_MEMBERS, Operator: string(selection.Equals), Values: []string{"alice"}}}, req.Options.Fields)
	require.Equal(t, int64(10), req.Limit)
	require.Equal(t, []string{"team-a"}, req.SearchAfter)
	require.True(t, req.Explain)
	require.Equal(t, resourcepb.ResourceSearchRequest_FIELD_VALUES, req.ResultFormat)
	require.Equal(t, []string{resource.SEARCH_FIELD_NAME}, req.Fields)
	require.Equal(t, []*resourcepb.ResourceSearchRequest_Sort{{Field: resource.SEARCH_FIELD_NAME}}, req.SortBy)
	require.Zero(t, req.Page)
	require.Zero(t, req.Offset)
}

func TestUnifiedUserTeamsResponseFormats(t *testing.T) {
	for _, format := range []resourcepb.ResourceSearchRequest_ResultFormat{
		resourcepb.ResourceSearchRequest_UNSPECIFIED,
		resourcepb.ResourceSearchRequest_RESOURCE_TABLE,
		resourcepb.ResourceSearchRequest_FIELD_VALUES,
	} {
		t.Run(format.String(), func(t *testing.T) {
			client := &userTeamsIndexClient{response: userTeamsSearchResponse(format, "team-a", "team-b")}
			requester := &identity.StaticRequester{Namespace: "stacks-1"}
			ctx := identity.WithRequester(t.Context(), requester)
			getter := &userTeamsGetter{get: func(ctx context.Context, name string) (runtime.Object, error) {
				if apirequest.NamespaceValue(ctx) != "stacks-1" {
					return nil, errors.New("namespace not propagated")
				}
				got, err := identity.GetRequester(ctx)
				if err != nil || got != requester {
					return nil, errors.New("requester not preserved")
				}
				permission := iamv0.TeamTeamPermission("member")
				if name == "team-a" {
					permission = "admin"
				}
				return &iamv0.Team{Spec: iamv0.TeamSpec{Members: []iamv0.TeamTeamMember{
					{Name: "bob", Permission: "member"},
					{Name: "alice", Permission: permission, External: name == "team-b"},
				}}}, nil
			}}
			backend := NewUnifiedUserTeamsBackend(client, getter)
			for _, limit := range []int64{2, 10} {
				page, err := backend.ListUserTeams(ctx, UserTeamsQuery{Namespace: "stacks-1", UserUID: "alice", Limit: limit})
				require.NoError(t, err)
				require.Equal(t, []iamv0.GetUserTeamsUserTeam{
					{User: "alice", Team: "team-a", Permission: "admin"},
					{User: "alice", Team: "team-b", Permission: "member", External: true},
				}, page.Items)
				if limit == 2 {
					require.Equal(t, []string{"team-b"}, page.Next)
					require.Equal(t, int64(42), page.ResourceVersion)
				} else {
					require.Empty(t, page.Next)
				}
			}
		})
	}
}

func TestUnifiedUserTeamsSkippedMemberships(t *testing.T) {
	for _, allSkipped := range []bool{false, true} {
		t.Run(fmt.Sprint(allSkipped), func(t *testing.T) {
			client := &userTeamsIndexClient{response: userTeamsSearchResponse(resourcepb.ResourceSearchRequest_FIELD_VALUES, "team-a", "team-missing", "team-removed", "team-wrong-type")}
			getter := &userTeamsGetter{get: func(_ context.Context, name string) (runtime.Object, error) {
				switch name {
				case "team-a":
					if !allSkipped {
						return userTeamsTestTeam("alice"), nil
					}
				case "team-removed":
					return userTeamsTestTeam("bob"), nil
				case "team-wrong-type":
					return &iamv0.User{}, nil
				}
				return nil, apierrors.NewNotFound(iamv0.TeamResourceInfo.GroupResource(), name)
			}}
			page, err := NewUnifiedUserTeamsBackend(client, getter).ListUserTeams(t.Context(), UserTeamsQuery{UserUID: "alice", Limit: 4})
			require.NoError(t, err)
			if allSkipped {
				require.Empty(t, page.Items)
			} else {
				require.Equal(t, []iamv0.GetUserTeamsUserTeam{{User: "alice", Team: "team-a", Permission: "member"}}, page.Items)
			}
			require.Equal(t, []string{"team-wrong-type"}, page.Next)
		})
	}
}

func TestUnifiedUserTeamsTableRows(t *testing.T) {
	client := &userTeamsIndexClient{response: &resourcepb.ResourceSearchResponse{
		Results: &resourcepb.ResourceTable{
			Rows: []*resourcepb.ResourceTableRow{
				nil,
				{},
				{Key: &resourcepb.ResourceKey{Name: "team-a"}, SortFields: []string{"team-a"}},
			},
		},
	}}
	getter := &userTeamsGetter{get: func(context.Context, string) (runtime.Object, error) { return userTeamsTestTeam("alice"), nil }}
	backend := NewUnifiedUserTeamsBackend(client, getter)
	page, err := backend.ListUserTeams(t.Context(), UserTeamsQuery{UserUID: "alice", Limit: 2})
	require.NoError(t, err)
	require.Equal(t, []iamv0.GetUserTeamsUserTeam{{User: "alice", Team: "team-a", Permission: "member"}}, page.Items)
	require.Equal(t, []string{"team-a"}, page.Next)

	client.response.Results.Rows[2].SortFields = nil
	page, err = backend.ListUserTeams(t.Context(), UserTeamsQuery{UserUID: "alice", Limit: 2})
	require.NoError(t, err)
	require.Empty(t, page.Next, "do not invent a cursor when the server omitted sort fields")
}

func TestUnifiedUserTeamsErrors(t *testing.T) {
	for _, tt := range []struct {
		name        string
		response    *resourcepb.ResourceSearchResponse
		err         error
		getterError error
		want        string
	}{
		{name: "transport", err: errors.New("index unavailable"), want: "index unavailable"},
		{name: "response", response: &resourcepb.ResourceSearchResponse{Error: &resourcepb.ErrorResult{Code: 500, Message: "index unavailable"}}, want: "index unavailable"},
		{name: "format", response: &resourcepb.ResourceSearchResponse{ResultFormat: 99}, want: "unsupported search result format"},
		{name: "nil field row", response: &resourcepb.ResourceSearchResponse{ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES, Rows: []*resourcepb.ResourceSearchRow{nil}}, want: "has no resource key"},
		{name: "nil field key", response: &resourcepb.ResourceSearchResponse{ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES, Rows: []*resourcepb.ResourceSearchRow{{}}}, want: "has no resource key"},
		{name: "getter", response: userTeamsSearchResponse(resourcepb.ResourceSearchRequest_FIELD_VALUES, "team-a"), getterError: errors.New("get unavailable"), want: "get unavailable"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			client := &userTeamsIndexClient{response: tt.response, err: tt.err}
			getter := &userTeamsGetter{get: func(context.Context, string) (runtime.Object, error) { return nil, tt.getterError }}
			page, err := NewUnifiedUserTeamsBackend(client, getter).ListUserTeams(t.Context(), UserTeamsQuery{UserUID: "alice", Limit: 10})
			require.ErrorContains(t, err, tt.want)
			require.Nil(t, page)
			if tt.err != nil {
				require.ErrorIs(t, err, tt.err)
			}
			if tt.getterError != nil {
				require.ErrorIs(t, err, tt.getterError)
			}
		})
	}
}

func TestUnifiedUserTeamsEmptyResponses(t *testing.T) {
	for _, response := range []*resourcepb.ResourceSearchResponse{nil, {}, {Results: &resourcepb.ResourceTable{}}, {ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES}} {
		page, err := NewUnifiedUserTeamsBackend(&userTeamsIndexClient{response: response}, nil).ListUserTeams(t.Context(), UserTeamsQuery{Limit: 10})
		require.NoError(t, err)
		require.Equal(t, &UserTeamsPage{}, page)
	}
}

func TestUnifiedUserTeamsBoundedReads(t *testing.T) {
	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()
	var active, maximum atomic.Int64
	started := make(chan struct{}, 2*userTeamsGetParallelism)
	release := make(chan struct{})
	getter := &userTeamsGetter{get: func(ctx context.Context, _ string) (runtime.Object, error) {
		n := active.Add(1)
		defer active.Add(-1)
		for old := maximum.Load(); n > old; old = maximum.Load() {
			if maximum.CompareAndSwap(old, n) {
				break
			}
		}
		started <- struct{}{}
		select {
		case <-release:
			return userTeamsTestTeam("alice"), nil
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}}
	names := make([]string, 2*userTeamsGetParallelism)
	for i := range names {
		names[i] = fmt.Sprintf("team-%02d", i)
	}
	client := &userTeamsIndexClient{response: userTeamsSearchResponse(resourcepb.ResourceSearchRequest_FIELD_VALUES, names...)}
	var wg sync.WaitGroup
	var page *UserTeamsPage
	var err error
	wg.Go(func() {
		page, err = NewUnifiedUserTeamsBackend(client, getter).ListUserTeams(ctx, UserTeamsQuery{UserUID: "alice", Limit: int64(len(names))})
	})
	for range userTeamsGetParallelism {
		select {
		case <-started:
		case <-ctx.Done():
			t.Fatal("team reads did not reach the concurrency limit")
		}
	}
	close(release)
	wg.Wait()
	require.NoError(t, err)
	require.Equal(t, int64(userTeamsGetParallelism), maximum.Load())
	require.Len(t, page.Items, len(names))
	for i, item := range page.Items {
		require.Equal(t, names[i], item.Team)
	}
}

func TestUserTeamsContinueAcrossModeChanges(t *testing.T) {
	for _, legacyFirst := range []bool{true, false} {
		t.Run(fmt.Sprint(legacyFirst), func(t *testing.T) {
			store := &fakeUserTeamsStore{pages: []*legacy.ListUserTeamsResult{{Items: []legacy.UserTeam{{UID: "team-b"}, {UID: "team-a"}}}}}
			client := &userTeamsIndexClient{}
			if legacyFirst {
				client.response = userTeamsSearchResponse(resourcepb.ResourceSearchRequest_FIELD_VALUES, "team-b")
			} else {
				client.response = userTeamsSearchResponse(resourcepb.ResourceSearchRequest_FIELD_VALUES, "team-a")
			}
			getter := &userTeamsGetter{get: func(context.Context, string) (runtime.Object, error) { return userTeamsTestTeam("alice"), nil }}
			gr := iamv0.TeamResourceInfo.GroupResource()
			cfg := &setting.Cfg{UnifiedStorage: map[string]setting.UnifiedStorageConfig{}}
			selector := dualwrite.NewSelector[UserTeamsBackend](dualwrite.ProvideServiceForTests(cfg), gr,
				NewLegacyUserTeamsBackend(store, tracing.NewNoopTracerService()), NewUnifiedUserTeamsBackend(client, getter))
			ctx := identity.WithRequester(t.Context(), &identity.StaticRequester{Namespace: "stacks-1"})
			mode := rest.Mode5
			if legacyFirst {
				mode = rest.Mode0
			}
			cfg.UnifiedStorage[gr.String()] = setting.UnifiedStorageConfig{DualWriterMode: mode}
			first, _ := serveUserTeams(t, ctx, selector, "limit=1")
			require.NoError(t, first.err)
			page := first.obj.(*iamv0.GetUserTeamsResponse)
			require.Equal(t, "team-a", page.Items[0].Team)
			require.NotEmpty(t, page.Continue)
			mode = rest.Mode0
			if legacyFirst {
				mode = rest.Mode5
			}
			cfg.UnifiedStorage[gr.String()] = setting.UnifiedStorageConfig{DualWriterMode: mode}
			second, _ := serveUserTeams(t, ctx, selector, "limit=1&continue="+url.QueryEscape(page.Continue))
			require.NoError(t, second.err)
			require.Equal(t, "team-b", second.obj.(*iamv0.GetUserTeamsResponse).Items[0].Team)
			if legacyFirst {
				require.Equal(t, []string{"team-a"}, client.request.SearchAfter)
			}
		})
	}
}

func userTeamsSearchResponse(format resourcepb.ResourceSearchRequest_ResultFormat, names ...string) *resourcepb.ResourceSearchResponse {
	response := &resourcepb.ResourceSearchResponse{ResultFormat: format, ResourceVersion: 42}
	for _, name := range names {
		key := &resourcepb.ResourceKey{Name: name}
		if format == resourcepb.ResourceSearchRequest_FIELD_VALUES {
			response.Rows = append(response.Rows, &resourcepb.ResourceSearchRow{Key: key, SortFields: []string{name}})
		} else {
			if response.Results == nil {
				response.Results = &resourcepb.ResourceTable{}
			}
			response.Results.Rows = append(response.Results.Rows, &resourcepb.ResourceTableRow{Key: key, SortFields: []string{name}})
		}
	}
	return response
}

func userTeamsTestTeam(user string) *iamv0.Team {
	return &iamv0.Team{Spec: iamv0.TeamSpec{Members: []iamv0.TeamTeamMember{{Name: user, Permission: "member"}}}}
}

type userTeamsIndexClient struct {
	resourcepb.ResourceIndexClient
	request  *resourcepb.ResourceSearchRequest
	response *resourcepb.ResourceSearchResponse
	err      error
}

func (c *userTeamsIndexClient) Search(_ context.Context, req *resourcepb.ResourceSearchRequest, _ ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	c.request = req
	return c.response, c.err
}

type userTeamsGetter struct {
	get func(context.Context, string) (runtime.Object, error)
}

func (g *userTeamsGetter) Get(ctx context.Context, name string, _ *metav1.GetOptions) (runtime.Object, error) {
	return g.get(ctx, name)
}
