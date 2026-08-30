package folders

import (
	"context"
	"errors"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
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

func newChildrenCtx() context.Context {
	return apirequest.WithNamespace(context.Background(), "default")
}

func TestSubChildren_GeneralFolderSkipsGetterAndFiltersOnEmptyParent(t *testing.T) {
	getter := &stubGetter{err: errors.New("should not be called")}
	search := &capturingSearchClient{
		resp: childrenResponseWith([]*resourcepb.ResourceTableRow{
			childRow("a", "Alpha"),
		}, 1),
	}
	rest := &subChildrenREST{getter: getter, searcher: search}

	resp := &recordingResponder{}
	handler, err := rest.Connect(newChildrenCtx(), folder.GeneralFolderUID, nil, resp)
	require.NoError(t, err)
	require.NotNil(t, handler)
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/general/children", nil))

	require.NoError(t, resp.err)
	require.NotNil(t, search.lastReq)
	require.Len(t, search.lastReq.Options.Fields, 1)
	require.Equal(t, resource.SEARCH_FIELD_FOLDER, search.lastReq.Options.Fields[0].Key)
	require.Equal(t, []string{""}, search.lastReq.Options.Fields[0].Values)

	list, ok := resp.obj.(*folders.FolderList)
	require.True(t, ok)
	require.Len(t, list.Items, 1)
	require.Equal(t, "a", list.Items[0].Name)
	require.Equal(t, "Alpha", list.Items[0].Spec.Title)
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

func TestSubChildren_InvalidContinueRejected(t *testing.T) {
	getter := &stubGetter{obj: &folders.Folder{ObjectMeta: metav1.ObjectMeta{Name: "parent"}}}
	rest := &subChildrenREST{getter: getter, searcher: &capturingSearchClient{}}

	resp := &recordingResponder{}
	handler, err := rest.Connect(newChildrenCtx(), "parent", nil, resp)
	require.NoError(t, err)
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/parent/children?continue=not-a-number", nil))

	require.Error(t, resp.err)
	require.Nil(t, resp.obj)
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
