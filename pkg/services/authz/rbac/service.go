package rbac

import (
	"context"
	"fmt"
	"strconv"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/claims"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/mappers"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/rbac/store"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

type Service struct {
	authzv1.UnimplementedAuthzServiceServer
	authzextv1.UnimplementedAuthzExtentionServiceServer

	store         *store.Store
	identityStore legacy.LegacyIdentityStore
	actionMapper  *mappers.K8sRbacMapper

	logger log.Logger
	tracer tracing.Tracer
}

func NewService(sql legacysql.LegacyDatabaseProvider, identityStore legacy.LegacyIdentityStore, logger log.Logger, tracer tracing.Tracer) *Service {
	return &Service{
		store:         store.NewStore(sql),
		identityStore: identityStore,
		actionMapper:  mappers.NewK8sRbacMapper(),
		logger:        logger,
		tracer:        tracer,
	}
}

func (s *Service) Check(ctx context.Context, req *authzv1.CheckRequest) (*authzv1.CheckResponse, error) {
	ctx, span := s.tracer.Start(ctx, "authz_direct_db.Check")
	defer span.End()
	ctxLogger := s.logger.FromContext(ctx)

	deny := &authzv1.CheckResponse{Allowed: false}

	checkReq, err := s.validateRequest(ctx, req)
	if err != nil {
		ctxLogger.Error("invalid request", "error", err)
		return deny, err
	}
	ctx = request.WithNamespace(ctx, req.GetNamespace())

	permissions, err := s.getUserPermissions(ctx, checkReq)
	if err != nil {
		ctxLogger.Error("could not get user permissions", "subject", req.GetSubject(), "error", err)
		return deny, err
	}

	allowed, err := s.checkPermission(ctx, permissions, checkReq)
	if err != nil {
		ctxLogger.Error("could not check permission", "error", err)
		return deny, err
	}
	return &authzv1.CheckResponse{Allowed: allowed}, nil
}

func (s *Service) validateRequest(ctx context.Context, req *authzv1.CheckRequest) (*CheckRequest, error) {
	ctxLogger := s.logger.FromContext(ctx)

	if req.GetNamespace() == "" {
		return nil, status.Error(codes.InvalidArgument, "namespace is required")
	}
	authInfo, has := claims.From(ctx)
	if !has {
		return nil, status.Error(codes.Internal, "could not get auth info from context")
	}
	if !claims.NamespaceMatches(authInfo.GetNamespace(), req.GetNamespace()) {
		return nil, status.Error(codes.PermissionDenied, "namespace does not match")
	}

	ns, err := claims.ParseNamespace(req.GetNamespace())
	if err != nil {
		ctxLogger.Error("could not parse namespace", "namespace", req.GetNamespace(), "error", err)
		return nil, err
	}

	if req.GetSubject() == "" {
		return nil, status.Error(codes.InvalidArgument, "subject is required")
	}
	user := req.GetSubject()
	identityType, userUID, err := claims.ParseTypeID(user)
	if err != nil {
		ctxLogger.Error("could not parse subject", "subject", user, "error", err)
		return nil, err
	}
	// Permission check currently only checks user and service account permissions, so might return a false negative for other types
	if !(identityType == claims.TypeUser || identityType == claims.TypeServiceAccount) {
		ctxLogger.Warn("unsupported identity type", "type", identityType)
	}

	if req.GetGroup() == "" || req.GetResource() == "" || req.GetVerb() == "" {
		return nil, status.Error(codes.InvalidArgument, "group, resource and verb are required")
	}
	action, ok := s.actionMapper.Action(req.GetGroup(), req.GetResource(), req.GetVerb())
	if !ok {
		ctxLogger.Error("could not find associated rbac action", "group", req.GetGroup(), "resource", req.GetResource(), "verb", req.GetVerb())
		return nil, status.Error(codes.NotFound, "could not find associated rbac action")
	}

	checkReq := &CheckRequest{
		Namespace: ns,
		UserUID:   userUID,
		Action:    action,
		Group:     req.GetGroup(),
		Resource:  req.GetResource(),
		Verb:      req.GetVerb(),
		Name:      req.GetName(),
	}
	return checkReq, nil
}

func (s *Service) getUserPermissions(ctx context.Context, req *CheckRequest) ([]accesscontrol.Permission, error) {
	var userIDQuery store.UserIdentifierQuery
	// Assume that numeric UID is user ID
	if userID, err := strconv.Atoi(req.UserUID); err == nil {
		userIDQuery = store.UserIdentifierQuery{UserID: int64(userID)}
	} else {
		userIDQuery = store.UserIdentifierQuery{UserUID: req.UserUID}
	}
	userIdentifiers, err := s.store.GetUserIdentifiers(ctx, userIDQuery)
	if err != nil {
		return nil, fmt.Errorf("could not get user internal id: %w", err)
	}

	basicRoles, err := s.store.GetBasicRoles(ctx, req.Namespace, store.BasicRoleQuery{UserID: userIdentifiers.ID})
	if err != nil {
		return nil, fmt.Errorf("could not get basic roles: %w", err)
	}

	teamIDs := make([]int64, 0, 50)
	teamQuery := legacy.ListUserTeamsQuery{
		UserUID:    userIdentifiers.UID,
		Pagination: common.Pagination{Limit: 50},
	}

	for {
		teams, err := s.identityStore.ListUserTeams(ctx, req.Namespace, teamQuery)
		if err != nil {
			return nil, fmt.Errorf("could not get user teams: %w", err)
		}
		for _, team := range teams.Items {
			teamIDs = append(teamIDs, team.ID)
		}
		teamQuery.Pagination.Continue = teams.Continue
		if teams.Continue == 0 {
			break
		}
	}

	userPermQuery := store.PermissionsQuery{
		UserID:        userIdentifiers.ID,
		Action:        req.Action,
		TeamIDs:       teamIDs,
		Role:          basicRoles.Role,
		IsServerAdmin: basicRoles.IsAdmin,
	}

	return s.store.GetUserPermissions(ctx, req.Namespace, userPermQuery)
}

func (s *Service) checkPermission(ctx context.Context, permissions []accesscontrol.Permission, req *CheckRequest) (bool, error) {
	ctxLogger := s.logger.FromContext(ctx)

	// Only check action if the request doesn't specify scope
	if req.Name == "" {
		return len(permissions) > 0, nil
	}

	scopeMap := getScopeMap(permissions)

	// Wildcard grant, no further checks needed
	if scopeMap["*"] {
		return true, nil
	}

	scope, has := s.actionMapper.Scope(req.Group, req.Resource, req.Name)
	if !has {
		ctxLogger.Error("could not get attribute for resource", "resource", req.Resource)
		return false, fmt.Errorf("could not get attribute for resource")
	}
	return scopeMap[scope], nil
}

func getScopeMap(permissions []accesscontrol.Permission) map[string]bool {
	permMap := make(map[string]bool, len(permissions))
	for _, perm := range permissions {
		// If has any wildcard, return immediately
		if perm.Kind == "*" || perm.Attribute == "*" || perm.Identifier == "*" {
			return map[string]bool{"*": true}
		}
		permMap[perm.Scope] = true
	}
	return permMap
}
