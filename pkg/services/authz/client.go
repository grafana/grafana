package authz

import (
	"context"

	"github.com/fullstorydev/grpchan"
	"github.com/fullstorydev/grpchan/inprocgrpc"
	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/auth"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	authzlib "github.com/grafana/authlib/authz"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	grpcUtils "github.com/grafana/grafana/pkg/services/store/entity/grpc"
	"github.com/grafana/grafana/pkg/setting"
)

type HasAccessRequest struct {
	StackID int64
	Subject string
	Action  string
	Object  authzlib.Resource
}

type Client interface {
	HasAccess(ctx context.Context, req *HasAccessRequest) (bool, error)
	// TODO
}

type LegacyClient struct {
	clientV1 authzv1.AuthzServiceClient
	logger   log.Logger
	tracer   tracing.Tracer
}

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
		client = newLocalLegacyClient(cfg, tracer, server)
	case ModeGRPC:
		client, err = newRemoteLegacyClient(tracer, authCfg.remoteAddress)
		if err != nil {
			return nil, err
		}
	}

	return client, err
}

func ProvideRemoteAuthZClient(
	cfg *setting.Cfg, features featuremgmt.FeatureToggles, tracer tracing.Tracer,
) (Client, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagAuthZGRPCServer) {
		return nil, nil
	}

	authCfg, err := ReadCfg(cfg)
	if err != nil {
		return nil, err
	}

	return newRemoteLegacyClient(tracer, authCfg.remoteAddress)
}

func newLocalLegacyClient(cfg *setting.Cfg, tracer tracing.Tracer, server *legacyServer) *LegacyClient {
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
			grpcAuth.UnaryServerInterceptor(noAuth),  // TODO (gamab): add auth
			grpcAuth.StreamServerInterceptor(noAuth), // TODO (gamab): add auth
		),
		server,
	)

	conn := grpchan.InterceptClientConn(channel, grpcUtils.UnaryClientInterceptor, grpcUtils.StreamClientInterceptor)

	client := authzv1.NewAuthzServiceClient(conn)

	return &LegacyClient{
		clientV1: client,
		logger:   log.New("authz.client"),
		tracer:   tracer,
	}
}

func newRemoteLegacyClient(tracer tracing.Tracer, address string) (*LegacyClient, error) {
	// Create a connection to the gRPC server
	conn, err := grpc.NewClient(address, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, err
	}

	client := authzv1.NewAuthzServiceClient(conn)

	return &LegacyClient{
		clientV1: client,
		logger:   log.New("authz.client"),
		tracer:   tracer,
	}, nil
}

// TODO cover heavily with tests
func (c *LegacyClient) HasAccess(ctx context.Context, req *HasAccessRequest) (bool, error) {
	ctx, span := c.tracer.Start(ctx, "authz.client.HasAccess")
	defer span.End()

	ctxLogger := c.logger.FromContext(ctx)
	if req == nil {
		ctxLogger.Warn("HasAccess called with no request")
		return true, nil
	}

	readReq := &authzv1.ReadRequest{
		StackId: req.StackID,
		Action:  req.Action,
		Subject: req.Subject,
	}

	// TODO add token to system?

	resp, err := c.clientV1.Read(ctx, readReq)
	if err != nil {
		return false, tracing.Errorf(span, "failed to check access: %w", err)
	}

	objs := []string{}
	for _, o := range resp.Data {
		objs = append(objs, o.Object)
	}

	// TODO: Add caching

	// Probably needs a mapping in case their are multiple kinds
	checker := compileChecker(objs, req.Object.Kind)

	return checker(req.Object), nil
}
