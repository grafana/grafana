package resource

import (
	"context"
	"crypto/tls"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/fullstorydev/grpchan"
	"github.com/fullstorydev/grpchan/inprocgrpc"
	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/auth"
	"google.golang.org/grpc"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/authn/grpcutils"
	grpcUtils "github.com/grafana/grafana/pkg/storage/unified/resource/grpc"
)

type ResourceClient interface {
	ResourceStoreClient
	ResourceIndexClient
	RepositoryIndexClient
	BatchStoreClient
	BlobStoreClient
	DiagnosticsClient
}

// Internal implementation
type resourceClient struct {
	ResourceStoreClient
	ResourceIndexClient
	RepositoryIndexClient
	BatchStoreClient
	BlobStoreClient
	DiagnosticsClient
}

func NewLegacyResourceClient(channel *grpc.ClientConn) ResourceClient {
	cc := grpchan.InterceptClientConn(channel, grpcUtils.UnaryClientInterceptor, grpcUtils.StreamClientInterceptor)
	return &resourceClient{
		ResourceStoreClient:   NewResourceStoreClient(cc),
		ResourceIndexClient:   NewResourceIndexClient(cc),
		RepositoryIndexClient: NewRepositoryIndexClient(cc),
		BatchStoreClient:      NewBatchStoreClient(cc),
		BlobStoreClient:       NewBlobStoreClient(cc),
		DiagnosticsClient:     NewDiagnosticsClient(cc),
	}
}

func NewLocalResourceClient(server ResourceServer) ResourceClient {
	// scenario: local in-proc
	channel := &inprocgrpc.Channel{}

	grpcAuthInt := grpcutils.NewInProcGrpcAuthenticator()
	for _, desc := range []*grpc.ServiceDesc{
		&ResourceStore_ServiceDesc,
		&ResourceIndex_ServiceDesc,
		&RepositoryIndex_ServiceDesc,
		&BlobStore_ServiceDesc,
		&BatchStore_ServiceDesc,
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
		&authnlib.GrpcClientConfig{TokenRequest: &authnlib.TokenExchangeRequest{}},
		authnlib.WithTokenClientOption(grpcutils.ProvideInProcExchanger()),
		authnlib.WithIDTokenExtractorOption(idTokenExtractor),
	)

	cc := grpchan.InterceptClientConn(channel, clientInt.UnaryClientInterceptor, clientInt.StreamClientInterceptor)
	return &resourceClient{
		ResourceStoreClient:   NewResourceStoreClient(cc),
		ResourceIndexClient:   NewResourceIndexClient(cc),
		RepositoryIndexClient: NewRepositoryIndexClient(cc),
		BatchStoreClient:      NewBatchStoreClient(cc),
		BlobStoreClient:       NewBlobStoreClient(cc),
		DiagnosticsClient:     NewDiagnosticsClient(cc),
	}
}

func NewRemoteResourceClient(tracer tracing.Tracer, conn *grpc.ClientConn, cfg authnlib.GrpcClientConfig, allowInsecure bool) (ResourceClient, error) {
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
		ResourceStoreClient:   NewResourceStoreClient(cc),
		ResourceIndexClient:   NewResourceIndexClient(cc),
		BlobStoreClient:       NewBlobStoreClient(cc),
		BatchStoreClient:      NewBatchStoreClient(cc),
		RepositoryIndexClient: NewRepositoryIndexClient(cc),
		DiagnosticsClient:     NewDiagnosticsClient(cc),
	}, nil
}

var authLogger = slog.Default().With("logger", "resource-client-auth-interceptor")

func idTokenExtractor(ctx context.Context) (string, error) {
	if identity.IsServiceIdentity(ctx) {
		return "", nil
	}

	info, ok := types.AuthInfoFrom(ctx)
	if !ok {
		return "", fmt.Errorf("no claims found")
	}

	if token := info.GetIDToken(); len(token) != 0 {
		return token, nil
	}

	if !types.IsIdentityType(info.GetIdentityType(), types.TypeAccessPolicy) {
		authLogger.Warn(
			"calling resource store as the service without id token or marking it as the service identity",
			"subject", info.GetSubject(),
			"uid", info.GetUID(),
		)
	}

	return "", nil
}

func allowInsecureTransportOpt(grpcClientConfig *authnlib.GrpcClientConfig, opts []authnlib.GrpcClientInterceptorOption) []authnlib.GrpcClientInterceptorOption {
	client := &http.Client{Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}}}
	tokenClient, _ := authnlib.NewTokenExchangeClient(*grpcClientConfig.TokenClientConfig, authnlib.WithHTTPClient(client))
	return append(opts, authnlib.WithTokenClientOption(tokenClient))
}
