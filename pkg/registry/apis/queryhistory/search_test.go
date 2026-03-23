package queryhistory

import (
	"encoding/binary"
	"net/http"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

func TestConvertSearchParams(t *testing.T) {
	params := url.Values{
		"datasourceUid": {"ds-1", "ds-2"},
		"query":         {"my search"},
		"sort":          {"time-desc"},
		"limit":         {"50"},
		"page":          {"2"},
	}

	req, _ := http.NewRequest("GET", "/search?"+params.Encode(), nil)
	searchReq, err := convertSearchParamsFromURL(req.URL, "default", "user-abc")
	require.NoError(t, err)
	require.NotNil(t, searchReq)

	assert.Equal(t, int64(50), searchReq.Limit)
	assert.Equal(t, int64(2), searchReq.Page)
	assert.Equal(t, "my search", searchReq.Query)
	assert.Len(t, searchReq.SortBy, 1)
	assert.Equal(t, resource.SEARCH_FIELD_CREATED, searchReq.SortBy[0].Field)
	assert.True(t, searchReq.SortBy[0].Desc)

	// Verify resource key
	require.NotNil(t, searchReq.Options)
	require.NotNil(t, searchReq.Options.Key)
	assert.Equal(t, "default", searchReq.Options.Key.Namespace)
	assert.Equal(t, "queryhistory.grafana.app", searchReq.Options.Key.Group)
	assert.Equal(t, "queryhistories", searchReq.Options.Key.Resource)

	// Should have privacy filter + datasource filter
	require.GreaterOrEqual(t, len(searchReq.Options.Fields), 2)

	// Verify privacy filter
	privacyFilter := searchReq.Options.Fields[0]
	assert.Equal(t, resource.SEARCH_FIELD_PREFIX+builders.QH_CREATED_BY, privacyFilter.Key)
	assert.Equal(t, "=", privacyFilter.Operator)
	assert.Equal(t, []string{"user-abc"}, privacyFilter.Values)

	// Verify datasource filter
	dsFilter := searchReq.Options.Fields[1]
	assert.Equal(t, resource.SEARCH_FIELD_PREFIX+builders.QH_DATASOURCE_UID, dsFilter.Key)
	assert.Equal(t, "in", dsFilter.Operator)
	assert.Equal(t, []string{"ds-1", "ds-2"}, dsFilter.Values)
}

func TestConvertSearchParamsDefaults(t *testing.T) {
	req, _ := http.NewRequest("GET", "/search", nil)
	searchReq, err := convertSearchParamsFromURL(req.URL, "default", "user-abc")
	require.NoError(t, err)
	require.NotNil(t, searchReq)

	assert.Equal(t, int64(0), searchReq.Limit)
	assert.Equal(t, int64(0), searchReq.Page)
	assert.Empty(t, searchReq.Query)
	assert.Empty(t, searchReq.SortBy)

	// Should still have privacy filter
	require.NotNil(t, searchReq.Options)
	require.Len(t, searchReq.Options.Fields, 1)
	assert.Equal(t, resource.SEARCH_FIELD_PREFIX+builders.QH_CREATED_BY, searchReq.Options.Fields[0].Key)
}

func TestConvertSearchParamsTimeRange(t *testing.T) {
	params := url.Values{
		"from": {"1700000000"},
		"to":   {"1700086400"},
	}

	req, _ := http.NewRequest("GET", "/search?"+params.Encode(), nil)
	searchReq, err := convertSearchParamsFromURL(req.URL, "default", "user-abc")
	require.NoError(t, err)

	// Privacy filter + from + to = 3 field requirements
	require.Len(t, searchReq.Options.Fields, 3)

	fromFilter := searchReq.Options.Fields[1]
	assert.Equal(t, resource.SEARCH_FIELD_CREATED, fromFilter.Key)
	assert.Equal(t, ">=", fromFilter.Operator)
	assert.Equal(t, []string{"1700000000"}, fromFilter.Values)

	toFilter := searchReq.Options.Fields[2]
	assert.Equal(t, resource.SEARCH_FIELD_CREATED, toFilter.Key)
	assert.Equal(t, "<=", toFilter.Operator)
	assert.Equal(t, []string{"1700086400"}, toFilter.Values)
}

func TestConvertSearchResults(t *testing.T) {
	t.Run("nil result", func(t *testing.T) {
		resp := convertSearchResults(nil)
		assert.Empty(t, resp.Items)
		assert.Nil(t, resp.TotalCount)
	})

	t.Run("with rows", func(t *testing.T) {
		createdBytes := make([]byte, 8)
		binary.BigEndian.PutUint64(createdBytes, uint64(1700000000))

		result := &resourcepb.ResourceSearchResponse{
			TotalHits: 1,
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{Name: resource.SEARCH_FIELD_PREFIX + builders.QH_COMMENT},
					{Name: resource.SEARCH_FIELD_PREFIX + builders.QH_DATASOURCE_UID},
					{Name: resource.SEARCH_FIELD_CREATED},
				},
				Rows: []*resourcepb.ResourceTableRow{
					{
						Key: &resourcepb.ResourceKey{Name: "qh-uid-1"},
						Cells: [][]byte{
							[]byte("my comment"),
							[]byte("ds-abc"),
							createdBytes,
						},
					},
				},
			},
		}

		resp := convertSearchResults(result)
		require.Len(t, resp.Items, 1)
		assert.Equal(t, int64(1), *resp.TotalCount)

		item := resp.Items[0]
		assert.Equal(t, "qh-uid-1", item.UID)
		assert.Equal(t, "my comment", item.Comment)
		assert.Equal(t, "ds-abc", item.DatasourceUID)
		assert.Equal(t, int64(1700000000), item.CreatedAt)
	})
}
