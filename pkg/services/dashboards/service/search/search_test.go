package dashboardsearch

import (
	"testing"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/search"
	"github.com/stretchr/testify/require"
)

// regression test - parsing int32 values from search results was causing a panic
func TestParseResults(t *testing.T) {
	resSearchResp := &resource.ResourceSearchResponse{
		Results: &resource.ResourceTable{
			Columns: []*resource.ResourceTableColumnDefinition{
				{
					Name: "title",
					Type: resource.ResourceTableColumnDefinition_STRING,
				},
				{
					Name: "folder",
					Type: resource.ResourceTableColumnDefinition_STRING,
				},
				{
					Name: search.DASHBOARD_ERRORS_LAST_1_DAYS,
					Type: resource.ResourceTableColumnDefinition_INT64,
				},
				{
					Name: search.DASHBOARD_LINK_COUNT,
					Type: resource.ResourceTableColumnDefinition_INT32,
				},
			},
			Rows: []*resource.ResourceTableRow{
				{
					Key: &resource.ResourceKey{
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
}
