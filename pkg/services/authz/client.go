package authz

import (
	"context"

	"github.com/fullstorydev/grpchan"
	"github.com/fullstorydev/grpchan/inprocgrpc"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/auth"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/setting"
	grpcUtils "github.com/grafana/grafana/pkg/storage/unified/resource/grpc"
)

type Client interface {
	// TODO
}

type LegacyClient struct {
	clientV1 authzv1.AuthzServiceClient
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

	var client *LegacyClient

	// Register the server
	server, err := newLegacyServer(acSvc, features, grpcServer, tracer, authCfg)
	if err != nil {
		return nil, err
	}

	switch authCfg.mode {
	case ModeInProc:
		client = newInProcLegacyClient(server)
	case ModeGRPC:
		client, err = newGrpcLegacyClient(authCfg.remoteAddress)
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

func newInProcLegacyClient(server *legacyServer) *LegacyClient {
	channel := &inprocgrpc.Channel{}

	// TODO (gamab): change this once it's clear how to authenticate the client
	// Choices are:
	// - noAuth given it's in proc and we don't need the user
	// - access_token verif only as it's consistent with when it's remote (we check the service is allowed to call the authz service)
	// - access_token and id_token ? the id_token being only necessary when the user is trying to access the service straight away
	// auth := grpcUtils.ProvideAuthenticator(cfg)
	noAuth := func(ctx context.Context) (context.Context, error) {
		return ctx, nil
	}

	channel.RegisterService(
		grpchan.InterceptServer(
			&authzv1.AuthzService_ServiceDesc,
			grpcAuth.UnaryServerInterceptor(noAuth),
			grpcAuth.StreamServerInterceptor(noAuth),
		),
		server,
	)

	conn := grpchan.InterceptClientConn(channel, grpcUtils.UnaryClientInterceptor, grpcUtils.StreamClientInterceptor)

	client := authzv1.NewAuthzServiceClient(conn)

	return &LegacyClient{
		clientV1: client,
	}
}

func newGrpcLegacyClient(address string) (*LegacyClient, error) {
	// Create a connection to the gRPC server
	conn, err := grpc.NewClient(address, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, err
	}

	client := authzv1.NewAuthzServiceClient(conn)

	return &LegacyClient{
		clientV1: client,
	}, nil
}
