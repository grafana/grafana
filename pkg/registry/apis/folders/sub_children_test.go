package folders

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/handlers/responsewriters"
	apirequest "k8s.io/apiserver/pkg/endpoints/request"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type stubGetter struct {
	obj runtime.Object
	err error
}

func (s *stubGetter) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	return s.obj, s.err
}

type capturingSearchClient struct {
	resp *resourcepb.ResourceSearchResponse
	err  error

	mu      sync.Mutex
	lastReq *resourcepb.ResourceSearchRequest
}

func (c *capturingSearchClient) Search(ctx context.Context, in *resourcepb.ResourceSearchRequest, opts ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	c.mu.Lock()
	c.lastReq = in
	c.mu.Unlock()
	return c.resp, c.err
}
func (c *capturingSearchClient) GetStats(ctx context.Context, in *resourcepb.ResourceStatsRequest, opts ...grpc.CallOption) (*resourcepb.ResourceStatsResponse, error) {
	return nil, nil
}
func (c *capturingSearchClient) RebuildIndexes(ctx context.Context, in *resourcepb.RebuildIndexesRequest, opts ...grpc.CallOption) (*resourcepb.RebuildIndexesResponse, error) {
	return nil, nil
}
func (c *capturingSearchClient) VectorSearch(ctx context.Context, in *resourcepb.VectorSearchRequest, opts ...grpc.CallOption) (*resourcepb.VectorSearchResponse, error) {
	return nil, nil
}
func (c *capturingSearchClient) HybridSearch(ctx context.Context, in *resourcepb.HybridSearchRequest, opts ...grpc.CallOption) (*resourcepb.HybridSearchResponse, error) {
	return nil, nil
}

type recordingResponder struct {
	obj    runtime.Object
	status int
	err    error
}

func (r *recordingResponder) Object(statusCode int, obj runtime.Object) {
	r.status = statusCode
	r.obj = obj
}
func (r *recordingResponder) Error(err error) {
	r.err = err
}

func childrenResponseWith(rows []*resourcepb.ResourceTableRow, total int64) *resourcepb.ResourceSearchResponse {
	return &resourcepb.ResourceSearchResponse{
		Results: &resourcepb.ResourceTable{
			Columns: []*resourcepb.ResourceTableColumnDefinition{
				{Name: resource.SEARCH_FIELD_TITLE},
			},
			Rows: rows,
		},
		TotalHits: total,
	}
}

func childRow(uid, title string) *resourcepb.ResourceTableRow {
	return &resourcepb.ResourceTableRow{
		Key:   &resourcepb.ResourceKey{Name: uid, Namespace: "default"},
		Cells: [][]byte{[]byte(title)},
	}
}

func childrenFieldValueResponse(uid, title string) *resourcepb.ResourceSearchResponse {
	return &resourcepb.ResourceSearchResponse{
		ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
		Fields: []*resourcepb.ResourceSearchField{{
			Name: resource.SEARCH_FIELD_TITLE,
			Type: resourcepb.ResourceSearchField_STRING,
		}},
		Rows: []*resourcepb.ResourceSearchRow{{
			Key:             &resourcepb.ResourceKey{Name: uid, Namespace: "default"},
			ResourceVersion: 42,
			Values: []*resourcepb.ResourceSearchValue{{
				FieldIndex:   0,
				StringValues: []string{title},
			}},
		}},
		TotalHits: 1,
	}
}

func newChildrenCtx() context.Context {
	return apirequest.WithNamespace(context.Background(), "default")
}

func TestSubChildren_GeneralFolderSkipsGetterAndFiltersOnEmptyParent(t *testing.T) {
	getter := &stubGetter{err: errors.New("should not be called")}
	search := &capturingSearchClient{resp: childrenFieldValueResponse("a", "Alpha")}
	rest := &subChildrenREST{getter: getter, searcher: search}

	resp := &recordingResponder{}
	handler, err := rest.Connect(newChildrenCtx(), folder.GeneralFolderUID, nil, resp)
	require.NoError(t, err)
	require.NotNil(t, handler)
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/general/children", nil))

	require.NoError(t, resp.err)
	require.NotNil(t, search.lastReq)
	require.Len(t, search.lastReq.Options.Fields, 1)
	require.Equal(t, resourcepb.ResourceSearchRequest_FIELD_VALUES, search.lastReq.ResultFormat)
	require.Equal(t, []string{resource.SEARCH_FIELD_TITLE, resource.SEARCH_FIELD_RV}, search.lastReq.Fields)
	require.Equal(t, resource.SEARCH_FIELD_FOLDER, search.lastReq.Options.Fields[0].Key)
	require.Equal(t, []string{""}, search.lastReq.Options.Fields[0].Values)

	list, ok := resp.obj.(*folders.FolderList)
	require.True(t, ok)
	require.Len(t, list.Items, 1)
	require.Equal(t, "a", list.Items[0].Name)
	require.Equal(t, "Alpha", list.Items[0].Spec.Title)
	require.Equal(t, "42", list.Items[0].ResourceVersion)
}

func TestSubChildren_NamedFolderHitsGetterAndFiltersOnUID(t *testing.T) {
	getter := &stubGetter{obj: &folders.Folder{ObjectMeta: metav1.ObjectMeta{Name: "parent"}}}
	search := &capturingSearchClient{
		resp: childrenResponseWith([]*resourcepb.ResourceTableRow{
			childRow("c1", "Child One"),
			childRow("c2", "Child Two"),
		}, 2),
	}
	rest := &subChildrenREST{getter: getter, searcher: search}

	resp := &recordingResponder{}
	handler, err := rest.Connect(newChildrenCtx(), "parent", nil, resp)
	require.NoError(t, err)
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/parent/children", nil))

	require.NoError(t, resp.err)
	require.Equal(t, []string{"parent"}, search.lastReq.Options.Fields[0].Values)
	require.Equal(t, "=", search.lastReq.Options.Fields[0].Operator)

	list := resp.obj.(*folders.FolderList)
	require.Len(t, list.Items, 2)
	require.Equal(t, "c1", list.Items[0].Name)
	require.Equal(t, "Child Two", list.Items[1].Spec.Title)
	require.Empty(t, list.Continue)
}

func TestSubChildren_GetterErrorPropagates(t *testing.T) {
	getter := &stubGetter{err: errors.New("not found")}
	rest := &subChildrenREST{getter: getter, searcher: &capturingSearchClient{}}

	handler, err := rest.Connect(newChildrenCtx(), "missing", nil, &recordingResponder{})
	require.Error(t, err)
	require.Nil(t, handler)
}

func TestSubChildren_PaginationProducesContinue(t *testing.T) {
	getter := &stubGetter{obj: &folders.Folder{ObjectMeta: metav1.ObjectMeta{Name: "parent"}}}
	search := &capturingSearchClient{
		resp: childrenResponseWith([]*resourcepb.ResourceTableRow{
			childRow("c1", "A"),
			childRow("c2", "B"),
		}, 7),
	}
	rest := &subChildrenREST{getter: getter, searcher: search}

	resp := &recordingResponder{}
	handler, err := rest.Connect(newChildrenCtx(), "parent", nil, resp)
	require.NoError(t, err)
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/parent/children?limit=2&continue=3", nil))

	require.NoError(t, resp.err)
	require.Equal(t, int64(2), search.lastReq.Limit)
	require.Equal(t, int64(3), search.lastReq.Offset)

	list := resp.obj.(*folders.FolderList)
	require.Equal(t, "5", list.Continue)
	require.NotNil(t, list.RemainingItemCount)
	require.Equal(t, int64(2), *list.RemainingItemCount)
}

func TestSubChildren_InvalidPagingRejected(t *testing.T) {
	invalidValues := []struct {
		name  string
		value string
	}{
		{name: "negative", value: "-1"},
		{name: "nonnumeric", value: "not a number&extra=value"},
		{name: "fractional", value: "1.5"},
		{name: "int64 overflow", value: "9223372036854775808"},
	}
	for _, parameter := range []string{"limit", "continue"} {
		for _, invalid := range invalidValues {
			t.Run(parameter+"/"+invalid.name, func(t *testing.T) {
				getter := &stubGetter{obj: &folders.Folder{ObjectMeta: metav1.ObjectMeta{Name: "parent"}}}
				search := &capturingSearchClient{}
				rest := &subChildrenREST{getter: getter, searcher: search}
				resp := &recordingResponder{}
				handler, err := rest.Connect(newChildrenCtx(), "parent", nil, resp)
				require.NoError(t, err)
				query := url.Values{parameter: {invalid.value}}
				handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/parent/children?"+query.Encode(), nil))

				require.Error(t, resp.err)
				require.Nil(t, resp.obj)
				require.Nil(t, search.lastReq)
				status := responsewriters.ErrorToAPIStatus(resp.err)
				require.EqualValues(t, http.StatusBadRequest, status.Code)
				require.Equal(t, metav1.StatusReasonBadRequest, status.Reason)
				require.True(t, apierrors.IsBadRequest(resp.err))
			})
		}
	}
}

func TestParseChildrenPaging_Valid(t *testing.T) {
	tests := []struct {
		name   string
		query  string
		limit  int64
		offset int64
	}{
		{name: "omitted", limit: 500},
		{name: "empty", query: "limit=&continue=", limit: 500},
		{name: "zero", query: "limit=0&continue=0", limit: 500},
		{name: "positive", query: "limit=2&continue=3", limit: 2, offset: 3},
		{name: "at cap", query: "limit=500", limit: 500},
		{name: "above cap", query: "limit=501", limit: 500},
		{name: "max int64 limit", query: "limit=9223372036854775807", limit: 500},
		{name: "max int64 offset", query: "continue=9223372036854775807", limit: 500, offset: 9223372036854775807},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			limit, offset, err := parseChildrenPaging(httptest.NewRequest("GET", "/parent/children?"+tt.query, nil))
			require.NoError(t, err)
			require.Equal(t, tt.limit, limit)
			require.Equal(t, tt.offset, offset)
		})
	}
}

func TestSubChildren_SearchErrorSurfaces(t *testing.T) {
	getter := &stubGetter{obj: &folders.Folder{ObjectMeta: metav1.ObjectMeta{Name: "parent"}}}
	search := &capturingSearchClient{err: errors.New("boom")}
	rest := &subChildrenREST{getter: getter, searcher: search}

	resp := &recordingResponder{}
	handler, err := rest.Connect(newChildrenCtx(), "parent", nil, resp)
	require.NoError(t, err)
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/parent/children", nil))

	require.Error(t, resp.err)
	require.Nil(t, resp.obj)
}

func TestSubChildren_EmptyResults(t *testing.T) {
	getter := &stubGetter{obj: &folders.Folder{ObjectMeta: metav1.ObjectMeta{Name: "parent"}}}
	search := &capturingSearchClient{resp: childrenResponseWith(nil, 0)}
	rest := &subChildrenREST{getter: getter, searcher: search}

	resp := &recordingResponder{}
	handler, err := rest.Connect(newChildrenCtx(), "parent", nil, resp)
	require.NoError(t, err)
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/parent/children", nil))

	require.NoError(t, resp.err)
	list := resp.obj.(*folders.FolderList)
	require.Empty(t, list.Items)
	require.Empty(t, list.Continue)
	require.Nil(t, list.RemainingItemCount)
}
