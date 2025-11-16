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
}
