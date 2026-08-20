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

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type capturingStatsClient struct {
	resp *resourcepb.ResourceStatsResponse
	err  error

	mu      sync.Mutex
	lastReq *resourcepb.ResourceStatsRequest
}

func (c *capturingStatsClient) GetStats(ctx context.Context, in *resourcepb.ResourceStatsRequest, opts ...grpc.CallOption) (*resourcepb.ResourceStatsResponse, error) {
	c.mu.Lock()
	c.lastReq = in
	c.mu.Unlock()
	return c.resp, c.err
}
func (c *capturingStatsClient) Search(ctx context.Context, in *resourcepb.ResourceSearchRequest, opts ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	return nil, nil
}
func (c *capturingStatsClient) RebuildIndexes(ctx context.Context, in *resourcepb.RebuildIndexesRequest, opts ...grpc.CallOption) (*resourcepb.RebuildIndexesResponse, error) {
	return nil, nil
}
func (c *capturingStatsClient) VectorSearch(ctx context.Context, in *resourcepb.VectorSearchRequest, opts ...grpc.CallOption) (*resourcepb.VectorSearchResponse, error) {
	return nil, nil
}
func (c *capturingStatsClient) HybridSearch(ctx context.Context, in *resourcepb.HybridSearchRequest, opts ...grpc.CallOption) (*resourcepb.HybridSearchResponse, error) {
	return nil, nil
}

func TestSubCount_RequestIncludesRecordingRules(t *testing.T) {
	getter := &stubGetter{obj: &folders.Folder{ObjectMeta: metav1.ObjectMeta{Name: "parent"}}}
	search := &capturingStatsClient{resp: &resourcepb.ResourceStatsResponse{}}
	rest := &subCountREST{getter: getter, searcher: search}

	resp := &recordingResponder{}
	handler, err := rest.Connect(newChildrenCtx(), "parent", nil, resp)
	require.NoError(t, err)
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/parent/counts", nil))

	require.NoError(t, resp.err)
	require.NotNil(t, search.lastReq)
	require.Contains(t, search.lastReq.Kinds, "rules.alerting.grafana.app/recordingrules")
	require.Contains(t, search.lastReq.Kinds, "rules.alerting.grafana.app/alertrules")
}

func TestSubCount_SurfacesBothAlertAndRecordingRuleCounts(t *testing.T) {
	getter := &stubGetter{obj: &folders.Folder{ObjectMeta: metav1.ObjectMeta{Name: "parent"}}}
	search := &capturingStatsClient{resp: &resourcepb.ResourceStatsResponse{
		Stats: []*resourcepb.ResourceStatsResponse_Stats{
			{Group: "rules.alerting.grafana.app", Resource: "alertrules", Count: 0},
			{Group: "rules.alerting.grafana.app", Resource: "recordingrules", Count: 22},
		},
	}}
	rest := &subCountREST{getter: getter, searcher: search}

	resp := &recordingResponder{}
	handler, err := rest.Connect(newChildrenCtx(), "parent", nil, resp)
	require.NoError(t, err)
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/parent/counts", nil))

	require.NoError(t, resp.err)
	counts, ok := resp.obj.(*folders.DescendantCounts)
	require.True(t, ok)
	require.Len(t, counts.Counts, 2)
	require.Equal(t, "alertrules", counts.Counts[0].Resource)
	require.Equal(t, int64(0), counts.Counts[0].Count)
	require.Equal(t, "recordingrules", counts.Counts[1].Resource)
	require.Equal(t, int64(22), counts.Counts[1].Count)
}

func TestSubCount_OnlyAlertRulesStillWorks(t *testing.T) {
	getter := &stubGetter{obj: &folders.Folder{ObjectMeta: metav1.ObjectMeta{Name: "parent"}}}
	search := &capturingStatsClient{resp: &resourcepb.ResourceStatsResponse{
		Stats: []*resourcepb.ResourceStatsResponse_Stats{
			{Group: "rules.alerting.grafana.app", Resource: "alertrules", Count: 3},
		},
	}}
	rest := &subCountREST{getter: getter, searcher: search}

	resp := &recordingResponder{}
	handler, err := rest.Connect(newChildrenCtx(), "parent", nil, resp)
	require.NoError(t, err)
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/parent/counts", nil))

	require.NoError(t, resp.err)
	counts := resp.obj.(*folders.DescendantCounts)
	require.Len(t, counts.Counts, 1)
	require.Equal(t, "alertrules", counts.Counts[0].Resource)
	require.Equal(t, int64(3), counts.Counts[0].Count)
}

func TestSubCount_GetterErrorPropagates(t *testing.T) {
	getter := &stubGetter{err: errors.New("not found")}
	rest := &subCountREST{getter: getter, searcher: &capturingStatsClient{}}

	handler, err := rest.Connect(newChildrenCtx(), "missing", nil, &recordingResponder{})
	require.Error(t, err)
	require.Nil(t, handler)
}

func TestSubCount_StatsErrorSurfaces(t *testing.T) {
	getter := &stubGetter{obj: &folders.Folder{ObjectMeta: metav1.ObjectMeta{Name: "parent"}}}
	search := &capturingStatsClient{err: errors.New("boom")}
	rest := &subCountREST{getter: getter, searcher: search}

	resp := &recordingResponder{}
	handler, err := rest.Connect(newChildrenCtx(), "parent", nil, resp)
	require.NoError(t, err)
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/parent/counts", nil))

	require.Error(t, resp.err)
	require.Nil(t, resp.obj)
}
