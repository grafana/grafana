package authz

import (
	"context"

	"github.com/fullstorydev/grpchan"
	"github.com/fullstorydev/grpchan/inprocgrpc"
	authnlib "github.com/grafana/authlib/authn"
	authzlib "github.com/grafana/authlib/authz"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/auth"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/setting"
)

// `authzService` is hardcoded in authz-service
const authzServiceAudience = "authzService"

type Client interface {
	authzlib.AccessChecker
}

// ProvideAuthZClient provides an AuthZ client and creates the AuthZ service.
func ProvideAuthZClient(
	cfg *setting.Cfg, features featuremgmt.FeatureToggles, acSvc accesscontrol.Service,
	grpcServer grpcserver.Provider, tracer tracing.Tracer,
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
	server, err := newLegacyServer(acSvc, features, grpcServer, tracer, authCfg)
	if err != nil {
		return nil, err
	}

	switch authCfg.mode {
	case ModeInProc:
		client, err = newInProcLegacyClient(server)
		if err != nil {
			return nil, err
		}
	case ModeGRPC:
		client, err = newGrpcLegacyClient(authCfg.remoteAddress)
		if err != nil {
			return nil, err
		}
	case ModeCloud:
		client, err = newCloudLegacyClient(authCfg)
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

	return newGrpcLegacyClient(authCfg.remoteAddress)
}

func newInProcLegacyClient(server *legacyServer) (authzlib.AccessChecker, error) {
	noAuth := func(ctx context.Context) (context.Context, error) {
		return ctx, nil
	}

	channel := &inprocgrpc.Channel{}
	channel.RegisterService(
		grpchan.InterceptServer(
			&authzv1.AuthzService_ServiceDesc,
			grpcAuth.UnaryServerInterceptor(noAuth),
			grpcAuth.StreamServerInterceptor(noAuth),
		),
		server,
	)

	return authzlib.NewClient(
		&authzlib.ClientConfig{},
		authzlib.WithGrpcConnectionClientOption(channel),
		authzlib.WithDisableAccessTokenClientOption(),
	)
}

func newGrpcLegacyClient(address string) (authzlib.AccessChecker, error) {
	// This client interceptor is a noop, as we don't send an access token
	grpcClientConfig := authnlib.GrpcClientConfig{}
	clientInterceptor, err := authnlib.NewGrpcClientInterceptor(&grpcClientConfig,
		authnlib.WithDisableAccessTokenOption(),
	)
	if err != nil {
		return nil, err
	}

	cfg := authzlib.ClientConfig{RemoteAddress: address}
	client, err := authzlib.NewClient(&cfg,
		// TODO(drclau): make this configurable (e.g. allow to use insecure connections)
		authzlib.WithGrpcDialOptionsClientOption(
			grpc.WithTransportCredentials(insecure.NewCredentials()),
			grpc.WithUnaryInterceptor(clientInterceptor.UnaryClientInterceptor),
			grpc.WithStreamInterceptor(clientInterceptor.StreamClientInterceptor),
		),
		// TODO(drclau): remove this once we have access token support on-prem
		authzlib.WithDisableAccessTokenClientOption(),
	)
	if err != nil {
		return nil, err
	}

	return client, nil
}

func newCloudLegacyClient(authCfg *Cfg) (authzlib.AccessChecker, error) {
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

	clientInterceptor, err := authnlib.NewGrpcClientInterceptor(&grpcClientConfig)
	if err != nil {
		return nil, err
	}

	clientCfg := authzlib.ClientConfig{RemoteAddress: authCfg.remoteAddress}
	client, err := authzlib.NewClient(&clientCfg,
		// TODO(drclau): make this configurable (e.g. allow to use insecure connections)
		authzlib.WithGrpcDialOptionsClientOption(
			grpc.WithTransportCredentials(insecure.NewCredentials()),
			grpc.WithUnaryInterceptor(clientInterceptor.UnaryClientInterceptor),
			grpc.WithStreamInterceptor(clientInterceptor.StreamClientInterceptor),
		),
	)
	if err != nil {
		return nil, err
	}

	return client, nil
}
