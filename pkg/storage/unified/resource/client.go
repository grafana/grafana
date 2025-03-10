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
	BulkStoreClient
	BlobStoreClient
	DiagnosticsClient
}

// Internal implementation
type resourceClient struct {
	ResourceStoreClient
	ResourceIndexClient
	RepositoryIndexClient
	BulkStoreClient
	BlobStoreClient
	DiagnosticsClient
}

func NewLegacyResourceClient(channel *grpc.ClientConn) ResourceClient {
	cc := grpchan.InterceptClientConn(channel, grpcUtils.UnaryClientInterceptor, grpcUtils.StreamClientInterceptor)
	return &resourceClient{
		ResourceStoreClient:   NewResourceStoreClient(cc),
		ResourceIndexClient:   NewResourceIndexClient(cc),
		RepositoryIndexClient: NewRepositoryIndexClient(cc),
		BulkStoreClient:       NewBulkStoreClient(cc),
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
		&BulkStore_ServiceDesc,
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

	clientInt := authnlib.NewGrpcClientInterceptor(
		grpcutils.ProvideInProcExchanger(),
		authnlib.WithClientInterceptorIDTokenExtractor(idTokenExtractor),
	)

	cc := grpchan.InterceptClientConn(channel, clientInt.UnaryClientInterceptor, clientInt.StreamClientInterceptor)
	return &resourceClient{
		ResourceStoreClient:   NewResourceStoreClient(cc),
		ResourceIndexClient:   NewResourceIndexClient(cc),
		RepositoryIndexClient: NewRepositoryIndexClient(cc),
		BulkStoreClient:       NewBulkStoreClient(cc),
		BlobStoreClient:       NewBlobStoreClient(cc),
		DiagnosticsClient:     NewDiagnosticsClient(cc),
	}
}

type RemoteResourceClientConfig struct {
	Token            string
	TokenExchangeURL string
	Audiences        []string
	Namespace        string
	AllowInsecure    bool
}

func NewRemoteResourceClient(tracer tracing.Tracer, conn *grpc.ClientConn, cfg RemoteResourceClientConfig) (ResourceClient, error) {
	exchangeOpts := []authnlib.ExchangeClientOpts{}

	if cfg.AllowInsecure {
		exchangeOpts = append(exchangeOpts, authnlib.WithHTTPClient(&http.Client{Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}}}))
	}

	tc, err := authnlib.NewTokenExchangeClient(authnlib.TokenExchangeConfig{
		Token:            cfg.Token,
		TokenExchangeURL: cfg.TokenExchangeURL,
	}, exchangeOpts...)

	if err != nil {
		return nil, err
	}
	clientInt := authnlib.NewGrpcClientInterceptor(
		tc,
		authnlib.WithClientInterceptorTracer(tracer),
		authnlib.WithClientInterceptorNamespace(cfg.Namespace),
		authnlib.WithClientInterceptorAudience(cfg.Audiences),
		authnlib.WithClientInterceptorIDTokenExtractor(idTokenExtractor),
	)

	cc := grpchan.InterceptClientConn(conn, clientInt.UnaryClientInterceptor, clientInt.StreamClientInterceptor)
	return &resourceClient{
		ResourceStoreClient:   NewResourceStoreClient(cc),
		ResourceIndexClient:   NewResourceIndexClient(cc),
		BlobStoreClient:       NewBlobStoreClient(cc),
		BulkStoreClient:       NewBulkStoreClient(cc),
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
