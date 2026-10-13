package user

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/selection"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	legacyuser "github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestUnifiedUserSearchQuery(t *testing.T) {
	for _, tt := range []struct {
		name      string
		requester *legacyuser.SignedInUser
		hidden    []string
	}{
		{name: "exclude hidden users", requester: &legacyuser.SignedInUser{Login: "viewer"}, hidden: []string{"hidden", "other"}},
		{name: "include own hidden account", requester: &legacyuser.SignedInUser{Login: "hidden"}, hidden: []string{"other"}},
		{name: "admin sees hidden users", requester: &legacyuser.SignedInUser{IsGrafanaAdmin: true}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			index := &MockClient{}
			cfg := &setting.Cfg{HiddenUsers: map[string]struct{}{"hidden": {}, "other": {}}}
			client := NewUnifiedSearchClient(index, cfg)
			ctx := identity.WithRequester(t.Context(), tt.requester)

			_, err := client.Search(ctx, SearchQuery{
				Namespace: "stacks-1", Query: `user*?\name`, Limit: 10, Page: 3, Offset: 20,
				Sort: []string{"-email", "title"},
			})

			require.NoError(t, err)
			req := index.LastSearchRequest
			require.Equal(t, &resourcepb.ResourceKey{Namespace: "stacks-1", Group: "iam.grafana.app", Resource: "users"}, req.Options.Key)
			require.Equal(t, `*user\*\?\\name*`, req.Query)
			require.Equal(t, int64(10), req.Limit)
			require.Equal(t, int64(3), req.Page)
			require.Equal(t, int64(20), req.Offset)
			require.Equal(t, resourcepb.ResourceSearchRequest_FIELD_VALUES, req.ResultFormat)
			require.Equal(t, []*resourcepb.ResourceSearchRequest_QueryField{
				{Name: resource.SEARCH_FIELD_TITLE}, {Name: fieldEmail}, {Name: fieldLogin},
			}, req.QueryFields)
			require.Equal(t, []*resourcepb.ResourceSearchRequest_Sort{
				{Field: fieldEmail, Desc: true}, {Field: resource.SEARCH_FIELD_TITLE},
			}, req.SortBy)
			if len(tt.hidden) == 0 {
				require.Empty(t, req.Options.Fields)
			} else {
				require.Len(t, req.Options.Fields, 1)
				require.Equal(t, fieldLogin, req.Options.Fields[0].Key)
				require.Equal(t, string(selection.NotIn), req.Options.Fields[0].Operator)
				require.ElementsMatch(t, tt.hidden, req.Options.Fields[0].Values)
			}
		})
	}
}

func TestUnifiedUserLookup(t *testing.T) {
	for _, field := range []string{fieldEmail, fieldLogin} {
		for _, value := range []string{"taken", ""} {
			t.Run(field+"/"+value, func(t *testing.T) {
				index := &MockClient{MockResponses: []*resourcepb.ResourceSearchResponse{{
					ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
					TotalHits:    1,
					Rows:         []*resourcepb.ResourceSearchRow{{Key: &resourcepb.ResourceKey{Name: "user-1"}}},
				}}}
				client := NewUnifiedSearchClient(index, nil)
				query := SearchQuery{Namespace: "stacks-1"}
				if field == fieldEmail {
					query.Email = &value
				} else {
					query.Login = &value
				}

				resp, err := client.Search(t.Context(), query)

				require.NoError(t, err)
				require.Equal(t, int64(1), resp.TotalHits)
				require.Len(t, resp.Hits, 1)
				require.Equal(t, "user-1", resp.Hits[0].Name)
				req := index.LastSearchRequest
				require.Equal(t, "stacks-1", req.Options.Key.Namespace)
				require.Empty(t, req.Query)
				require.Empty(t, req.QueryFields)
				require.Equal(t, []string{resource.SEARCH_FIELD_NAME}, req.Fields)
				require.Equal(t, []*resourcepb.Requirement{{
					Key: field, Operator: string(selection.Equals), Values: []string{value},
				}}, req.Options.Fields)
			})
		}
	}
}

func TestUnifiedUserLookupResults(t *testing.T) {
	for _, tt := range []struct {
		name     string
		response *resourcepb.ResourceSearchResponse
		conflict bool
	}{
		{name: "no match", response: &resourcepb.ResourceSearchResponse{}},
		{name: "old server table with same user", response: &resourcepb.ResourceSearchResponse{
			TotalHits: 1,
			Results: &resourcepb.ResourceTable{Rows: []*resourcepb.ResourceTableRow{{
				Key: &resourcepb.ResourceKey{Name: "user-1"},
			}}},
		}},
		{name: "old server table with another user", conflict: true, response: &resourcepb.ResourceSearchResponse{
			TotalHits: 1,
			Results: &resourcepb.ResourceTable{Rows: []*resourcepb.ResourceTableRow{{
				Key: &resourcepb.ResourceKey{Name: "other"},
			}}},
		}},
		{name: "count without a table", conflict: true, response: &resourcepb.ResourceSearchResponse{TotalHits: 1}},
		{name: "count without field-value rows", conflict: true, response: &resourcepb.ResourceSearchResponse{
			ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES, TotalHits: 1,
		}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			index := &MockClient{MockResponses: []*resourcepb.ResourceSearchResponse{tt.response}}
			client := NewUnifiedSearchClient(index, nil)

			err := validateEmail(t.Context(), client, "stacks-1", "user-1", "taken")

			if tt.conflict {
				require.ErrorContains(t, err, "email 'taken' is already taken")
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestUnifiedUserLookupInvalidResponse(t *testing.T) {
	for _, tt := range []struct {
		name     string
		response *resourcepb.ResourceSearchResponse
		want     string
	}{
		{name: "response error", response: &resourcepb.ResourceSearchResponse{
			Error: &resourcepb.ErrorResult{Code: 500, Message: "index failed"},
		}, want: "index failed"},
		{name: "unknown format", response: &resourcepb.ResourceSearchResponse{
			ResultFormat: resourcepb.ResourceSearchRequest_ResultFormat(-1),
		}, want: "unsupported search result format"},
		{name: "nil table row", response: &resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{Rows: []*resourcepb.ResourceTableRow{nil}},
		}, want: "has no resource key"},
		{name: "table row without key", response: &resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{Rows: []*resourcepb.ResourceTableRow{{}}},
		}, want: "has no resource key"},
		{name: "field-value row without key", response: &resourcepb.ResourceSearchResponse{
			ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
			Rows:         []*resourcepb.ResourceSearchRow{{}},
		}, want: "has no resource key"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			index := &MockClient{MockResponses: []*resourcepb.ResourceSearchResponse{tt.response}}
			client := NewUnifiedSearchClient(index, nil)

			err := validateEmail(t.Context(), client, "stacks-1", "user-1", "taken")

			require.ErrorContains(t, err, tt.want)
		})
	}
}

func TestUnifiedUserSearchError(t *testing.T) {
	index := &MockClient{MockError: errors.New("index unavailable")}
	client := NewUnifiedSearchClient(index, nil)
	email := "taken"

	resp, err := client.Search(t.Context(), SearchQuery{Email: &email})

	require.ErrorIs(t, err, index.MockError)
	require.Nil(t, resp)
}
