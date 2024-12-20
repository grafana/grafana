package resource

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/http"

	"github.com/fullstorydev/grpchan"
	"github.com/fullstorydev/grpchan/inprocgrpc"
	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/auth"
	"google.golang.org/grpc"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/authn/grpcutils"
	grpcUtils "github.com/grafana/grafana/pkg/storage/unified/resource/grpc"
)

type ResourceClient interface {
	ResourceStoreClient
	ResourceIndexClient
	BlobStoreClient
	DiagnosticsClient
}

// Internal implementation
type resourceClient struct {
	ResourceStoreClient
	ResourceIndexClient
	BlobStoreClient
	DiagnosticsClient
}

func NewLegacyResourceClient(channel *grpc.ClientConn) ResourceClient {
	cc := grpchan.InterceptClientConn(channel, grpcUtils.UnaryClientInterceptor, grpcUtils.StreamClientInterceptor)
	return &resourceClient{
		ResourceStoreClient: NewResourceStoreClient(cc),
		ResourceIndexClient: NewResourceIndexClient(cc),
		BlobStoreClient:     NewBlobStoreClient(cc),
		DiagnosticsClient:   NewDiagnosticsClient(cc),
	}
}

func NewLocalResourceClient(server ResourceServer) ResourceClient {
	// scenario: local in-proc
	channel := &inprocgrpc.Channel{}

	grpcAuthInt := grpcutils.NewInProcGrpcAuthenticator()
	for _, desc := range []*grpc.ServiceDesc{
		&ResourceStore_ServiceDesc,
		&ResourceIndex_ServiceDesc,
		&BlobStore_ServiceDesc,
		&Diagnostics_ServiceDesc,
	} {
		channel.RegisterService(
			grpchan.InterceptServer(
				desc,
				grpcAuth.UnaryServerInterceptor(grpcAuthInt.Authenticate),
				grpcAuth.StreamServerInterceptor(grpcAuthInt.Authenticate),
			),
			server,
		)
	}

	clientInt, _ := authnlib.NewGrpcClientInterceptor(
		&authnlib.GrpcClientConfig{},
		authnlib.WithDisableAccessTokenOption(),
		authnlib.WithIDTokenExtractorOption(idTokenExtractor),
	)

	cc := grpchan.InterceptClientConn(channel, clientInt.UnaryClientInterceptor, clientInt.StreamClientInterceptor)
	return &resourceClient{
		ResourceStoreClient: NewResourceStoreClient(cc),
		ResourceIndexClient: NewResourceIndexClient(cc),
		BlobStoreClient:     NewBlobStoreClient(cc),
		DiagnosticsClient:   NewDiagnosticsClient(cc),
	}
}

func NewGRPCResourceClient(tracer tracing.Tracer, conn *grpc.ClientConn) (ResourceClient, error) {
	// scenario: remote on-prem
	clientInt, err := authnlib.NewGrpcClientInterceptor(
		&authnlib.GrpcClientConfig{},
		authnlib.WithDisableAccessTokenOption(),
		authnlib.WithIDTokenExtractorOption(idTokenExtractor),
		authnlib.WithTracerOption(tracer),
	)
	if err != nil {
		return nil, err
	}

	cc := grpchan.InterceptClientConn(conn, clientInt.UnaryClientInterceptor, clientInt.StreamClientInterceptor)
	return &resourceClient{
		ResourceStoreClient: NewResourceStoreClient(cc),
		ResourceIndexClient: NewResourceIndexClient(cc),
		DiagnosticsClient:   NewDiagnosticsClient(cc),
	}, nil
}

func NewCloudResourceClient(tracer tracing.Tracer, conn *grpc.ClientConn, cfg authnlib.GrpcClientConfig, allowInsecure bool) (ResourceClient, error) {
	// scenario: remote cloud
	opts := []authnlib.GrpcClientInterceptorOption{
		authnlib.WithIDTokenExtractorOption(idTokenExtractor),
		authnlib.WithTracerOption(tracer),
	}

	if allowInsecure {
		opts = allowInsecureTransportOpt(&cfg, opts)
	}

	clientInt, err := authnlib.NewGrpcClientInterceptor(&cfg, opts...)
	if err != nil {
		return nil, err
	}

	cc := grpchan.InterceptClientConn(conn, clientInt.UnaryClientInterceptor, clientInt.StreamClientInterceptor)
	return &resourceClient{
		ResourceStoreClient: NewResourceStoreClient(cc),
		ResourceIndexClient: NewResourceIndexClient(cc),
		DiagnosticsClient:   NewDiagnosticsClient(cc),
	}, nil
}

func idTokenExtractor(ctx context.Context) (string, error) {
	authInfo, ok := claims.From(ctx)
	if !ok {
		return "", fmt.Errorf("no claims found")
	}

	extra := authInfo.GetExtra()
	if token, exists := extra["id-token"]; exists && len(token) != 0 && token[0] != "" {
		return token[0], nil
	}

	return "", nil
}

func allowInsecureTransportOpt(grpcClientConfig *authnlib.GrpcClientConfig, opts []authnlib.GrpcClientInterceptorOption) []authnlib.GrpcClientInterceptorOption {
	client := &http.Client{Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}}}
	tokenClient, _ := authnlib.NewTokenExchangeClient(*grpcClientConfig.TokenClientConfig, authnlib.WithHTTPClient(client))
	return append(opts, authnlib.WithTokenClientOption(tokenClient))
}

var (
	_ ResourceClient = (*directResourceClient)(nil)
)

// The direct client passes requests directly to the server using the *same* context
func NewDirectResourceClient(server ResourceServer) ResourceClient {
	return &directResourceClient{server}
}

type directResourceClient struct {
	server ResourceServer
}

// Create implements ResourceClient.
func (d *directResourceClient) Create(ctx context.Context, in *CreateRequest, opts ...grpc.CallOption) (*CreateResponse, error) {
	return d.server.Create(ctx, in)
}

// Delete implements ResourceClient.
func (d *directResourceClient) Delete(ctx context.Context, in *DeleteRequest, opts ...grpc.CallOption) (*DeleteResponse, error) {
	return d.server.Delete(ctx, in)
}

// GetBlob implements ResourceClient.
func (d *directResourceClient) GetBlob(ctx context.Context, in *GetBlobRequest, opts ...grpc.CallOption) (*GetBlobResponse, error) {
	return d.server.GetBlob(ctx, in)
}

// GetStats implements ResourceClient.
func (d *directResourceClient) GetStats(ctx context.Context, in *ResourceStatsRequest, opts ...grpc.CallOption) (*ResourceStatsResponse, error) {
	return d.server.GetStats(ctx, in)
}

// History implements ResourceClient.
func (d *directResourceClient) History(ctx context.Context, in *HistoryRequest, opts ...grpc.CallOption) (*HistoryResponse, error) {
	return d.server.History(ctx, in)
}

// IsHealthy implements ResourceClient.
func (d *directResourceClient) IsHealthy(ctx context.Context, in *HealthCheckRequest, opts ...grpc.CallOption) (*HealthCheckResponse, error) {
	return d.server.IsHealthy(ctx, in)
}

// List implements ResourceClient.
func (d *directResourceClient) List(ctx context.Context, in *ListRequest, opts ...grpc.CallOption) (*ListResponse, error) {
	return d.server.List(ctx, in)
}

// Origin implements ResourceClient.
func (d *directResourceClient) Origin(ctx context.Context, in *OriginRequest, opts ...grpc.CallOption) (*OriginResponse, error) {
	return d.server.Origin(ctx, in)
}

// PutBlob implements ResourceClient.
func (d *directResourceClient) PutBlob(ctx context.Context, in *PutBlobRequest, opts ...grpc.CallOption) (*PutBlobResponse, error) {
	return d.server.PutBlob(ctx, in)
}

// Read implements ResourceClient.
func (d *directResourceClient) Read(ctx context.Context, in *ReadRequest, opts ...grpc.CallOption) (*ReadResponse, error) {
	return d.server.Read(ctx, in)
}

// Restore implements ResourceClient.
func (d *directResourceClient) Restore(ctx context.Context, in *RestoreRequest, opts ...grpc.CallOption) (*RestoreResponse, error) {
	return d.server.Restore(ctx, in)
}

// Search implements ResourceClient.
func (d *directResourceClient) Search(ctx context.Context, in *ResourceSearchRequest, opts ...grpc.CallOption) (*ResourceSearchResponse, error) {
	return d.server.Search(ctx, in)
}

// Update implements ResourceClient.
func (d *directResourceClient) Update(ctx context.Context, in *UpdateRequest, opts ...grpc.CallOption) (*UpdateResponse, error) {
	return d.server.Update(ctx, in)
}

// Watch implements ResourceClient.
func (d *directResourceClient) Watch(ctx context.Context, in *WatchRequest, opts ...grpc.CallOption) (grpc.ServerStreamingClient[WatchEvent], error) {
	return nil, fmt.Errorf("watch not yet supported with direct resource client")
}
