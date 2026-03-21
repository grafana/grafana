package queryhistory

import (
	"net/http"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
	searchReq, err := convertSearchParams(req, "user-abc")
	require.NoError(t, err)
	require.NotNil(t, searchReq)

	assert.Equal(t, int64(50), searchReq.Limit)
	assert.Equal(t, int64(2), searchReq.Page)
	assert.Equal(t, "my search", searchReq.Query)
	assert.Len(t, searchReq.SortBy, 1)
	assert.True(t, searchReq.SortBy[0].Desc)
}

func TestConvertSearchParamsDefaults(t *testing.T) {
	req, _ := http.NewRequest("GET", "/search", nil)
	searchReq, err := convertSearchParams(req, "user-abc")
	require.NoError(t, err)
	require.NotNil(t, searchReq)

	assert.Equal(t, int64(0), searchReq.Limit)
	assert.Equal(t, int64(0), searchReq.Page)
	assert.Empty(t, searchReq.Query)
	assert.Empty(t, searchReq.SortBy)
}
