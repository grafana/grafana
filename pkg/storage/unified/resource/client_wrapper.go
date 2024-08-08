package resource

import (
	"context"
	"fmt"

	"github.com/fullstorydev/grpchan"
	"github.com/fullstorydev/grpchan/inprocgrpc"
	authnlib "github.com/grafana/authlib/authn"
	authzlib "github.com/grafana/authlib/authz"
	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/auth"
	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/authn/grpcutils"
	grpcUtils "github.com/grafana/grafana/pkg/storage/unified/resource/grpc"
)

// TODO: decide on the audience for the resource store
const resourceStoreAudience = "resourceStore"

func NewLocalResourceStoreClient(server ResourceStoreServer) ResourceStoreClient {
	// scenario: local in-proc
	channel := &inprocgrpc.Channel{}

	auth := &grpcUtils.InProcAuthenticator{}
	channel.RegisterService(
		grpchan.InterceptServer(
			&ResourceStore_ServiceDesc,
			grpcAuth.UnaryServerInterceptor(auth.Authenticate),
			grpcAuth.StreamServerInterceptor(auth.Authenticate),
		),
		server,
	)
	return NewResourceStoreClient(grpchan.InterceptClientConn(channel, grpcUtils.UnaryClientInterceptor, grpcUtils.StreamClientInterceptor))
}

func NewResourceStoreClientGRPC(conn *grpc.ClientConn) (ResourceStoreClient, error) {
	// scenario: remote on-prem
	clientInterceptor, err := authnlib.NewGrpcClientInterceptor(
		&authnlib.GrpcClientConfig{},
		authnlib.WithDisableAccessTokenOption(),
		authnlib.WithIDTokenExtractorOption(idTokenExtractor),
		authnlib.WithMetadataExtractorOption(orgIdExtractor),
	)
	if err != nil {
		return nil, err
	}

	return NewResourceStoreClient(
			grpchan.InterceptClientConn(
				conn,
				clientInterceptor.UnaryClientInterceptor,
				clientInterceptor.StreamClientInterceptor,
			)),
		nil
}

func NewResourceStoreClientCloud(conn *grpc.ClientConn, cfg *grpcutils.GrpcClientConfig) (ResourceStoreClient, error) {
	// scenario: remote cloud
	grpcClientConfig := authnlib.GrpcClientConfig{
		TokenClientConfig: &authnlib.TokenExchangeConfig{
			Token:            cfg.Token,
			TokenExchangeURL: cfg.TokenExchangeURL,
		},
		TokenRequest: &authnlib.TokenExchangeRequest{
			Namespace: cfg.TokenNamespace,
			Audiences: []string{resourceStoreAudience},
		},
	}

	clientInterceptor, err := authnlib.NewGrpcClientInterceptor(
		&grpcClientConfig,
		authnlib.WithIDTokenExtractorOption(idTokenExtractor),
		authnlib.WithMetadataExtractorOption(orgIdExtractor),
	)
	if err != nil {
		return nil, err
	}

	return NewResourceStoreClient(
			grpchan.InterceptClientConn(
				conn,
				clientInterceptor.UnaryClientInterceptor,
				clientInterceptor.StreamClientInterceptor,
			)),
		nil
}

func idTokenExtractor(ctx context.Context) (string, error) {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return "", err
	}

	return requester.GetIDToken(), nil
}

func orgIdExtractor(ctx context.Context) (key string, values []string, err error) {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return "", nil, err
	}

	return authzlib.DefaultStackIDMetadataKey, []string{fmt.Sprintf("%d", requester.GetOrgID())}, nil
}
