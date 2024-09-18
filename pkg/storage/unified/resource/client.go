package resource

import (
	"context"
	"fmt"

	"github.com/fullstorydev/grpchan"
	"github.com/fullstorydev/grpchan/inprocgrpc"
	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/claims"
	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/auth"
	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/services/authn/grpcutils"
	grpcUtils "github.com/grafana/grafana/pkg/storage/unified/resource/grpc"
)

type ResourceClient interface {
	ResourceStoreClient
	ResourceIndexClient
	DiagnosticsClient
}

// Internal implementation
type resourceClient struct {
	ResourceStoreClient
	ResourceIndexClient
	DiagnosticsClient
}

func NewResourceClient(channel *grpc.ClientConn) ResourceClient {
	cc := grpchan.InterceptClientConn(channel, grpcUtils.UnaryClientInterceptor, grpcUtils.StreamClientInterceptor)
	return &resourceClient{
		ResourceStoreClient: NewResourceStoreClient(cc),
		ResourceIndexClient: NewResourceIndexClient(cc),
		DiagnosticsClient:   NewDiagnosticsClient(cc),
	}
}

func NewLocalResourceClient(server ResourceStoreServer) ResourceClient {
	// scenario: local in-proc
	channel := &inprocgrpc.Channel{}

	grpcAuthInt := grpcutils.NewInProcGrpcAuthenticator()
	channel.RegisterService(
		grpchan.InterceptServer(
			&ResourceStore_ServiceDesc,
			grpcAuth.UnaryServerInterceptor(grpcAuthInt.Authenticate),
			grpcAuth.StreamServerInterceptor(grpcAuthInt.Authenticate),
		),
		server, // Implements all the things
	)

	clientInt, _ := authnlib.NewGrpcClientInterceptor(
		&authnlib.GrpcClientConfig{},
		authnlib.WithDisableAccessTokenOption(),
		authnlib.WithIDTokenExtractorOption(idTokenExtractor),
	)

	cc := grpchan.InterceptClientConn(channel, clientInt.UnaryClientInterceptor, clientInt.StreamClientInterceptor)
	return &resourceClient{
		ResourceStoreClient: NewResourceStoreClient(cc),
		ResourceIndexClient: NewResourceIndexClient(cc),
		DiagnosticsClient:   NewDiagnosticsClient(cc),
	}
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

	return "", fmt.Errorf("id-token not found")
}
