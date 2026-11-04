package folders

import (
	"context"
	"errors"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	grpccodes "google.golang.org/grpc/codes"
	grpcstatus "google.golang.org/grpc/status"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/storage/unified/federated"
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
	require.Contains(t, search.lastReq.Kinds, "dashboard.grafana.app/variables")
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

func TestCountFailedError(t *testing.T) {
	tests := []struct {
		name          string
		err           error
		deleting      bool
		wantPublicMsg string
	}{
		{
			name:          "short resource name",
			err:           &federated.CountError{Resources: []string{"alertrules"}, Err: errors.New("permission denied on table alert_rule")},
			wantPublicMsg: "count failed: could not count alert rules",
		},
		{
			name: "fully qualified resource names",
			err: &federated.CountError{
				Resources: []string{
					"alertrules.rules.alerting.grafana.app",
					"recordingrules.rules.alerting.grafana.app",
					"librarypanels.dashboard.grafana.app",
				},
				Err: errors.New("legacy source unavailable"),
			},
			wantPublicMsg: "count failed: could not count alert rules, recording rules, library panels",
		},
		{
			name:          "unknown resource",
			err:           errors.New("index unavailable"),
			wantPublicMsg: "count failed: could not count folder contents",
		},
		{
			name:          "delete check",
			err:           &federated.CountError{Resources: []string{"recordingrules"}, Err: errors.New("connection reset")},
			deleting:      true,
			wantPublicMsg: "Folder cannot be deleted: could not count recording rules",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := countFailedError(tt.err, tt.deleting)

			var apiStatus apierrors.APIStatus
			require.ErrorAs(t, err, &apiStatus)
			require.Equal(t, int32(500), apiStatus.Status().Code)
			require.Equal(t, tt.wantPublicMsg, apiStatus.Status().Message)
			require.ErrorIs(t, err, tt.err)
			require.Contains(t, err.Error(), tt.err.Error())
			require.NotContains(t, apiStatus.Status().Message, tt.err.Error())
		})
	}
}

func TestCountStatsErrors(t *testing.T) {
	forbidden := apierrors.NewForbidden(schema.GroupResource{}, "", errors.New("upstream denied"))
	unstructuredGRPC := grpcstatus.Error(grpccodes.Internal, "pq: permission denied for table alert_rule")

	tests := []struct {
		name          string
		respErr       *resourcepb.ErrorResult
		err           error
		wantRaw       error
		wantRawText   string
		wantCode      int32
		wantPublicMsg string
	}{
		{
			name:          "wrapped status error keeps resource metadata",
			err:           &federated.CountError{Resources: []string{"alertrules"}, Err: forbidden},
			wantRaw:       forbidden,
			wantCode:      500,
			wantPublicMsg: "count failed: could not count alert rules",
		},
		{
			name:          "unstructured gRPC error keeps its message for traces",
			err:           unstructuredGRPC,
			wantRaw:       unstructuredGRPC,
			wantRawText:   "permission denied for table alert_rule",
			wantCode:      500,
			wantPublicMsg: "count failed: could not count folder contents",
		},
		{
			name:          "response-embedded 4xx becomes 500",
			respErr:       &resourcepb.ErrorResult{Code: 404, Message: "index not found"},
			wantRawText:   "index not found",
			wantCode:      500,
			wantPublicMsg: "count failed: could not count folder contents",
		},
		{name: "local cancel", err: context.Canceled, wantRaw: context.Canceled, wantCode: 499},
		{name: "local deadline", err: context.DeadlineExceeded, wantRaw: context.DeadlineExceeded, wantCode: 504},
		{
			name:     "wrapped local cancel",
			err:      &federated.CountError{Resources: []string{"alertrules"}, Err: context.Canceled},
			wantRaw:  context.Canceled,
			wantCode: 499,
		},
		{name: "gRPC cancel", err: grpcstatus.Error(grpccodes.Canceled, "canceled"), wantCode: 499},
		{name: "gRPC deadline", err: grpcstatus.Error(grpccodes.DeadlineExceeded, "deadline"), wantCode: 504},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			raw, public := countStatsErrors(tt.respErr, tt.err, false)

			require.Error(t, raw)
			if tt.wantRaw != nil {
				require.ErrorIs(t, raw, tt.wantRaw)
			}
			if tt.wantRawText != "" {
				require.ErrorContains(t, raw, tt.wantRawText)
			}

			var apiStatus apierrors.APIStatus
			require.ErrorAs(t, public, &apiStatus)
			require.Equal(t, tt.wantCode, apiStatus.Status().Code)
			if tt.wantPublicMsg != "" {
				require.Equal(t, tt.wantPublicMsg, apiStatus.Status().Message)
			}
			if tt.wantRawText != "" {
				require.NotContains(t, apiStatus.Status().Message, tt.wantRawText)
			}
		})
	}
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
