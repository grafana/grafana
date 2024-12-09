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
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
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
	cfg *setting.Cfg, features featuremgmt.FeatureToggles, ac accesscontrol.AccessControl,
	authnSvc authn.Service, folderSvc folder.Service, grpcServer grpcserver.Provider,
	tracer tracing.Tracer,
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
	server, err := newLegacyServer(authnSvc, ac, folderSvc, features, grpcServer, tracer, authCfg)
	if err != nil {
		return nil, err
	}

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

func newInProcLegacyClient(server *legacyServer, tracer tracing.Tracer) (authzlib.AccessChecker, error) {
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
		authzlib.WithTracerClientOption(tracer),
	)
}

func newGrpcLegacyClient(authCfg *Cfg, tracer tracing.Tracer) (authzlib.AccessChecker, error) {
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
			getDialOpts(clientInterceptor, authCfg.allowInsecure)...,
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

func newCloudLegacyClient(authCfg *Cfg, tracer tracing.Tracer) (authzlib.AccessChecker, error) {
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
			getDialOpts(clientInterceptor, authCfg.allowInsecure)...,
		),
		authzlib.WithTracerClientOption(tracer),
	)
	if err != nil {
		return nil, err
	}

	return client, nil
}

func getDialOpts(interceptor *authnlib.GrpcClientInterceptor, allowInsecure bool) []grpc.DialOption {
	dialOpts := []grpc.DialOption{
		grpc.WithUnaryInterceptor(interceptor.UnaryClientInterceptor),
		grpc.WithStreamInterceptor(interceptor.StreamClientInterceptor),
	}
	if allowInsecure {
		// allow insecure connections in development mode to facilitate testing
		dialOpts = append(dialOpts, grpc.WithTransportCredentials(insecure.NewCredentials()))
	}

	return dialOpts
}
