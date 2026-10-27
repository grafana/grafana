package dashboardsearch

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/endpoints/handlers/responsewriters"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

func TestParseResults(t *testing.T) {
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
				{Name: resource.SEARCH_FIELD_LEGACY_ID, Type: resourcepb.ResourceSearchField_INT64},
				{Name: builders.DASHBOARD_LINK_COUNT, Type: resourcepb.ResourceSearchField_INT64},
			},
			Rows: []*resourcepb.ResourceSearchRow{{
				Key:             &resourcepb.ResourceKey{Name: "uid", Resource: "dashboards"},
				ResourceVersion: 9007199254740993,
				Score:           &score,
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
					{FieldIndex: 9, Int64Values: []int64{42}},
					{FieldIndex: 10, Int64Values: []int64{25}},
				},
			}},
			TotalHits: 1,
			QueryCost: 2,
			MaxScore:  score,
			Facet: map[string]*resourcepb.ResourceSearchResponse_Facet{
				"tags": {Field: "tags", Total: 2, Missing: 1, Terms: []*resourcepb.ResourceSearchResponse_TermFacet{{Term: "tag1", Count: 1}, {Term: "tag2", Count: 1}}},
			},
		}

		results, err := ParseResults(resSearchResp, 4)
		require.NoError(t, err)
		require.Len(t, results.Hits, 1)
		hit := results.Hits[0]
		assert.Equal(t, int64(4), results.Offset)
		assert.Equal(t, int64(1), results.TotalHits)
		assert.Equal(t, float64(2), results.QueryCost)
		assert.Equal(t, score, results.MaxScore)
		assert.Equal(t, "tags", results.Facets["tags"].Field)
		assert.Equal(t, int64(2), results.Facets["tags"].Total)
		assert.Equal(t, int64(1), results.Facets["tags"].Missing)
		require.Len(t, results.Facets["tags"].Terms, 2)
		assert.Equal(t, "tag1", results.Facets["tags"].Terms[0].Term)
		assert.Equal(t, int64(1), results.Facets["tags"].Terms[0].Count)
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
		assert.Equal(t, int64(9007199254740993), hit.Field.Object[resource.SEARCH_FIELD_RV])
		assert.Equal(t, int64(42), hit.Field.Object[resource.SEARCH_FIELD_LEGACY_ID])
		assert.Equal(t, int64(25), hit.Field.Object[builders.DASHBOARD_LINK_COUNT])
	})

	t.Run("missing values keep defaults and omit the resource version", func(t *testing.T) {
		results, err := ParseResults(&resourcepb.ResourceSearchResponse{
			ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
			Rows:         []*resourcepb.ResourceSearchRow{{Key: &resourcepb.ResourceKey{Name: "uid", Resource: "dashboards"}}},
		}, 0)
		require.NoError(t, err)
		require.Len(t, results.Hits, 1)
		hit := results.Hits[0]
		assert.Equal(t, "uid", hit.Name)
		assert.Equal(t, "dashboards", hit.Resource)
		assert.Equal(t, "(no title)", hit.Title)
		assert.Empty(t, hit.Tags)
		assert.Zero(t, hit.Score)
		assert.NotContains(t, hit.Field.Object, resource.SEARCH_FIELD_RV)
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

	t.Run("rejects unsupported formats", func(t *testing.T) {
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

	t.Run("rejects rows without a resource key", func(t *testing.T) {
		for _, row := range []*resourcepb.ResourceSearchRow{nil, {}} {
			_, err := ParseResults(&resourcepb.ResourceSearchResponse{
				ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
				Rows:         []*resourcepb.ResourceSearchRow{row},
			}, 0)
			require.ErrorContains(t, err, "has no resource key")
		}
	})
	t.Run("should preserve the status of a response error", func(t *testing.T) {
		resSearchResp := &resourcepb.ResourceSearchResponse{
			Error: resource.AsErrorResult(apierrors.NewServiceUnavailable("search unavailable")),
		}

		_, err := ParseResults(resSearchResp, 0)
		require.Error(t, err)
		require.True(t, apierrors.IsServiceUnavailable(err))
		require.Equal(t, responsewriters.ErrorToAPIStatus(resource.StatusError(resSearchResp.Error)), responsewriters.ErrorToAPIStatus(err))
	})
}

func makeResponse(names []string, totalHits int64) *resourcepb.ResourceSearchResponse {
	rows := make([]*resourcepb.ResourceSearchRow, len(names))
	for i, name := range names {
		rows[i] = &resourcepb.ResourceSearchRow{
			Key:    &resourcepb.ResourceKey{Name: name, Resource: "dashboards"},
			Values: []*resourcepb.ResourceSearchValue{{FieldIndex: 0, StringValues: []string{name}}},
		}
	}
	return &resourcepb.ResourceSearchResponse{
		ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
		Fields:       []*resourcepb.ResourceSearchField{{Name: resource.SEARCH_FIELD_TITLE, Type: resourcepb.ResourceSearchField_STRING}},
		Rows:         rows,
		TotalHits:    totalHits,
	}
}

func TestSearchAll_Errors(t *testing.T) {
	result := dashboardSearchRateLimitResult()
	grpcStatus, err := status.New(codes.ResourceExhausted, result.Message).WithDetails(result)
	require.NoError(t, err)
	for _, tc := range []struct {
		name string
		resp *resourcepb.ResourceSearchResponse
		err  error
	}{
		{name: "embedded", resp: &resourcepb.ResourceSearchResponse{Error: result}},
		{name: "grpc", err: grpcStatus.Err()},
		{name: "wrapped grpc", err: fmt.Errorf("search: %w", grpcStatus.Err())},
		{name: "canceled", err: context.Canceled},
		{name: "wrapped canceled", err: fmt.Errorf("search: %w", context.Canceled)},
		{name: "deadline exceeded", err: context.DeadlineExceeded},
		{name: "unstructured grpc", err: status.Error(codes.Unavailable, "private transport details")},
		{name: "other transport error", err: fmt.Errorf("connection refused")},
		{name: "transport takes precedence", resp: &resourcepb.ResourceSearchResponse{Error: result}, err: fmt.Errorf("connection refused")},
	} {
		for _, errorPage := range []int{1, 2} {
			t.Run(fmt.Sprintf("%s/page %d", tc.name, errorPage), func(t *testing.T) {
				calls := 0
				searchFn := func(_ context.Context, _ int64, _ *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
					calls++
					if calls < errorPage {
						return makeResponse([]string{"dashboard-1"}, 2), nil
					}
					return tc.resp, tc.err
				}
				request := &resourcepb.ResourceSearchRequest{Limit: 1}

				results, err := SearchAll(context.Background(), 1, request, searchFn)

				if tc.err != nil {
					require.True(t, err == tc.err, "transport errors must be returned unchanged") //nolint:errorlint // Assert identity, not merely membership in the error chain.
				} else {
					requireDashboardSearchRateLimitStatus(t, err)
				}
				require.Empty(t, results.Hits, "partial results must not be returned as a complete result")
				require.Equal(t, errorPage, calls)
			})
		}
	}
}

func dashboardSearchRateLimitResult() *resourcepb.ErrorResult {
	return &resourcepb.ErrorResult{
		Code:    http.StatusTooManyRequests,
		Reason:  string(metav1.StatusReasonTooManyRequests),
		Message: "search is busy",
		Details: &resourcepb.ErrorDetails{
			Name:              "dashboard",
			Group:             "dashboard.grafana.app",
			Kind:              "dashboards",
			Uid:               "uid",
			RetryAfterSeconds: 12,
			Causes:            []*resourcepb.ErrorCause{{Reason: "TooManyRequests", Field: "query", Message: "retry later"}},
		},
	}
}

func requireDashboardSearchRateLimitStatus(t *testing.T, err error) {
	t.Helper()

	require.IsType(t, &apierrors.StatusError{}, err)
	apiStatus := err.(apierrors.APIStatus)
	require.Equal(t, metav1.Status{
		Status:  metav1.StatusFailure,
		Code:    http.StatusTooManyRequests,
		Reason:  metav1.StatusReasonTooManyRequests,
		Message: "search is busy",
		Details: &metav1.StatusDetails{
			Name:              "dashboard",
			Group:             "dashboard.grafana.app",
			Kind:              "dashboards",
			UID:               "uid",
			RetryAfterSeconds: 12,
			Causes:            []metav1.StatusCause{{Type: "TooManyRequests", Field: "query", Message: "retry later"}},
		},
	}, apiStatus.Status())
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

// Bare labels and updatedBy have no typed definitions and would break folder search.
func TestFieldValueIncludeFields(t *testing.T) {
	assert.NotContains(t, FieldValueIncludeFields, resource.SEARCH_FIELD_LABELS)
	assert.NotContains(t, FieldValueIncludeFields, resource.SEARCH_FIELD_UPDATED_BY)

	// Per-label fields are typed by the "labels." prefix and must survive; the legacy ID is read
	// back out of them.
	assert.Contains(t, FieldValueIncludeFields, resource.SEARCH_FIELD_LABELS+"."+resource.SEARCH_FIELD_LEGACY_ID)

}
