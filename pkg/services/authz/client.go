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

const (
	MethodCreate = "create"
	MethodRead   = "read"
	MethodUpdate = "update"
	MethodDelete = "delete"
)

func ToRbacAction(method string, object authzlib.Resource) string {
	return object.Kind + ":" + method
}

type HasAccessRequest struct {
	// StackID is the ID of the stack the request is made in, can be seamlessly replaced by OrgID on prem.
	StackID int64
	// Subject is the namespaced ID of the user we want to check access for.
	Subject string
	// Method is the action we want to check access for (create, read, update, delete)
	Method string
	// Object is the resource we want to check access on.
	Object authzlib.Resource
	// Parent is the parent resource of the object we want to check access on.
	// (Note: This is the future contextual tuple that will be added to the check request.)
	Parent authzlib.Resource
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
	server, err := newLegacyServer(cfg, authCfg, acSvc, features, grpcServer, tracer)
	if err != nil {
		return nil, err
	}

	switch authCfg.mode {
	case ModeInProc:
		client = newInProcLegacyClient(tracer, server)
	case ModeGRPC:
		client, err = newGrpcLegacyClient(tracer, authCfg.remoteAddress)
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

	return newGrpcLegacyClient(tracer, authCfg.remoteAddress)
}

func newInProcLegacyClient(tracer tracing.Tracer, server *legacyServer) *LegacyClient {
	channel := &inprocgrpc.Channel{}

	// In-process we don't have to authenticate the service making the request
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
		logger:   log.New("authz.client"),
		tracer:   tracer,
	}
}

func newGrpcLegacyClient(tracer tracing.Tracer, address string) (*LegacyClient, error) {
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
		Action:  ToRbacAction(req.Method, req.Object),
		Subject: req.Subject,
	}

	// TODO (gamab) add access token and id token if we make the call for the user

	resp, err := c.clientV1.Read(ctx, readReq)
	if err != nil {
		return false, tracing.Errorf(span, "failed to check access: %w", err)
	}

	objs := []string{}
	for _, o := range resp.Data {
		objs = append(objs, o.Object)
	}

	// TODO (gamab): Add caching

	// FIXME: id based checks are not supported
	req.Object.Attr = "uid"
	req.Parent.Attr = "uid"

	if req.Parent.ID == "" {
		checker := compileChecker(objs, req.Object.Kind)
		return checker(req.Object), nil
	}

	checker := compileChecker(objs, req.Object.Kind, req.Parent.Kind)
	return checker(req.Object, req.Parent), nil
}
