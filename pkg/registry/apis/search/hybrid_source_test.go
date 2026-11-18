package search

import (
	"context"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/test/bufconn"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type hybridMetadataClient struct {
	incoming metadata.MD
	outgoing metadata.MD
}

type hybridTransportServer struct {
	resourcepb.UnimplementedResourceIndexServer
	markers [][]string
}

func (s *hybridTransportServer) HybridSearch(ctx context.Context, _ *resourcepb.HybridSearchRequest) (*resourcepb.HybridSearchResponse, error) {
	md, _ := metadata.FromIncomingContext(ctx)
	s.markers = append(s.markers, md.Get("x-grafana-caller-id"))
	return &resourcepb.HybridSearchResponse{}, nil
}

func TestHybridSearchHandlerForwardsCallerMarkerOverGRPC(t *testing.T) {
	remote := &hybridTransportServer{}
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
	h := NewHybridHandler(resourcepb.NewResourceIndexClient(conn), noop.NewTracerProvider().Tracer("test"))

	for _, marker := range []string{"gcx", "", "💡"} {
		r := httptest.NewRequest(http.MethodPost, "/search/hybrid", strings.NewReader(hybridBody(t, hybridQuery())))
		if marker != "" {
			r.Header.Set("X-Grafana-Caller-Id", marker)
		}
		ctx := identity.WithRequester(r.Context(), &identity.StaticRequester{Namespace: "default"})
		ctx = request.WithNamespace(ctx, "default")
		ctx = metadata.NewIncomingContext(ctx, metadata.Pairs("x-grafana-caller-id", "inherited-incoming"))
		ctx = metadata.NewOutgoingContext(ctx, metadata.Pairs("x-grafana-caller-id", "inherited-outgoing"))
		w := httptest.NewRecorder()
		h.HybridSearchFor(testKind)(w, r.WithContext(ctx))
		require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	}
	require.Equal(t, [][]string{{"gcx"}, nil, nil}, remote.markers)
}

func (c *hybridMetadataClient) HybridSearch(ctx context.Context, _ *resourcepb.HybridSearchRequest, _ ...grpc.CallOption) (*resourcepb.HybridSearchResponse, error) {
	c.incoming, _ = metadata.FromIncomingContext(ctx)
	c.outgoing, _ = metadata.FromOutgoingContext(ctx)
	return &resourcepb.HybridSearchResponse{}, nil
}

func TestHybridSearchHandlerForwardsOnlyExplicitCallerMarker(t *testing.T) {
	const marker = "x-grafana-caller-id"
	for _, tc := range []struct {
		name   string
		header []string
		want   []string
	}{
		{name: "assistant", header: []string{"assistant"}, want: []string{"assistant"}},
		{name: "gcx", header: []string{"gcx"}, want: []string{"gcx"}},
		{name: "cmdk", header: []string{"cmdk"}, want: []string{"cmdk"}},
		{name: "missing"},
		{name: "unrecognized", header: []string{"other"}},
		{name: "duplicate", header: []string{"assistant", "gcx"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			client := &hybridMetadataClient{}
			h := NewHybridHandler(client, noop.NewTracerProvider().Tracer("test"))
			r := httptest.NewRequest(http.MethodPost, "/search/hybrid", strings.NewReader(hybridBody(t, hybridQuery())))
			for _, value := range tc.header {
				r.Header.Add("X-Grafana-Caller-Id", value)
			}
			incoming := metadata.Pairs(marker, "inherited-incoming", "x-access-token", "token")
			outgoing := metadata.Pairs(marker, "inherited-outgoing", "trace-id", "trace")
			ctx := identity.WithRequester(r.Context(), &identity.StaticRequester{Namespace: "default"})
			ctx = request.WithNamespace(ctx, "default")
			ctx = metadata.NewOutgoingContext(ctx, outgoing)
			ctx = metadata.NewIncomingContext(ctx, incoming)
			w := httptest.NewRecorder()
			h.HybridSearchFor(testKind)(w, r.WithContext(ctx))
			require.Equal(t, http.StatusOK, w.Code, w.Body.String())
			require.Equal(t, tc.want, client.outgoing.Get(marker))
			require.Empty(t, client.incoming.Get(marker))
			require.Equal(t, []string{"token"}, client.incoming.Get("x-access-token"))
			require.Equal(t, []string{"trace"}, client.outgoing.Get("trace-id"))
			require.Equal(t, []string{"inherited-incoming"}, incoming.Get(marker))
			require.Equal(t, []string{"inherited-outgoing"}, outgoing.Get(marker))
		})
	}
}

func TestHybridSearchHandlerForwardsMarkerWithoutExistingMetadata(t *testing.T) {
	client := &hybridMetadataClient{}
	h := NewHybridHandler(client, noop.NewTracerProvider().Tracer("test"))
	r := httptest.NewRequest(http.MethodPost, "/search/hybrid", strings.NewReader(hybridBody(t, hybridQuery())))
	r.Header.Set("X-Grafana-Caller-Id", "cmdk")
	ctx := identity.WithRequester(r.Context(), &identity.StaticRequester{Namespace: "default"})
	ctx = request.WithNamespace(ctx, "default")
	w := httptest.NewRecorder()
	h.HybridSearchFor(testKind)(w, r.WithContext(ctx))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	require.Equal(t, []string{"cmdk"}, client.outgoing.Get("x-grafana-caller-id"))
}

func TestGlobalHybridSearchHandlerForwardsCallerMarker(t *testing.T) {
	client := &hybridMetadataClient{}
	auth := authorizer.AuthorizerFunc(func(context.Context, authorizer.Attributes) (authorizer.Decision, string, error) {
		return authorizer.DecisionAllow, "", nil
	})
	h := NewHybridHandler(client, noop.NewTracerProvider().Tracer("test"))
	handler := h.GlobalHybridSearchFor(globalHybridTargets(), nil, auth, []searchv0.HybridSearchResource{
		{Group: "dashboard.grafana.app", Resource: "dashboards"},
	})
	r := httptest.NewRequest(http.MethodPost, "/global/search/hybrid", strings.NewReader(hybridBody(t, hybridQuery())))
	r.Header.Set("X-Grafana-Caller-Id", "assistant")
	ctx := identity.WithRequester(r.Context(), &identity.StaticRequester{Namespace: "default"})
	ctx = request.WithNamespace(ctx, "default")
	w := httptest.NewRecorder()
	handler(w, r.WithContext(ctx))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	require.Equal(t, []string{"assistant"}, client.outgoing.Get("x-grafana-caller-id"))
}
