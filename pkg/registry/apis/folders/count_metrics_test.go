package folders

import (
	"context"
	"errors"
	"net/http/httptest"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/admission"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/storage/storagebackend"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	apiserverbuilder "github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/restoptions"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/federated"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestCountingSearcherRecordsOutcome(t *testing.T) {
	tests := []struct {
		name        string
		err         error
		legacyJoin  bool
		wantOutcome string
		wantJoin    string
	}{
		{name: "success", legacyJoin: true, wantOutcome: "ok", wantJoin: "enabled"},
		{name: "success without the legacy join", wantOutcome: "ok", wantJoin: "disabled"},
		{name: "failure", err: errors.New("boom"), legacyJoin: true, wantOutcome: "error", wantJoin: "enabled"},
		{name: "timeout is a failure", err: context.DeadlineExceeded, legacyJoin: true, wantOutcome: "error", wantJoin: "enabled"},
		{name: "caller went away", err: context.Canceled, legacyJoin: true, wantOutcome: "canceled", wantJoin: "enabled"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := newCountMetrics(prometheus.NewRegistry(), tt.legacyJoin)
			searcher := m.wrap(&mockSearchClient{stats: &resourcepb.ResourceStatsResponse{}, statsErr: tt.err}, countCallerEndpoint)

			_, err := searcher.GetStats(context.Background(), &resourcepb.ResourceStatsRequest{})

			require.Equal(t, tt.err, err, "the call result must pass through unchanged")
			require.Equal(t, 1.0, testutil.ToFloat64(m.requests.WithLabelValues(countCallerEndpoint, tt.wantOutcome, tt.wantJoin)))
			require.Equal(t, 1, recordedSeries(t, m.requests))
		})
	}
}

func TestCountMetricsLabelTheCaller(t *testing.T) {
	m := newCountMetrics(prometheus.NewRegistry(), true)
	search := &mockSearchClient{stats: &resourcepb.ResourceStatsResponse{Stats: []*resourcepb.ResourceStatsResponse_Stats{}}}

	resp := &recordingResponder{}
	handler, err := (&subCountREST{
		getter:   &stubGetter{obj: &folders.Folder{ObjectMeta: metav1.ObjectMeta{Name: "nnn"}}},
		searcher: m.wrap(search, countCallerEndpoint),
	}).Connect(newChildrenCtx(), "nnn", nil, resp)
	require.NoError(t, err)
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/nnn/counts", nil))
	require.NoError(t, resp.err)
	require.Equal(t, 200, resp.status)

	folder := &folders.Folder{ObjectMeta: metav1.ObjectMeta{Name: "nnn"}}
	require.NoError(t, validateOnDelete(context.Background(), folder, m.wrap(search, countCallerDeleteCheck), nil, false, nil))

	require.Equal(t, 1.0, testutil.ToFloat64(m.requests.WithLabelValues("counts_endpoint", "ok", "enabled")))
	require.Equal(t, 1.0, testutil.ToFloat64(m.requests.WithLabelValues("delete_check", "ok", "enabled")))
}

func TestCountMetricsNilIsTransparent(t *testing.T) {
	search := &mockSearchClient{}
	var m *countMetrics
	require.Same(t, search, m.wrap(search, countCallerEndpoint))

	require.NotNil(t, newCountMetrics(nil, true), "a nil registerer still counts, unregistered")
	reg := prometheus.NewRegistry()
	newCountMetrics(reg, true)
	require.Panics(t, func() { newCountMetrics(reg, true) }, "a duplicate registration fails loudly")
}

func TestValidateCountsDeleteChecksAsTheirOwnCaller(t *testing.T) {
	setKubernetesFolderCascadeDeleteToggle(t, false)
	m := newCountMetrics(prometheus.NewRegistry(), true)
	b := &FolderAPIBuilder{
		searcher:     &mockSearchClient{stats: &resourcepb.ResourceStatsResponse{Stats: []*resourcepb.ResourceStatsResponse_Stats{}}},
		countMetrics: m,
	}
	obj := &folders.Folder{ObjectMeta: metav1.ObjectMeta{Name: "nnn", Namespace: "default"}}

	err := b.Validate(context.Background(), admission.NewAttributesRecord(nil, obj,
		folders.SchemeGroupVersion.WithKind("folder"), obj.Namespace, obj.Name,
		folders.SchemeGroupVersion.WithResource("folders"), "", admission.Delete,
		&metav1.DeleteOptions{}, false, &user.SignedInUser{}), nil)

	require.NoError(t, err)
	require.Equal(t, 1.0, testutil.ToFloat64(m.requests.WithLabelValues("delete_check", "ok", "enabled")))
}

func TestUpdateAPIGroupInfoCountsTheEndpointAsItsOwnCaller(t *testing.T) {
	m := newCountMetrics(prometheus.NewRegistry(), true)
	b := &FolderAPIBuilder{
		searcher:     &mockSearchClient{stats: &resourcepb.ResourceStatsResponse{}},
		countMetrics: m,
	}
	scheme := runtime.NewScheme()
	require.NoError(t, b.InstallSchema(scheme))
	optsGetter, err := restoptions.NewRESTOptionsGetterMemory(storagebackend.Config{
		Codec: serializer.NewCodecFactory(scheme).LegacyCodec(folders.FolderResourceInfo.GroupVersion()),
	}, nil)
	require.NoError(t, err)
	info := genericapiserver.NewDefaultAPIGroupInfo(folders.GROUP, scheme, metav1.ParameterCodec, serializer.NewCodecFactory(scheme))

	require.NoError(t, b.UpdateAPIGroupInfo(&info, apiserverbuilder.APIGroupOptions{Scheme: scheme, OptsGetter: optsGetter}))

	for version, storage := range info.VersionedResourcesStorageMap {
		counts, ok := storage["folders/counts"].(*subCountREST)
		require.True(t, ok, "version %s", version)
		_, err := counts.searcher.GetStats(context.Background(), &resourcepb.ResourceStatsRequest{})
		require.NoError(t, err)
	}
	require.NotEmpty(t, info.VersionedResourcesStorageMap)
	require.Equal(t, float64(len(info.VersionedResourcesStorageMap)), testutil.ToFloat64(m.requests.WithLabelValues("counts_endpoint", "ok", "enabled")), "one per served version")
}

func TestWithCountMetricsSetsTheBuilderMetrics(t *testing.T) {
	b := &FolderAPIBuilder{}
	WithCountMetrics(prometheus.NewRegistry(), false)(b)

	require.NotNil(t, b.countMetrics)
	require.Equal(t, "disabled", b.countMetrics.legacyJoin)
}

// callerSearcher records the caller the wrapper put on the context.
type callerSearcher struct {
	*mockSearchClient
	caller string
}

func (c *callerSearcher) GetStats(ctx context.Context, in *resourcepb.ResourceStatsRequest, opts ...grpc.CallOption) (*resourcepb.ResourceStatsResponse, error) {
	c.caller = federated.CallerFrom(ctx)
	return c.mockSearchClient.GetStats(ctx, in, opts...)
}

func TestCountingSearcherNamesTheCallerForTheFederatedClient(t *testing.T) {
	m := newCountMetrics(prometheus.NewRegistry(), true)
	for _, caller := range []string{countCallerEndpoint, countCallerDeleteCheck} {
		inner := &callerSearcher{mockSearchClient: &mockSearchClient{stats: &resourcepb.ResourceStatsResponse{}}}

		_, err := m.wrap(inner, caller).GetStats(context.Background(), &resourcepb.ResourceStatsRequest{})

		require.NoError(t, err)
		require.Equal(t, caller, inner.caller)
	}
}
