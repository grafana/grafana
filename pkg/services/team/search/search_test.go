package search

import (
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

func TestParseResultsPreservesErrorStatus(t *testing.T) {
	_, err := ParseResults(&resourcepb.ResourceSearchResponse{Error: &resourcepb.ErrorResult{
		Code: 429, Message: "search is busy",
	}}, 0)
	require.True(t, apierrors.IsTooManyRequests(err), "got %v", err)
}

func TestParseResults(t *testing.T) {
	t.Run("should parse field-value results", func(t *testing.T) {
		searchResp := &resourcepb.ResourceSearchResponse{
			ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
			Fields: []*resourcepb.ResourceSearchField{
				{Name: resource.SEARCH_FIELD_TITLE, Type: resourcepb.ResourceSearchField_STRING},
				{Name: builders.TEAM_SEARCH_EMAIL, Type: resourcepb.ResourceSearchField_STRING},
				{Name: builders.TEAM_SEARCH_PROVISIONED, Type: resourcepb.ResourceSearchField_BOOLEAN},
				{Name: builders.TEAM_SEARCH_EXTERNAL_UID, Type: resourcepb.ResourceSearchField_STRING},
				{Name: LegacyIDField, Type: resourcepb.ResourceSearchField_STRING},
			},
			Rows: []*resourcepb.ResourceSearchRow{{
				Key: &resourcepb.ResourceKey{Name: "uid", Resource: "teams"},
				Values: []*resourcepb.ResourceSearchValue{
					{FieldIndex: 0, StringValues: []string{"Team 1"}},
					{FieldIndex: 1, StringValues: []string{"team1@example.com"}},
					{FieldIndex: 2, BooleanValues: []bool{true}},
					{FieldIndex: 3, StringValues: []string{"team1-uid"}},
					{FieldIndex: 4, StringValues: []string{"42"}},
				},
			}},
			TotalHits: 1,
			QueryCost: 2,
			MaxScore:  3,
		}

		results, err := ParseResults(searchResp, 4)
		require.NoError(t, err)
		require.Equal(t, int64(4), results.Offset)
		require.Equal(t, int64(1), results.TotalHits)
		require.Equal(t, float64(2), results.QueryCost)
		require.Equal(t, float64(3), results.MaxScore)
		require.Len(t, results.Hits, 1)
		require.Equal(t, "uid", results.Hits[0].Name)
		require.Equal(t, "Team 1", results.Hits[0].Title)
		require.Equal(t, "team1@example.com", results.Hits[0].Email)
		require.True(t, results.Hits[0].Provisioned)
		require.Equal(t, "team1-uid", results.Hits[0].ExternalUID)
		require.NotNil(t, results.Hits[0].InternalId)
		require.Equal(t, int64(42), *results.Hits[0].InternalId)
	})

	t.Run("should handle empty results", func(t *testing.T) {
		for _, response := range []*resourcepb.ResourceSearchResponse{
			nil,
			{ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES},
		} {
			results, err := ParseResults(response, 0)
			require.NoError(t, err)
			require.Empty(t, results.Hits)
			require.Zero(t, results.TotalHits)
		}
	})

	t.Run("should reject unsupported result formats", func(t *testing.T) {
		for _, format := range []resourcepb.ResourceSearchRequest_ResultFormat{
			resourcepb.ResourceSearchRequest_UNSPECIFIED,
			resourcepb.ResourceSearchRequest_RESOURCE_TABLE,
			99,
		} {
			t.Run(format.String(), func(t *testing.T) {
				_, err := ParseResults(&resourcepb.ResourceSearchResponse{ResultFormat: format}, 0)
				require.ErrorContains(t, err, "unsupported search result format")
			})
		}
	})

	t.Run("should reject malformed rows", func(t *testing.T) {
		for _, row := range []*resourcepb.ResourceSearchRow{
			nil,
			{},
			{Key: &resourcepb.ResourceKey{Name: "uid"}, Values: []*resourcepb.ResourceSearchValue{{FieldIndex: 0}}},
		} {
			_, err := ParseResults(&resourcepb.ResourceSearchResponse{
				ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
				Rows:         []*resourcepb.ResourceSearchRow{row},
			}, 0)
			require.Error(t, err)
		}
	})

	t.Run("should use title fallback for an absent title", func(t *testing.T) {
		response := &resourcepb.ResourceSearchResponse{
			ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
			Fields:       []*resourcepb.ResourceSearchField{{Name: resource.SEARCH_FIELD_TITLE, Type: resourcepb.ResourceSearchField_STRING}},
			Rows:         []*resourcepb.ResourceSearchRow{{Key: &resourcepb.ResourceKey{Name: "uid"}}},
		}
		for _, fields := range [][]*resourcepb.ResourceSearchField{response.Fields, nil} {
			response.Fields = fields
			results, err := ParseResults(response, 0)
			require.NoError(t, err)
			require.Len(t, results.Hits, 1)
			require.Equal(t, "(no title)", results.Hits[0].Title)
		}
	})
}
