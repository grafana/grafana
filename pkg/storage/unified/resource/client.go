package resource

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/http"

	"github.com/fullstorydev/grpchan"
	"github.com/fullstorydev/grpchan/inprocgrpc"
	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/claims"
	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/auth"
	"google.golang.org/grpc"

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
