package authz

import (
	"context"

	"github.com/fullstorydev/grpchan"
	"github.com/fullstorydev/grpchan/inprocgrpc"
	authnlib "github.com/grafana/authlib/authn"
	authzlib "github.com/grafana/authlib/authz"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/claims"
	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/auth"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/authz/rbac"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

// `authzService` is hardcoded in authz-service
const authzServiceAudience = "authzService"

type Client interface {
	authzlib.AccessClient
}

// ProvideAuthZClient provides an AuthZ client and creates the AuthZ service.
func ProvideAuthZClient(
	cfg *setting.Cfg, features featuremgmt.FeatureToggles, grpcServer grpcserver.Provider,
	tracer tracing.Tracer, db db.DB,
) (Client, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagAuthZGRPCServer) {
		return nil, nil
	}

	authCfg, err := ReadCfg(cfg)
	if err != nil {
		return nil, err
	}

	var client Client

	// Register the server
	sql := legacysql.NewDatabaseProvider(db)
	server := rbac.NewService(sql, legacy.NewLegacySQLStores(sql), log.New("authz-grpc-server"), tracer)

	switch authCfg.mode {
	case ModeInProc:
		client, err = newInProcLegacyClient(server, tracer)
		if err != nil {
			return nil, err
		}
	case ModeGRPC:
		client, err = newGrpcLegacyClient(authCfg, tracer)
		if err != nil {
			return nil, err
		}
	case ModeCloud:
		client, err = newCloudLegacyClient(authCfg, tracer)
		if err != nil {
			return nil, err
		}
	}

	return client, err
}

// ProvideStandaloneAuthZClient provides a standalone AuthZ client, without registering the AuthZ service.
// You need to provide a remote address in the configuration
func ProvideStandaloneAuthZClient(
	cfg *setting.Cfg, features featuremgmt.FeatureToggles, tracer tracing.Tracer,
) (Client, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagAuthZGRPCServer) {
		return nil, nil
	}

	authCfg, err := ReadCfg(cfg)
	if err != nil {
		return nil, err
	}

	if authCfg.mode == ModeGRPC {
		return newGrpcLegacyClient(authCfg, tracer)
	}
	return newCloudLegacyClient(authCfg, tracer)
}

func newInProcLegacyClient(server *rbac.Service, tracer tracing.Tracer) (authzlib.AccessClient, error) {
	// For in-proc use-case authorize add fake service claims - it should be able to access every namespace, as there is only one
	staticAuth := func(ctx context.Context) (context.Context, error) {
		ctx = claims.WithClaims(ctx, authnlib.NewAccessTokenAuthInfo(authnlib.Claims[authnlib.AccessTokenClaims]{
			Rest: authnlib.AccessTokenClaims{
				Namespace: "*",
			},
		}))
		return ctx, nil
	}

	channel := &inprocgrpc.Channel{}
	channel.RegisterService(
		grpchan.InterceptServer(
			&authzv1.AuthzService_ServiceDesc,
			grpcAuth.UnaryServerInterceptor(staticAuth),
			grpcAuth.StreamServerInterceptor(staticAuth),
		),
		server,
	)

	return authzlib.NewClient(
		&authzlib.ClientConfig{},
		authzlib.WithGrpcConnectionClientOption(channel),
		authzlib.WithDisableAccessTokenClientOption(),
		authzlib.WithTracerClientOption(tracer),
	)
}

func newGrpcLegacyClient(authCfg *Cfg, tracer tracing.Tracer) (authzlib.AccessClient, error) {
	// This client interceptor is a noop, as we don't send an access token
	clientConfig := authnlib.GrpcClientConfig{}
	clientInterceptor, err := authnlib.NewGrpcClientInterceptor(
		&clientConfig,
		authnlib.WithDisableAccessTokenOption(),
		authnlib.WithTracerOption(tracer),
	)
	if err != nil {
		return nil, err
	}

	cfg := authzlib.ClientConfig{RemoteAddress: authCfg.remoteAddress}
	client, err := authzlib.NewClient(&cfg,
		authzlib.WithGrpcDialOptionsClientOption(
			grpc.WithTransportCredentials(insecure.NewCredentials()),
			grpc.WithUnaryInterceptor(clientInterceptor.UnaryClientInterceptor),
			grpc.WithStreamInterceptor(clientInterceptor.StreamClientInterceptor),
		),
		authzlib.WithTracerClientOption(tracer),
		// TODO: remove this once access tokens are supported on-prem
		authzlib.WithDisableAccessTokenClientOption(),
	)
	if err != nil {
		return nil, err
	}

	return client, nil
}

func newCloudLegacyClient(authCfg *Cfg, tracer tracing.Tracer) (authzlib.AccessClient, error) {
	grpcClientConfig := authnlib.GrpcClientConfig{
		TokenClientConfig: &authnlib.TokenExchangeConfig{
			Token:            authCfg.token,
			TokenExchangeURL: authCfg.tokenExchangeURL,
		},
		TokenRequest: &authnlib.TokenExchangeRequest{
			Namespace: authCfg.tokenNamespace,
			Audiences: []string{authzServiceAudience},
		},
	}

	clientInterceptor, err := authnlib.NewGrpcClientInterceptor(&grpcClientConfig, authnlib.WithTracerOption(tracer))
	if err != nil {
		return nil, err
	}

	clientCfg := authzlib.ClientConfig{RemoteAddress: authCfg.remoteAddress}
	client, err := authzlib.NewClient(&clientCfg,
		authzlib.WithGrpcDialOptionsClientOption(
			grpc.WithTransportCredentials(insecure.NewCredentials()),
			grpc.WithUnaryInterceptor(clientInterceptor.UnaryClientInterceptor),
			grpc.WithStreamInterceptor(clientInterceptor.StreamClientInterceptor),
		),
		authzlib.WithTracerClientOption(tracer),
	)
	if err != nil {
		return nil, err
	}

	return client, nil
}
