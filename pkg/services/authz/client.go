package authz

import (
	"context"

	"github.com/fullstorydev/grpchan"
	"github.com/fullstorydev/grpchan/inprocgrpc"
	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/auth"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"

	authnlib "github.com/grafana/authlib/authn"
	authzlib "github.com/grafana/authlib/authz"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/setting"
	grpcUtils "github.com/grafana/grafana/pkg/storage/unified/resource/grpc"
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
	authCfg     *Cfg
	clientV1    authzv1.AuthzServiceClient
	logger      log.Logger
	tokenClient authnlib.TokenExchanger
	tracer      tracing.Tracer
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
	server, err := newLegacyServer(authCfg, acSvc, features, grpcServer, tracer)
	if err != nil {
		return nil, err
	}

	switch authCfg.mode {
	case ModeInProc:
		client = newInProcLegacyClient(authCfg, tracer, server)
	case ModeGRPC:
		client, err = newGrpcLegacyClient(authCfg, tracer)
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

	return newGrpcLegacyClient(authCfg, tracer)
}

func newInProcLegacyClient(authCfg *Cfg, tracer tracing.Tracer, server *legacyServer) *LegacyClient {
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
		authCfg:  authCfg,
		clientV1: client,
		logger:   log.New("authz.client"),
		tracer:   tracer,
	}
}

func newGrpcLegacyClient(authCfg *Cfg, tracer tracing.Tracer) (*LegacyClient, error) {
	// Create a connection to the gRPC server
	conn, err := grpc.NewClient(authCfg.remoteAddress, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, err
	}

	client := authzv1.NewAuthzServiceClient(conn)

	var tokenClient authnlib.TokenExchanger
	if authCfg.env != setting.Dev {
		// Instantiate the token exchange client
		tokenClient, err = authnlib.NewTokenExchangeClient(authnlib.TokenExchangeConfig{
			Token:            authCfg.token,
			TokenExchangeURL: authCfg.tokenExchangeUrl,
		})
		if err != nil {
			return nil, err
		}
	}

	return &LegacyClient{
		authCfg:     authCfg,
		clientV1:    client,
		logger:      log.New("authz.client"),
		tokenClient: tokenClient,
		tracer:      tracer,
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

	action := ToRbacAction(req.Method, req.Object)

	authCtx, err := identity.GetAuthCtx(ctx)
	if err != nil {
		return false, tracing.Errorf(span, "failed to get the request auth context: %w", err)
	}

	// No user => check on the service permissions
	if authCtx.IDClaims == nil {
		if authCtx.AccessClaims == nil {
			return false, tracing.Errorf(span, "failed to get access claims")
		}
		perms := authCtx.AccessClaims.Rest.Permissions
		for _, p := range perms {
			if p == action {
				return true, nil
			}
		}
		return false, nil
	}

	// Impersonation => fetch the user permissions
	if authCtx.AccessClaims == nil && c.authCfg.env != setting.Dev {
		ctxLogger.Error("access claims are required when running in production mode")
		return false, tracing.Errorf(span, "missing access claims")
	}
	// Make sure the service is allowed to perform the requested action
	if authCtx.AccessClaims != nil {
		if authCtx.AccessClaims.Rest.DelegatedPermissions == nil {
			return false, nil
		}
		serviceIsAllowedAction := false
		for _, p := range authCtx.AccessClaims.Rest.DelegatedPermissions {
			if p == action {
				serviceIsAllowedAction = true
				break
			}
		}
		if !serviceIsAllowedAction {
			return false, nil
		}
	}

	// Instantiate a new context for the request
	// TODO (drclau): should we copy the context and remove what we don't need.
	outCtx := context.Background()

	readReq := &authzv1.ReadRequest{
		StackId: req.StackID,
		Action:  action,
		Subject: req.Subject,
	}

	// Exchange a token to query the authz service
	if c.tokenClient != nil {
		token, err := c.tokenClient.Exchange(ctx, authnlib.TokenExchangeRequest{
			Namespace: c.authCfg.tokenNamespace,
			Audiences: c.authCfg.tokenAudience,
		})
		if err != nil {
			return false, tracing.Errorf(span, "failed to exchange token: %w", err)
		}
		outCtx = metadata.NewOutgoingContext(outCtx, metadata.Pairs("x-access-token", token.Token))
	}

	// Query the authz service
	resp, err := c.clientV1.Read(outCtx, readReq)
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
