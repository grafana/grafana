package dashboardsearch

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search"
)

// regression test - parsing int32 values from search results was causing a panic
func TestParseResults(t *testing.T) {
	t.Run("should parse results", func(t *testing.T) {
		resSearchResp := &resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{
						Name: "title",
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: "folder",
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: search.DASHBOARD_ERRORS_LAST_1_DAYS,
						Type: resourcepb.ResourceTableColumnDefinition_INT64,
					},
					{
						Name: search.DASHBOARD_LINK_COUNT,
						Type: resourcepb.ResourceTableColumnDefinition_INT32,
					},
				},
				Rows: []*resourcepb.ResourceTableRow{
					{
						Key: &resourcepb.ResourceKey{
							Name:     "uid",
							Resource: "dashboard",
						},
						Cells: [][]byte{
							[]byte("Dashboard 1"),
							[]byte("folder1"),
							[]byte("100"),
							[]byte("25"),
						},
					},
				},
			},
			TotalHits: 1,
		}

		_, err := ParseResults(resSearchResp, 0)
		require.NoError(t, err)
	})

	t.Run("should return error when trying to parse results with mismatch length between Columns and row Cells", func(t *testing.T) {
		resSearchResp := &resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{
						Name: "title",
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: "folder",
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: search.DASHBOARD_ERRORS_LAST_1_DAYS,
						Type: resourcepb.ResourceTableColumnDefinition_INT64,
					},
					{
						Name: search.DASHBOARD_LINK_COUNT,
						Type: resourcepb.ResourceTableColumnDefinition_INT32,
					},
					{
						Name: resource.SEARCH_FIELD_LEGACY_ID,
						Type: resourcepb.ResourceTableColumnDefinition_INT64,
					},
				},
				Rows: []*resourcepb.ResourceTableRow{
					{
						Key: &resourcepb.ResourceKey{
							Name:     "uid",
							Resource: "dashboard",
						},
						Cells: [][]byte{
							[]byte("Dashboard 1"),
							[]byte("folder1"),
							[]byte("100"),
							[]byte("25"),
						},
					},
				},
			},
			TotalHits: 1,
		}

		_, err := ParseResults(resSearchResp, 0)
		require.Error(t, err)
	})
}
