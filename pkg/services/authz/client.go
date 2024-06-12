package authz

import (
	"github.com/fullstorydev/grpchan"
	"github.com/fullstorydev/grpchan/inprocgrpc"
	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/auth"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	grpcUtils "github.com/grafana/grafana/pkg/services/store/entity/grpc"
	"github.com/grafana/grafana/pkg/setting"
)

type Client interface {
	// TODO
}

type LegacyClient struct {
	clientV1 authzv1.AuthzServiceClient
}

func ProvideAuthZClient(
	cfg *setting.Cfg, acSvc accesscontrol.Service, features featuremgmt.FeatureToggles,
	grpcServer grpcserver.Provider, tracer tracing.Tracer,
) (Client, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagAuthZGRPCServer) {
		return nil, nil
	}

	authCfg, err := ReadCfg(cfg)
	if err != nil {
		return nil, err
	}

	client := &LegacyClient{}

	// Register the server
	server, err := newLegacyServer(acSvc, features, grpcServer, tracer, authCfg)
	if err != nil {
		return nil, err
	}

	switch authCfg.mode {
	case ModeInProc:
		client = newLocalLegacyClient(server)
	case ModeGRPC:
		client, err = newRemoteLegacyClient(authCfg.remoteAddress)
		if err != nil {
			return nil, err
		}
	}

	return client, err
}

func ProvideRemoteAuthZClient(
	cfg *setting.Cfg, features featuremgmt.FeatureToggles,
) (Client, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagAuthZGRPCServer) {
		return nil, nil
	}

	authCfg, err := ReadCfg(cfg)
	if err != nil {
		return nil, err
	}

	return newRemoteLegacyClient(authCfg.remoteAddress)
}

func newLocalLegacyClient(server *legacyServer) *LegacyClient {
	channel := &inprocgrpc.Channel{}

	auth := &grpcUtils.Authenticator{}

	channel.RegisterService(
		grpchan.InterceptServer(
			&authzv1.AuthzService_ServiceDesc,
			grpcAuth.UnaryServerInterceptor(auth.Authenticate),
			grpcAuth.StreamServerInterceptor(auth.Authenticate),
		),
		server,
	)

	conn := grpchan.InterceptClientConn(channel, grpcUtils.UnaryClientInterceptor, grpcUtils.StreamClientInterceptor)

	client := authzv1.NewAuthzServiceClient(conn)

	return &LegacyClient{
		clientV1: client,
	}
}

func newRemoteLegacyClient(address string) (*LegacyClient, error) {
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
