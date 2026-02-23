package search

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestParseResults(t *testing.T) {
	t.Run("should parse results", func(t *testing.T) {
		searchResp := &resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{
						Name: "title",
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: "email",
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: "provisioned",
						Type: resourcepb.ResourceTableColumnDefinition_BOOLEAN,
					},
					{
						Name: "externalUID",
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
				},
				Rows: []*resourcepb.ResourceTableRow{
					{
						Key: &resourcepb.ResourceKey{
							Name:     "uid",
							Resource: "team",
						},
						Cells: [][]byte{
							[]byte("Team 1"),
							[]byte("team1@example.com"),
							[]byte("true"),
							[]byte("team1-uid"),
						},
					},
				},
			},
			TotalHits: 1,
		}

		results, err := ParseResults(searchResp, 0)
		require.NoError(t, err)
		require.Len(t, results.Hits, 1)
		require.Equal(t, "Team 1", results.Hits[0].Title)
		require.Equal(t, "team1@example.com", results.Hits[0].Email)
		require.True(t, results.Hits[0].Provisioned)
		require.Equal(t, "team1-uid", results.Hits[0].ExternalUID)
	})

	t.Run("should handle nil result", func(t *testing.T) {
		results, err := ParseResults(nil, 0)
		require.NoError(t, err)
		require.Empty(t, results.Hits)
		require.Zero(t, results.TotalHits)
	})

	t.Run("should handle nil Results", func(t *testing.T) {
		searchResp := &resourcepb.ResourceSearchResponse{
			Results:   nil,
			TotalHits: 0,
		}

		results, err := ParseResults(searchResp, 0)
		require.NoError(t, err)
		require.Empty(t, results.Hits)
		require.Zero(t, results.TotalHits)
	})

	t.Run("should handle nil Results.Rows", func(t *testing.T) {
		searchResp := &resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{
						Name: "title",
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
				},
				Rows: nil,
			},
			TotalHits: 0,
		}

		results, err := ParseResults(searchResp, 0)
		require.NoError(t, err)
		require.Empty(t, results.Hits)
		require.Zero(t, results.TotalHits)
	})

	t.Run("should return error for mismatched number of columns and cells", func(t *testing.T) {
		searchResp := &resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{
						Name: "title",
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: "email",
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: "provisioned",
						Type: resourcepb.ResourceTableColumnDefinition_BOOLEAN,
					},
				},
				Rows: []*resourcepb.ResourceTableRow{
					{
						Key: &resourcepb.ResourceKey{
							Name:     "uid",
							Resource: "team",
						},
						Cells: [][]byte{
							[]byte("Team 1"),
							[]byte("team1@example.com"),
						},
					},
				},
			},
			TotalHits: 1,
		}

		results, err := ParseResults(searchResp, 0)
		require.Error(t, err)
		require.Contains(t, err.Error(), "mismatch number of columns and cells")
		require.Empty(t, results.Hits)
	})

	t.Run("should return error for error response", func(t *testing.T) {
		searchResp := &resourcepb.ResourceSearchResponse{
			Error: &resourcepb.ErrorResult{
				Code:    500,
				Message: "Internal server error",
				Details: &resourcepb.ErrorDetails{
					Name: "test-resource",
				},
			},
		}

		results, err := ParseResults(searchResp, 0)
		require.Error(t, err)
		require.Contains(t, err.Error(), "500 error searching: Internal server error")
		require.Empty(t, results.Hits)
	})

	t.Run("should use (no title) fallback when title cell is nil", func(t *testing.T) {
		searchResp := &resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{
						Name: "title",
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: "email",
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
				},
				Rows: []*resourcepb.ResourceTableRow{
					{
						Key: &resourcepb.ResourceKey{
							Name:     "uid",
							Resource: "team",
						},
						Cells: [][]byte{
							nil, // title cell is nil
							[]byte("team1@example.com"),
						},
					},
				},
			},
			TotalHits: 1,
		}

		results, err := ParseResults(searchResp, 0)
		require.NoError(t, err)
		require.Len(t, results.Hits, 1)
		require.Equal(t, "(no title)", results.Hits[0].Title)
		require.Equal(t, "team1@example.com", results.Hits[0].Email)
	})

	t.Run("should use (no title) fallback when title column is missing", func(t *testing.T) {
		searchResp := &resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{
						Name: "email",
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: "provisioned",
						Type: resourcepb.ResourceTableColumnDefinition_BOOLEAN,
					},
				},
				Rows: []*resourcepb.ResourceTableRow{
					{
						Key: &resourcepb.ResourceKey{
							Name:     "uid",
							Resource: "team",
						},
						Cells: [][]byte{
							[]byte("team1@example.com"),
							[]byte("true"),
						},
					},
				},
			},
			TotalHits: 1,
		}

		results, err := ParseResults(searchResp, 0)
		require.NoError(t, err)
		require.Len(t, results.Hits, 1)
		require.Equal(t, "(no title)", results.Hits[0].Title)
		require.Equal(t, "team1@example.com", results.Hits[0].Email)
		require.True(t, results.Hits[0].Provisioned)
	})
}
