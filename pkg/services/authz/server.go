package authz

import (
	"context"
	"fmt"

	authzlib "github.com/grafana/authlib/authz"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/claims"
	grpc_auth "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/auth"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authz/mappers"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/rbac"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

func RegisterRBACAuthZService(handler grpcserver.Provider, db legacysql.LegacyDatabaseProvider, tracer tracing.Tracer) {
	server := rbac.NewService(db, legacy.NewLegacySQLStores(db), log.New("authz-grpc-server"), tracer)

	srv := handler.GetServer()
	authzv1.RegisterAuthzServiceServer(srv, server)
	authzextv1.RegisterAuthzExtentionServiceServer(srv, server)
}

var _ authzv1.AuthzServiceServer = (*legacyServer)(nil)
var _ grpc_auth.ServiceAuthFuncOverride = (*legacyServer)(nil)
var _ authzlib.ServiceAuthorizeFuncOverride = (*legacyServer)(nil)

func newLegacyServer(
	authnSvc authn.Service, ac accesscontrol.AccessControl, folderSvc folder.Service,
	features featuremgmt.FeatureToggles, grpcServer grpcserver.Provider, tracer tracing.Tracer, cfg *Cfg,
) (*legacyServer, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagAuthZGRPCServer) {
		return nil, nil
	}

	l := &legacyServer{
		ac:        ac.WithoutResolvers(), // We want to skip the folder tree resolution as it's done by the service
		authnSvc:  authnSvc,
		folderSvc: folderSvc,
		logger:    log.New("authz-grpc-server"),
		tracer:    tracer,
		mapper:    mappers.NewK8sRbacMapper(),
	}

	if cfg.listen {
		if !cfg.allowInsecure {
			l.logger.Error("Not allowing the authz service to run in insecure mode as Auth is skipped")
		} else {
			grpcServer.GetServer().RegisterService(&authzv1.AuthzService_ServiceDesc, l)
		}
	}

	return l, nil
}

type legacyServer struct {
	authzv1.UnimplementedAuthzServiceServer

	ac        accesscontrol.AccessControl
	authnSvc  authn.Service
	folderSvc folder.Service
	logger    log.Logger
	tracer    tracing.Tracer
	mapper    *mappers.K8sRbacMapper
}

// AuthFuncOverride is a function that allows to override the default auth function.
// This is ok for now since we don't have on-prem access token support.
func (l *legacyServer) AuthFuncOverride(ctx context.Context, _ string) (context.Context, error) {
	ctx, span := l.tracer.Start(ctx, "authz.AuthFuncOverride")
	defer span.End()

	return ctx, nil
}

// AuthorizeFuncOverride is a function that allows to override the default authorize function that checks the namespace of the caller.
// This is ok for now since we don't have on-prem access token support.
func (l *legacyServer) AuthorizeFuncOverride(ctx context.Context) error {
	_, span := l.tracer.Start(ctx, "authz.AuthorizeFuncOverride")
	defer span.End()

	return nil
}

func wrapErr(err error) error {
	return status.Error(codes.Internal, fmt.Errorf("authz check failed: %w", err).Error())
}

func validateRequest(req *authzv1.CheckRequest) error {
	if req.GetGroup() == "" {
		return status.Error(codes.InvalidArgument, "group is required")
	}
	if req.GetResource() == "" {
		return status.Error(codes.InvalidArgument, "resource is required")
	}
	if req.GetVerb() == "" {
		return status.Error(codes.InvalidArgument, "verb is required")
	}
	if req.GetSubject() == "" {
		return status.Error(codes.InvalidArgument, "subject is required")
	}
	return nil
}

func (l *legacyServer) Check(ctx context.Context, req *authzv1.CheckRequest) (*authzv1.CheckResponse, error) {
	ctx, span := l.tracer.Start(ctx, "authz.Check")
	defer span.End()
	ctxLogger := l.logger.FromContext(ctx)

	deny := &authzv1.CheckResponse{Allowed: false}
	if err := validateRequest(req); err != nil {
		ctxLogger.Error("invalid request", "error", err)
		return deny, err
	}

	namespace := req.GetNamespace()
	info, err := claims.ParseNamespace(namespace)
	// We have to check the stackID as ParseNamespace returns orgID 1 for stacks namespaces
	if err != nil || info.OrgID == 0 || info.StackID != 0 {
		ctxLogger.Error("invalid namespace", "namespace", namespace, "error", err)
		return deny, status.Error(codes.InvalidArgument, "invalid namespace: "+namespace)
	}

	// Get the RBAC action associated with the request
	action, ok := l.mapper.Action(req.Group, req.Resource, req.Verb)
	if !ok {
		ctxLogger.Error("could not find associated rbac action", "group", req.Group, "resource", req.Resource, "verb", req.Verb)
		return deny, wrapErr(fmt.Errorf("could not find associated rbac action"))
	}

	// Get the user from the subject
	user, err := l.authnSvc.ResolveIdentity(ctx, info.OrgID, req.Subject)
	if err != nil {
		// TODO: should probably distinguish between not found and other errors
		ctxLogger.Error("could not resolve identity", "subject", req.Subject, "orgId", info.OrgID)
		return deny, wrapErr(fmt.Errorf("could not resolve identity"))
	}

	// Check if the user has the action solely
	if req.Name == "" && req.Folder == "" {
		ev := accesscontrol.EvalPermission(action)
		hasAccess, err := l.ac.Evaluate(ctx, user, ev)
		if err != nil {
			ctxLogger.Error("could not evaluate permission", "subject", req.Subject, "orgId", info.OrgID, "action", action)
			return deny, wrapErr(fmt.Errorf("could not evaluate permission"))
		}

		return &authzv1.CheckResponse{Allowed: hasAccess}, nil
	}

	scopes := make([]string, 0, 1)
	// If a parent is specified: Check if the user has access to any of the parent folders
	if req.Folder != "" {
		scopes, err = l.getFolderTree(ctx, info.OrgID, req.Folder)
		if err != nil {
			ctxLogger.Error("could not get folder tree", "folder", req.Folder, "orgId", info.OrgID, "error", err)
			return nil, wrapErr(err)
		}
	}
	// If a resource is specified: Check if the user has access to the requested resource
	if req.Name != "" {
		scope, ok := l.mapper.Scope(req.Group, req.Resource, req.Name)
		if !ok {
			ctxLogger.Error("could not get attribute for resource", "resource", req.Resource)
			return deny, wrapErr(fmt.Errorf("could not get attribute for resource"))
		}
		scopes = append(scopes, scope)
	}

	ev := accesscontrol.EvalPermission(action, scopes...)
	allowed, err := l.ac.Evaluate(ctx, user, ev)
	if err != nil {
		ctxLogger.Error("could not evaluate permission",
			"subject", req.Subject,
			"orgId", info.OrgID,
			"action", action,
			"folder", req.Folder,
			"scopes_count", len(scopes))
		return deny, fmt.Errorf("could not evaluate permission")
	}

	return &authzv1.CheckResponse{Allowed: allowed}, nil
}

func (l *legacyServer) getFolderTree(ctx context.Context, orgID int64, parent string) ([]string, error) {
	ctx, span := l.tracer.Start(ctx, "authz.getFolderTree")
	defer span.End()

	scopes := make([]string, 0, 6)
	// Get the folder tree
	folders, err := l.folderSvc.GetParents(ctx, folder.GetParentsQuery{UID: parent, OrgID: orgID})
	if err != nil {
		return nil, err
	}
	scopes = append(scopes, "folders:uid:"+parent)
	for _, f := range folders {
		scopes = append(scopes, "folders:uid:"+f.UID)
	}

	return scopes, nil
}
