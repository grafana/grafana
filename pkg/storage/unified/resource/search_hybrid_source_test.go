package resource

import (
	"context"
	"net"
	"testing"

	gokitlog "github.com/go-kit/log"
	"github.com/grafana/dskit/instrument"
	"github.com/grafana/dskit/ring"
	ringclient "github.com/grafana/dskit/ring/client"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestHybridSearchDurationAttributesSource(t *testing.T) {
	for _, tc := range []struct {
		name, incoming, outgoing, wantSource string
		duplicate, identity                  bool
	}{
		{name: "assistant", incoming: "assistant", wantSource: "assistant"},
		{name: "gcx", incoming: "gcx", wantSource: "gcx"},
		{name: "cmdk", incoming: "cmdk", wantSource: "cmdk"},
		{name: "absent", wantSource: "unknown"},
		{name: "unrecognized", incoming: "other", wantSource: "unknown"},
		{name: "duplicate", incoming: "assistant", duplicate: true, wantSource: "unknown"},
		{name: "outgoing direct call", outgoing: "cmdk", wantSource: "cmdk"},
		{name: "incoming wins", incoming: "gcx", outgoing: "cmdk", wantSource: "gcx"},
		{name: "invalid incoming wins", incoming: "other", outgoing: "cmdk", wantSource: "unknown"},
		{name: "identity is not a source", identity: true, wantSource: "unknown"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			reg := prometheus.NewPedanticRegistry()
			s := &searchServer{vectorMetrics: ProvideVectorMetrics(reg)}
			ctx := context.Background()
			if tc.identity {
				ctx = serviceReadContext(types.TypeAccessPolicy, "assistant")
			}
			if tc.outgoing != "" {
				ctx = metadata.NewOutgoingContext(ctx, metadata.Pairs("x-grafana-caller-id", tc.outgoing))
			}
			if tc.incoming != "" {
				values := []string{tc.incoming}
				if tc.duplicate {
					values = append(values, tc.incoming)
				}
				ctx = metadata.NewIncomingContext(ctx, metadata.MD{"x-grafana-caller-id": values})
			}
			_, err := s.HybridSearch(ctx, &resourcepb.HybridSearchRequest{Key: &resourcepb.ResourceKey{Group: "g", Resource: "r"}})
			require.Equal(t, codes.Unimplemented, status.Code(err))
			families, err := reg.Gather()
			require.NoError(t, err)
			var seen int
			for _, family := range families {
				if family.GetName() != "grafana_vector_storage_hybrid_search_duration_seconds" {
					continue
				}
				require.Len(t, family.Metric, 1)
				metric := family.Metric[0]
				require.Equal(t, uint64(1), metric.GetHistogram().GetSampleCount())
				require.Len(t, metric.GetHistogram().Bucket, len(instrument.DefBuckets))
				labels := map[string]string{}
				for _, label := range metric.Label {
					labels[label.GetName()] = label.GetValue()
				}
				require.Equal(t, map[string]string{"group": "g", "resource": "r", "status_code": "Unimplemented", "source": tc.wantSource}, labels)
				seen++
			}
			require.Equal(t, 1, seen)
		})
	}
}

func TestHybridSearchDurationObservesSuccessfulCallOnce(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	s, _, _ := newHybridTestServer(lexFieldValueResponse(), &fakeVectorBackend{})
	s.vectorMetrics = ProvideVectorMetrics(reg)
	ctx := metadata.NewOutgoingContext(authedCtx(), metadata.Pairs(hybridSearchCallerIDKey, "gcx"))
	_, err := s.HybridSearch(ctx, &resourcepb.HybridSearchRequest{Key: validKey(), Query: "latency"})
	require.NoError(t, err)

	families, err := reg.Gather()
	require.NoError(t, err)
	var seen int
	for _, family := range families {
		if family.GetName() != "grafana_vector_storage_hybrid_search_duration_seconds" {
			continue
		}
		require.Len(t, family.Metric, 1)
		metric := family.Metric[0]
		require.Equal(t, uint64(1), metric.GetHistogram().GetSampleCount())
		labels := map[string]string{}
		for _, label := range metric.Label {
			labels[label.GetName()] = label.GetValue()
		}
		require.Equal(t, map[string]string{"group": validKey().Group, "resource": validKey().Resource, "source": "gcx", "status_code": "OK"}, labels)
		seen++
	}
	require.Equal(t, 1, seen)
}

type hybridSourceRecordingServer struct {
	resourcepb.UnimplementedResourceIndexServer
	markers []string
	count   int
}

func (s *hybridSourceRecordingServer) HybridSearch(ctx context.Context, _ *resourcepb.HybridSearchRequest) (*resourcepb.HybridSearchResponse, error) {
	md, _ := metadata.FromIncomingContext(ctx)
	s.markers = append(s.markers, recognizedHybridSearchSource(md.Get(hybridSearchCallerIDKey)))
	s.count++
	if s.count == 1 {
		return nil, status.Error(codes.Unavailable, "retry on another replica")
	}
	return &resourcepb.HybridSearchResponse{}, nil
}

type hybridTransportClient struct {
	ResourceClient
	index resourcepb.ResourceIndexClient
}

func (c *hybridTransportClient) HybridSearch(ctx context.Context, req *resourcepb.HybridSearchRequest, opts ...grpc.CallOption) (*resourcepb.HybridSearchResponse, error) {
	return c.index.HybridSearch(ctx, req, opts...)
}

func TestDistributorHybridSearchPreservesOutgoingSourceAcrossTransportRetry(t *testing.T) {
	remote := &hybridSourceRecordingServer{}
	srv := grpc.NewServer()
	resourcepb.RegisterResourceIndexServer(srv, remote)
	listener := bufconn.Listen(1024 * 1024)
	t.Cleanup(srv.Stop)
	go func() { _ = srv.Serve(listener) }()
	conn, err := grpc.NewClient("passthrough:///bufnet", grpc.WithContextDialer(func(context.Context, string) (net.Conn, error) {
		return listener.Dial()
	}), grpc.WithTransportCredentials(insecure.NewCredentials()))
	require.NoError(t, err)
	t.Cleanup(func() { _ = conn.Close() })

	testRing, _ := newSearchRingForTest(t, 2, ring.ACTIVE)
	pool := ringclient.NewPool(RingName, ringclient.PoolConfig{}, nil,
		ringclient.PoolInstFunc(func(ring.InstanceDesc) (ringclient.PoolClient, error) {
			return &RingClient{Client: &hybridTransportClient{index: resourcepb.NewResourceIndexClient(conn)}}, nil
		}), nil, gokitlog.NewNopLogger())
	ds := &distributorServer{ring: testRing, searchRingRead: newSearchRingReadOp(false), clientPool: pool,
		tracing: noop.NewTracerProvider().Tracer("test"), log: log.NewNopLogger()}

	incoming := metadata.Pairs("x-access-token", "token")
	outgoing := metadata.Pairs(hybridSearchCallerIDKey, "assistant", "other", "preserved")
	ctx := metadata.NewIncomingContext(metadata.NewOutgoingContext(t.Context(), outgoing), incoming)
	_, err = ds.HybridSearch(ctx, &resourcepb.HybridSearchRequest{Key: &resourcepb.ResourceKey{Namespace: "ns"}})
	require.NoError(t, err)
	require.Equal(t, []string{"assistant", "assistant"}, remote.markers)
	require.Equal(t, []string{"token"}, incoming.Get("x-access-token"))
	require.Empty(t, incoming.Get(hybridSearchCallerIDKey))
	require.Equal(t, []string{"assistant"}, outgoing.Get(hybridSearchCallerIDKey))
}
