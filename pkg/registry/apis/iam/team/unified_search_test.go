package team

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/selection"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	teamsearch "github.com/grafana/grafana/pkg/services/team/search"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

func TestUnifiedTeamSearchRequest(t *testing.T) {
	for _, tt := range []struct {
		name   string
		query  SearchQuery
		fields []*resourcepb.Requirement
		labels []*resourcepb.Requirement
	}{
		{name: "query", query: SearchQuery{Query: "a*b"}},
		{name: "title and UIDs", query: SearchQuery{Title: "Engineering", UIDs: []string{"one", "two"}}, fields: []*resourcepb.Requirement{
			{Key: resource.SEARCH_FIELD_TITLE, Operator: string(selection.DoubleEquals), Values: []string{"Engineering"}},
			{Key: resource.SEARCH_FIELD_NAME, Operator: string(selection.In), Values: []string{"one", "two"}},
		}},
		{name: "legacy IDs", query: SearchQuery{TeamIDs: []string{"001", "2"}}, labels: []*resourcepb.Requirement{
			{Key: resource.SEARCH_FIELD_LEGACY_ID, Operator: string(selection.In), Values: []string{"001", "2"}},
		}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			client := &MockClient{}
			query := tt.query
			query.Namespace = "stacks-1"
			query.Limit, query.Page, query.Offset = 10, 2, 15
			query.Sort = []string{"-email", "title"}
			_, err := NewUnifiedSearchClient(client).Search(t.Context(), query)
			require.NoError(t, err)
			req := client.LastSearchRequest
			require.NotNil(t, req)
			require.Equal(t, &resourcepb.ResourceKey{Group: "iam.grafana.app", Resource: "teams", Namespace: "stacks-1"}, req.Options.Key)
			require.Equal(t, tt.query.Query, req.Query)
			require.Equal(t, query.Limit, req.Limit)
			require.Equal(t, query.Page, req.Page)
			require.Equal(t, query.Offset, req.Offset)
			require.Equal(t, tt.fields, req.Options.Fields)
			require.Equal(t, tt.labels, req.Options.Labels)
			require.Equal(t, []*resourcepb.ResourceSearchRequest_Sort{{Field: "email", Desc: true}, {Field: "title"}}, req.SortBy)
			require.Equal(t, resourcepb.ResourceSearchRequest_FIELD_VALUES, req.ResultFormat)
			require.Equal(t, []string{resource.SEARCH_FIELD_TITLE, builders.TEAM_SEARCH_EMAIL, builders.TEAM_SEARCH_PROVISIONED, builders.TEAM_SEARCH_EXTERNAL_UID, teamsearch.LegacyIDField}, req.Fields)
			require.False(t, req.Explain)
		})
	}
}

func TestUnifiedTeamSearchResponseFormats(t *testing.T) {
	for _, format := range []resourcepb.ResourceSearchRequest_ResultFormat{
		resourcepb.ResourceSearchRequest_UNSPECIFIED,
		resourcepb.ResourceSearchRequest_RESOURCE_TABLE,
		resourcepb.ResourceSearchRequest_FIELD_VALUES,
	} {
		t.Run(format.String(), func(t *testing.T) {
			response := &resourcepb.ResourceSearchResponse{ResultFormat: format, TotalHits: 5, QueryCost: 2, MaxScore: 3}
			if format == resourcepb.ResourceSearchRequest_FIELD_VALUES {
				response.Fields = []*resourcepb.ResourceSearchField{
					{Name: "title", Type: resourcepb.ResourceSearchField_STRING},
					{Name: "email", Type: resourcepb.ResourceSearchField_STRING},
					{Name: "provisioned", Type: resourcepb.ResourceSearchField_BOOLEAN},
					{Name: "externalUID", Type: resourcepb.ResourceSearchField_STRING},
					{Name: teamsearch.LegacyIDField, Type: resourcepb.ResourceSearchField_STRING},
				}
				response.Rows = []*resourcepb.ResourceSearchRow{{
					Key: &resourcepb.ResourceKey{Name: "team-1"},
					Values: []*resourcepb.ResourceSearchValue{
						{FieldIndex: 0, StringValues: []string{"Engineering"}},
						{FieldIndex: 1, StringValues: []string{"team@example.com"}},
						{FieldIndex: 2, BooleanValues: []bool{true}},
						{FieldIndex: 3, StringValues: []string{"external-1"}},
						{FieldIndex: 4, StringValues: []string{"42"}},
					},
				}}
			} else {
				response.Results = &resourcepb.ResourceTable{
					Columns: []*resourcepb.ResourceTableColumnDefinition{{Name: "title"}, {Name: "email"}, {Name: "provisioned"}, {Name: "externalUID"}, {Name: teamsearch.LegacyIDField}},
					Rows: []*resourcepb.ResourceTableRow{{
						Key:   &resourcepb.ResourceKey{Name: "team-1"},
						Cells: [][]byte{[]byte("Engineering"), []byte("team@example.com"), []byte("true"), []byte("external-1"), []byte("42")},
					}},
				}
			}
			client := &MockClient{MockResponses: []*resourcepb.ResourceSearchResponse{response, response}}
			backend := NewUnifiedSearchClient(client)
			result, err := backend.Search(t.Context(), SearchQuery{Offset: 15})
			require.NoError(t, err)
			id := int64(42)
			require.Equal(t, &iamv0.GetSearchTeamsResponse{GetSearchTeamsBody: iamv0.GetSearchTeamsBody{
				Offset: 15, TotalHits: 5, QueryCost: 2, MaxScore: 3,
				Hits: []iamv0.GetSearchTeamsTeamHit{{Name: "team-1", Title: "Engineering", Email: "team@example.com", Provisioned: true, ExternalUID: "external-1", InternalId: &id}},
			}}, result)

			ctx := identity.WithRequester(t.Context(), &user.SignedInUser{Namespace: "stacks-1"})
			obj := &iamv0.Team{ObjectMeta: metav1.ObjectMeta{Name: "new-team"}, Spec: iamv0.TeamSpec{Title: "Engineering"}}
			err = ValidateOnCreate(ctx, selectorForBackend(backend), obj, legacy.NoopExternalGroupReconciler{})
			require.True(t, apierrors.IsConflict(err), "expected conflict, got %v", err)
		})
	}
}

func TestUnifiedTeamSearchErrors(t *testing.T) {
	wantErr := errors.New("index down")
	_, err := NewUnifiedSearchClient(&MockClient{MockError: wantErr}).Search(t.Context(), SearchQuery{})
	require.ErrorIs(t, err, wantErr)

	for _, tt := range []struct {
		name     string
		response *resourcepb.ResourceSearchResponse
		err      string
	}{
		{name: "response error", response: &resourcepb.ResourceSearchResponse{Error: &resourcepb.ErrorResult{Code: 500, Message: "index down"}}, err: "index down"},
		{name: "unsupported format", response: &resourcepb.ResourceSearchResponse{ResultFormat: resourcepb.ResourceSearchRequest_ResultFormat(99)}, err: "unsupported search result format"},
		{name: "invalid field value", response: &resourcepb.ResourceSearchResponse{ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES, Rows: []*resourcepb.ResourceSearchRow{{}}}, err: "has no resource key"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			client := &MockClient{MockResponses: []*resourcepb.ResourceSearchResponse{tt.response}}
			result, err := NewUnifiedSearchClient(client).Search(t.Context(), SearchQuery{})
			require.ErrorContains(t, err, tt.err)
			require.Nil(t, result)
		})
	}
}
