package resource

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/http"

	"github.com/fullstorydev/grpchan"
	"github.com/fullstorydev/grpchan/inprocgrpc"
	authnlib "github.com/grafana/authlib/authn"
	authzlib "github.com/grafana/authlib/authz"
	"github.com/grafana/authlib/claims"
	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/auth"
	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/authn/grpcutils"
	"github.com/grafana/grafana/pkg/setting"
)

// TODO(drclau): decide on the audience for the resource store
const resourceStoreAudience = "resourceStore"

func NewLocalResourceStoreClient(server ResourceStoreServer) ResourceStoreClient {
	// scenario: local in-proc
	channel := &inprocgrpc.Channel{}

	grpcAuthInterceptor := grpcutils.NewInProcGrpcAuthenticator()
	channel.RegisterService(
		grpchan.InterceptServer(
			&ResourceStore_ServiceDesc,
			grpcAuth.UnaryServerInterceptor(grpcAuthInterceptor.Authenticate),
			grpcAuth.StreamServerInterceptor(grpcAuthInterceptor.Authenticate),
		),
		server,
	)

	clientInterceptor, _ := authnlib.NewGrpcClientInterceptor(
		&authnlib.GrpcClientConfig{},
		authnlib.WithDisableAccessTokenOption(),
		authnlib.WithIDTokenExtractorOption(idTokenExtractor),
	)
	return NewResourceStoreClient(
		grpchan.InterceptClientConn(
			channel,
			clientInterceptor.UnaryClientInterceptor,
			clientInterceptor.StreamClientInterceptor,
		))
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

func NewResourceStoreClientCloud(conn *grpc.ClientConn, cfg *setting.Cfg) (ResourceStoreClient, error) {
	// scenario: remote cloud
	grpcClientCfg := grpcutils.ReadGrpcClientConfig(cfg)
	grpcClientConfig := authnlib.GrpcClientConfig{
		TokenClientConfig: &authnlib.TokenExchangeConfig{
			Token:            grpcClientCfg.Token,
			TokenExchangeURL: grpcClientCfg.TokenExchangeURL,
		},
		TokenRequest: &authnlib.TokenExchangeRequest{
			Namespace: grpcClientCfg.TokenNamespace,
			Audiences: []string{resourceStoreAudience},
		},
	}

	opts := []authnlib.GrpcClientInterceptorOption{
		authnlib.WithIDTokenExtractorOption(idTokenExtractor),
		authnlib.WithMetadataExtractorOption(orgIdExtractor),
	}

	if cfg.Env == setting.Dev {
		client := http.DefaultClient
		client = &http.Client{Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}}}
		tokenClient, _ := authnlib.NewTokenExchangeClient(
			*grpcClientConfig.TokenClientConfig,
			authnlib.WithHTTPClient(client),
		)
		opts = append(opts, authnlib.WithTokenClientOption(tokenClient))
	}

	clientInterceptor, err := authnlib.NewGrpcClientInterceptor(
		&grpcClientConfig,
		opts...,
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

func orgIdExtractor(ctx context.Context) (key string, values []string, err error) {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return "", nil, err
	}

	return authzlib.DefaultStackIDMetadataKey, []string{fmt.Sprintf("%d", requester.GetOrgID())}, nil
}
