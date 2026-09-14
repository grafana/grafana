package dashboardsearch

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

// regression test - parsing int32 values from search results was causing a panic
func TestParseResults(t *testing.T) {
	t.Run("should parse results", func(t *testing.T) {
		resSearchResp := &resourcepb.ResourceSearchResponse{
			ResultFormat: resourcepb.ResourceSearchRequest_RESOURCE_TABLE,
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
						Name: builders.DASHBOARD_ERRORS_LAST_1_DAYS,
						Type: resourcepb.ResourceTableColumnDefinition_INT64,
					},
					{
						Name: builders.DASHBOARD_LINK_COUNT,
						Type: resourcepb.ResourceTableColumnDefinition_INT32,
					},
					{
						Name: "description",
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
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
							[]byte("description"),
						},
					},
				},
			},
			TotalHits: 1,
		}

		results, err := ParseResults(resSearchResp, 0)
		require.NoError(t, err)
		require.Len(t, results.Hits, 1)
		require.Equal(t, "description", results.Hits[0].Description)
	})

	t.Run("should parse field-value results", func(t *testing.T) {
		score := 0.75
		resSearchResp := &resourcepb.ResourceSearchResponse{
			ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
			Fields: []*resourcepb.ResourceSearchField{
				{Name: resource.SEARCH_FIELD_TITLE, Type: resourcepb.ResourceSearchField_STRING},
				{Name: resource.SEARCH_FIELD_FOLDER, Type: resourcepb.ResourceSearchField_STRING},
				{Name: resource.SEARCH_FIELD_TAGS, Type: resourcepb.ResourceSearchField_STRING, IsArray: true},
				{Name: resource.SEARCH_FIELD_DESCRIPTION, Type: resourcepb.ResourceSearchField_STRING},
				{Name: resource.SEARCH_FIELD_MANAGER_KIND, Type: resourcepb.ResourceSearchField_STRING},
				{Name: resource.SEARCH_FIELD_MANAGER_ID, Type: resourcepb.ResourceSearchField_STRING},
				{Name: resource.SEARCH_FIELD_OWNER_REFERENCES, Type: resourcepb.ResourceSearchField_STRING, IsArray: true},
				{Name: builders.DASHBOARD_ERRORS_LAST_1_DAYS, Type: resourcepb.ResourceSearchField_INT64},
				{Name: "customFlags", Type: resourcepb.ResourceSearchField_BOOLEAN, IsArray: true},
			},
			Rows: []*resourcepb.ResourceSearchRow{{
				Key:   &resourcepb.ResourceKey{Name: "uid", Resource: "dashboards"},
				Score: &score,
				Values: []*resourcepb.ResourceSearchValue{
					{FieldIndex: 0, StringValues: []string{"Dashboard 1"}},
					{FieldIndex: 1, StringValues: []string{"folder1"}},
					{FieldIndex: 2, StringValues: []string{"tag1", "tag2"}},
					{FieldIndex: 3, StringValues: []string{"description"}},
					{FieldIndex: 4, StringValues: []string{"repo"}},
					{FieldIndex: 5, StringValues: []string{"manager"}},
					{FieldIndex: 6, StringValues: []string{"iam.grafana.app/Team/devops"}},
					{FieldIndex: 7, Int64Values: []int64{100}},
					{FieldIndex: 8, BooleanValues: []bool{true, false}},
				},
			}},
			TotalHits: 1,
		}

		results, err := ParseResults(resSearchResp, 4)
		require.NoError(t, err)
		require.Len(t, results.Hits, 1)
		hit := results.Hits[0]
		assert.Equal(t, int64(4), results.Offset)
		assert.Equal(t, "Dashboard 1", hit.Title)
		assert.Equal(t, "folder1", hit.Folder)
		assert.Equal(t, []string{"tag1", "tag2"}, hit.Tags)
		assert.Equal(t, "description", hit.Description)
		assert.Equal(t, "repo", string(hit.ManagedBy.Kind))
		assert.Equal(t, "manager", hit.ManagedBy.ID)
		assert.Equal(t, []string{"iam.grafana.app/Team/devops"}, hit.OwnerReferences)
		assert.Equal(t, score, hit.Score)
		assert.Equal(t, int64(100), hit.Field.Object[builders.DASHBOARD_ERRORS_LAST_1_DAYS])
		assert.Equal(t, []any{true, false}, hit.Field.Object["customFlags"])
	})

	t.Run("should reject an invalid field-value index", func(t *testing.T) {
		resSearchResp := &resourcepb.ResourceSearchResponse{
			ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
			Fields:       []*resourcepb.ResourceSearchField{{Name: resource.SEARCH_FIELD_TITLE, Type: resourcepb.ResourceSearchField_STRING}},
			Rows: []*resourcepb.ResourceSearchRow{{
				Key:    &resourcepb.ResourceKey{Name: "uid", Resource: "dashboards"},
				Values: []*resourcepb.ResourceSearchValue{{FieldIndex: 1, StringValues: []string{"Dashboard 1"}}},
			}},
		}

		_, err := ParseResults(resSearchResp, 0)
		require.ErrorContains(t, err, "field index 1 is out of range")
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
						Name: builders.DASHBOARD_ERRORS_LAST_1_DAYS,
						Type: resourcepb.ResourceTableColumnDefinition_INT64,
					},
					{
						Name: builders.DASHBOARD_LINK_COUNT,
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

	t.Run("should preserve the status of a response error", func(t *testing.T) {
		resSearchResp := &resourcepb.ResourceSearchResponse{
			Error: resource.AsErrorResult(apierrors.NewServiceUnavailable("search unavailable")),
		}

		_, err := ParseResults(resSearchResp, 0)
		require.Error(t, err)
		// The 503 status must survive so retry classification can detect it.
		require.True(t, apierrors.IsServiceUnavailable(err))
	})
}

func makeRow(name string) *resourcepb.ResourceTableRow {
	return &resourcepb.ResourceTableRow{
		Key: &resourcepb.ResourceKey{
			Name:     name,
			Resource: "dashboards",
		},
		Cells: [][]byte{[]byte(name)},
	}
}

func makeResponse(names []string, totalHits int64) *resourcepb.ResourceSearchResponse {
	rows := make([]*resourcepb.ResourceTableRow, len(names))
	for i, n := range names {
		rows[i] = makeRow(n)
	}
	return &resourcepb.ResourceSearchResponse{
		Results: &resourcepb.ResourceTable{
			Columns: []*resourcepb.ResourceTableColumnDefinition{
				{Name: "title", Type: resourcepb.ResourceTableColumnDefinition_STRING},
			},
			Rows: rows,
		},
		TotalHits: totalHits,
	}
}

func TestSearchAll(t *testing.T) {
	t.Run("single page - all results fit in one request", func(t *testing.T) {
		callCount := 0
		searchFn := func(_ context.Context, _ int64, _ *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
			callCount++
			return makeResponse([]string{"a", "b", "c"}, 3), nil
		}

		req := &resourcepb.ResourceSearchRequest{Limit: 10}
		results, err := SearchAll(context.Background(), 1, req, searchFn)
		require.NoError(t, err)
		assert.Len(t, results.Hits, 3)
		assert.Equal(t, 1, callCount)
	})

	t.Run("multiple pages - paginates until all results fetched", func(t *testing.T) {
		callCount := 0
		searchFn := func(_ context.Context, _ int64, req *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
			callCount++
			switch req.Offset {
			case 0:
				return makeResponse([]string{"a", "b"}, 5), nil
			case 2:
				return makeResponse([]string{"c", "d"}, 5), nil
			case 4:
				return makeResponse([]string{"e"}, 5), nil
			default:
				return makeResponse([]string{}, 5), nil
			}
		}

		req := &resourcepb.ResourceSearchRequest{Limit: 2}
		results, err := SearchAll(context.Background(), 1, req, searchFn)
		require.NoError(t, err)
		assert.Len(t, results.Hits, 5)
		assert.Equal(t, "a", results.Hits[0].Title)
		assert.Equal(t, "e", results.Hits[4].Title)
		assert.Equal(t, 3, callCount)
	})

	t.Run("sets default limit when zero", func(t *testing.T) {
		var capturedLimit int64
		searchFn := func(_ context.Context, _ int64, req *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
			capturedLimit = req.Limit
			return makeResponse([]string{"a"}, 1), nil
		}

		req := &resourcepb.ResourceSearchRequest{Limit: 0}
		_, err := SearchAll(context.Background(), 1, req, searchFn)
		require.NoError(t, err)
		assert.Equal(t, int64(100000), capturedLimit)
	})

	t.Run("resets page and offset before first call", func(t *testing.T) {
		var capturedPage, capturedOffset int64
		searchFn := func(_ context.Context, _ int64, req *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
			capturedPage = req.Page
			capturedOffset = req.Offset
			return makeResponse([]string{"a"}, 1), nil
		}

		req := &resourcepb.ResourceSearchRequest{Limit: 10, Page: 5, Offset: 999}
		_, err := SearchAll(context.Background(), 1, req, searchFn)
		require.NoError(t, err)
		assert.Equal(t, int64(1), capturedPage)
		assert.Equal(t, int64(0), capturedOffset)
	})

	t.Run("increments page on each request", func(t *testing.T) {
		var pages []int64
		searchFn := func(_ context.Context, _ int64, req *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
			pages = append(pages, req.Page)
			switch req.Offset {
			case 0:
				return makeResponse([]string{"a"}, 3), nil
			case 1:
				return makeResponse([]string{"b"}, 3), nil
			case 2:
				return makeResponse([]string{"c"}, 3), nil
			default:
				return makeResponse([]string{}, 3), nil
			}
		}

		req := &resourcepb.ResourceSearchRequest{Limit: 1}
		_, err := SearchAll(context.Background(), 1, req, searchFn)
		require.NoError(t, err)
		assert.Equal(t, []int64{1, 2, 3}, pages)
	})

	t.Run("returns empty results when no hits", func(t *testing.T) {
		searchFn := func(_ context.Context, _ int64, _ *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
			return makeResponse(nil, 0), nil
		}

		req := &resourcepb.ResourceSearchRequest{Limit: 10}
		results, err := SearchAll(context.Background(), 1, req, searchFn)
		require.NoError(t, err)
		assert.Empty(t, results.Hits)
	})

	t.Run("breaks on empty page to prevent infinite loop", func(t *testing.T) {
		callCount := 0
		searchFn := func(_ context.Context, _ int64, _ *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
			callCount++
			if callCount == 1 {
				return makeResponse([]string{"a"}, 100), nil
			}
			return makeResponse([]string{}, 100), nil
		}

		req := &resourcepb.ResourceSearchRequest{Limit: 10}
		results, err := SearchAll(context.Background(), 1, req, searchFn)
		require.NoError(t, err)
		assert.Len(t, results.Hits, 1)
		assert.Equal(t, 2, callCount, "should stop after one empty page")
	})

	t.Run("propagates search error on first call", func(t *testing.T) {
		searchFn := func(_ context.Context, _ int64, _ *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
			return nil, fmt.Errorf("connection refused")
		}

		req := &resourcepb.ResourceSearchRequest{Limit: 10}
		_, err := SearchAll(context.Background(), 1, req, searchFn)
		require.ErrorContains(t, err, "connection refused")
	})

	t.Run("propagates search error on subsequent page", func(t *testing.T) {
		callCount := 0
		searchFn := func(_ context.Context, _ int64, _ *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
			callCount++
			if callCount == 1 {
				return makeResponse([]string{"a", "b"}, 10), nil
			}
			return nil, fmt.Errorf("timeout")
		}

		req := &resourcepb.ResourceSearchRequest{Limit: 2}
		_, err := SearchAll(context.Background(), 1, req, searchFn)
		require.ErrorContains(t, err, "timeout")
	})

	t.Run("advances offset by actual hits received", func(t *testing.T) {
		var offsets []int64
		searchFn := func(_ context.Context, _ int64, req *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
			offsets = append(offsets, req.Offset)
			switch req.Offset {
			case 0:
				return makeResponse([]string{"a", "b", "c"}, 7), nil
			case 3:
				return makeResponse([]string{"d", "e"}, 7), nil
			case 5:
				return makeResponse([]string{"f", "g"}, 7), nil
			default:
				return makeResponse([]string{}, 7), nil
			}
		}

		req := &resourcepb.ResourceSearchRequest{Limit: 3}
		results, err := SearchAll(context.Background(), 1, req, searchFn)
		require.NoError(t, err)
		assert.Len(t, results.Hits, 7)
		assert.Equal(t, []int64{0, 3, 5}, offsets)
	})
}
