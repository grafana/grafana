package rbac

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/claims"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"golang.org/x/sync/singleflight"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/mappers"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/rbac/store"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

const (
	shortCacheTTL        = 1 * time.Minute
	shortCleanupInterval = 5 * time.Minute
	longCacheTTL         = 5 * time.Minute
	longCleanupInterval  = 10 * time.Minute
)

type Service struct {
	authzv1.UnimplementedAuthzServiceServer
	authzextv1.UnimplementedAuthzExtentionServiceServer

	store         store.Store
	identityStore legacy.LegacyIdentityStore
	actionMapper  *mappers.K8sRbacMapper

	logger log.Logger
	tracer tracing.Tracer

	// Cache for user permissions, user team memberships and user basic roles
	idCache        *localcache.CacheService
	permCache      *localcache.CacheService
	teamCache      *localcache.CacheService
	basicRoleCache *localcache.CacheService
	folderCache    *localcache.CacheService

	// Deduplication of concurrent requests
	sf *singleflight.Group
}

func NewService(sql legacysql.LegacyDatabaseProvider, identityStore legacy.LegacyIdentityStore, logger log.Logger, tracer tracing.Tracer) *Service {
	return &Service{
		store:          store.NewStore(sql, tracer),
		identityStore:  identityStore,
		actionMapper:   mappers.NewK8sRbacMapper(),
		logger:         logger,
		tracer:         tracer,
		idCache:        localcache.New(longCacheTTL, longCleanupInterval),
		permCache:      localcache.New(shortCacheTTL, shortCleanupInterval),
		teamCache:      localcache.New(shortCacheTTL, shortCleanupInterval),
		basicRoleCache: localcache.New(longCacheTTL, longCleanupInterval),
		folderCache:    localcache.New(shortCacheTTL, shortCleanupInterval),
		sf:             new(singleflight.Group),
	}
}

func (s *Service) Check(ctx context.Context, req *authzv1.CheckRequest) (*authzv1.CheckResponse, error) {
	ctx, span := s.tracer.Start(ctx, "authz_direct_db.service.Check")
	defer span.End()
	ctxLogger := s.logger.FromContext(ctx)

	deny := &authzv1.CheckResponse{Allowed: false}

	checkReq, err := s.validateCheckRequest(ctx, req)
	if err != nil {
		ctxLogger.Error("invalid request", "error", err)
		return deny, err
	}
	ctx = request.WithNamespace(ctx, req.GetNamespace())

	permissions, err := s.getUserPermissions(ctx, checkReq.Namespace, checkReq.IdentityType, checkReq.UserUID, checkReq.Action)
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

func (s *Service) List(ctx context.Context, req *authzv1.ListRequest) (*authzv1.ListResponse, error) {
	ctx, span := s.tracer.Start(ctx, "authz_direct_db.service.List")
	defer span.End()
	ctxLogger := s.logger.FromContext(ctx)

	listReq, err := s.validateListRequest(ctx, req)
	if err != nil {
		ctxLogger.Error("invalid request", "error", err)
		return &authzv1.ListResponse{}, err
	}
	ctx = request.WithNamespace(ctx, req.GetNamespace())

	permissions, err := s.getUserPermissions(ctx, listReq.Namespace, listReq.IdentityType, listReq.UserUID, listReq.Action)
	if err != nil {
		ctxLogger.Error("could not get user permissions", "subject", req.GetSubject(), "error", err)
		return nil, err
	}

	return s.listPermission(ctx, permissions, listReq)
}

func (s *Service) validateCheckRequest(ctx context.Context, req *authzv1.CheckRequest) (*CheckRequest, error) {
	ctx, span := s.tracer.Start(ctx, "authz_direct_db.service.validateCheckRequest")
	defer span.End()

	ns, err := validateNamespace(ctx, req.GetNamespace())
	if err != nil {
		return nil, err
	}

	userUID, idType, err := s.validateSubject(ctx, req.GetSubject())
	if err != nil {
		return nil, err
	}

	action, err := s.validateAction(ctx, req.GetGroup(), req.GetResource(), req.GetVerb())
	if err != nil {
		return nil, err
	}

	checkReq := &CheckRequest{
		Namespace:    ns,
		UserUID:      userUID,
		IdentityType: idType,
		Action:       action,
		Group:        req.GetGroup(),
		Resource:     req.GetResource(),
		Verb:         req.GetVerb(),
		Name:         req.GetName(),
		ParentFolder: req.GetFolder(),
	}
	return checkReq, nil
}

func (s *Service) validateListRequest(ctx context.Context, req *authzv1.ListRequest) (*ListRequest, error) {
	ctx, span := s.tracer.Start(ctx, "authz_direct_db.service.validateListRequest")
	defer span.End()

	ns, err := validateNamespace(ctx, req.GetNamespace())
	if err != nil {
		return nil, err
	}

	userUID, idType, err := s.validateSubject(ctx, req.GetSubject())
	if err != nil {
		return nil, err
	}

	action, err := s.validateAction(ctx, req.GetGroup(), req.GetResource(), req.GetVerb())
	if err != nil {
		return nil, err
	}

	listReq := &ListRequest{
		Namespace:    ns,
		UserUID:      userUID,
		IdentityType: idType,
		Action:       action,
		Group:        req.GetGroup(),
		Resource:     req.GetResource(),
		Verb:         req.GetVerb(),
	}
	return listReq, nil
}

func validateNamespace(ctx context.Context, nameSpace string) (claims.NamespaceInfo, error) {
	if nameSpace == "" {
		return claims.NamespaceInfo{}, status.Error(codes.InvalidArgument, "namespace is required")
	}
	authInfo, has := claims.From(ctx)
	if !has {
		return claims.NamespaceInfo{}, status.Error(codes.Internal, "could not get auth info from context")
	}
	if !claims.NamespaceMatches(authInfo.GetNamespace(), nameSpace) {
		return claims.NamespaceInfo{}, status.Error(codes.PermissionDenied, "namespace does not match")
	}

	ns, err := claims.ParseNamespace(nameSpace)
	if err != nil {
		return claims.NamespaceInfo{}, err
	}
	return ns, nil
}

func (s *Service) validateSubject(ctx context.Context, subject string) (string, claims.IdentityType, error) {
	if subject == "" {
		return "", "", status.Error(codes.InvalidArgument, "subject is required")
	}

	ctxLogger := s.logger.FromContext(ctx)
	identityType, userUID, err := claims.ParseTypeID(subject)
	if err != nil {
		return "", "", err
	}
	// Permission check currently only checks user, anonymous user and service account permissions
	if !(identityType == claims.TypeUser || identityType == claims.TypeServiceAccount || identityType == claims.TypeAnonymous) {
		ctxLogger.Error("unsupported identity type", "type", identityType)
		return "", "", status.Error(codes.PermissionDenied, "unsupported identity type")
	}
	return userUID, identityType, nil
}

func (s *Service) validateAction(ctx context.Context, group, resource, verb string) (string, error) {
	ctxLogger := s.logger.FromContext(ctx)
	if group == "" || resource == "" || verb == "" {
		return "", status.Error(codes.InvalidArgument, "group, resource and verb are required")
	}
	action, ok := s.actionMapper.Action(group, resource, verb)
	if !ok {
		ctxLogger.Error("could not find associated rbac action", "group", group, "resource", resource, "verb", verb)
		return "", status.Error(codes.NotFound, "could not find associated rbac action")
	}
	return action, nil
}

func (s *Service) getUserPermissions(ctx context.Context, ns claims.NamespaceInfo, idType claims.IdentityType, userID, action string) (map[string]bool, error) {
	ctx, span := s.tracer.Start(ctx, "authz_direct_db.service.getUserPermissions")
	defer span.End()

	if idType == claims.TypeAnonymous {
		return s.getAnonymousPermissions(ctx, ns, action)
	}

	userIdentifiers, err := s.GetUserIdentifiers(ctx, ns, userID)
	if err != nil {
		return nil, err
	}

	userPermKey := userPermCacheKey(ns.Value, userIdentifiers.UID, action)
	if cached, ok := s.permCache.Get(userPermKey); ok {
		return cached.(map[string]bool), nil
	}

	res, err, _ := s.sf.Do(userPermKey+"_getUserPermissions", func() (interface{}, error) {
		basicRoles, err := s.getUserBasicRole(ctx, ns, userIdentifiers)
		if err != nil {
			return nil, err
		}

		teamIDs, err := s.getUserTeams(ctx, ns, userIdentifiers)
		if err != nil {
			return nil, err
		}

		userPermQuery := store.PermissionsQuery{
			UserID:        userIdentifiers.ID,
			Action:        action,
			TeamIDs:       teamIDs,
			Role:          basicRoles.Role,
			IsServerAdmin: basicRoles.IsAdmin,
		}

		permissions, err := s.store.GetUserPermissions(ctx, ns, userPermQuery)
		if err != nil {
			return nil, err
		}
		scopeMap := getScopeMap(permissions)

		s.permCache.Set(userPermKey, scopeMap, 0)
		span.SetAttributes(attribute.Int("num_permissions_fetched", len(permissions)))

		return scopeMap, nil
	})

	if err != nil {
		return nil, err
	}

	return res.(map[string]bool), nil
}

func (s *Service) getAnonymousPermissions(ctx context.Context, ns claims.NamespaceInfo, action string) (map[string]bool, error) {
	ctx, span := s.tracer.Start(ctx, "authz_direct_db.service.getAnonymousPermissions")
	defer span.End()

	anonPermKey := anonymousPermCacheKey(ns.Value, action)
	if cached, ok := s.permCache.Get(anonPermKey); ok {
		return cached.(map[string]bool), nil
	}

	res, err, _ := s.sf.Do(anonPermKey+"_getAnonymousPermissions", func() (interface{}, error) {
		permissions, err := s.store.GetUserPermissions(ctx, ns, store.PermissionsQuery{Action: action, Role: "Viewer"})
		if err != nil {
			return nil, err
		}
		scopeMap := getScopeMap(permissions)
		s.permCache.Set(anonPermKey, scopeMap, 0)
		return scopeMap, nil
	})

	if err != nil {
		return nil, err
	}

	return res.(map[string]bool), nil
}

func (s *Service) GetUserIdentifiers(ctx context.Context, ns claims.NamespaceInfo, userUID string) (*store.UserIdentifiers, error) {
	uidCacheKey := userIdentifierCacheKey(ns.Value, userUID)
	if cached, ok := s.idCache.Get(uidCacheKey); ok {
		return cached.(*store.UserIdentifiers), nil
	}

	idCacheKey := userIdentifierCacheKeyById(ns.Value, userUID)
	if cached, ok := s.idCache.Get(idCacheKey); ok {
		return cached.(*store.UserIdentifiers), nil
	}

	var userIDQuery store.UserIdentifierQuery
	// Assume that numeric UID is user ID
	if userID, err := strconv.Atoi(userUID); err == nil {
		userIDQuery = store.UserIdentifierQuery{UserID: int64(userID)}
	} else {
		userIDQuery = store.UserIdentifierQuery{UserUID: userUID}
	}
	userIdentifiers, err := s.store.GetUserIdentifiers(ctx, userIDQuery)
	if err != nil {
		return nil, fmt.Errorf("could not get user internal id: %w", err)
	}

	s.idCache.Set(uidCacheKey, userIdentifiers, 0)
	s.idCache.Set(idCacheKey, userIdentifiers, 0)

	return userIdentifiers, nil
}

func (s *Service) getUserTeams(ctx context.Context, ns claims.NamespaceInfo, userIdentifiers *store.UserIdentifiers) ([]int64, error) {
	ctx, span := s.tracer.Start(ctx, "authz_direct_db.service.getUserTeams")
	defer span.End()

	teamIDs := make([]int64, 0, 50)
	teamsCacheKey := userTeamCacheKey(ns.Value, userIdentifiers.UID)
	if cached, ok := s.teamCache.Get(teamsCacheKey); ok {
		return cached.([]int64), nil
	}

	teamQuery := legacy.ListUserTeamsQuery{
		UserUID:    userIdentifiers.UID,
		Pagination: common.Pagination{Limit: 50},
	}

	for {
		teams, err := s.identityStore.ListUserTeams(ctx, ns, teamQuery)
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
	s.teamCache.Set(teamsCacheKey, teamIDs, 0)
	span.SetAttributes(attribute.Int("num_user_teams", len(teamIDs)))

	return teamIDs, nil
}

func (s *Service) getUserBasicRole(ctx context.Context, ns claims.NamespaceInfo, userIdentifiers *store.UserIdentifiers) (store.BasicRole, error) {
	ctx, span := s.tracer.Start(ctx, "authz_direct_db.service.getUserBasicRole")
	defer span.End()

	basicRoleKey := userBasicRoleCacheKey(ns.Value, userIdentifiers.UID)
	if cached, ok := s.basicRoleCache.Get(basicRoleKey); ok {
		return cached.(store.BasicRole), nil
	}

	basicRole, err := s.store.GetBasicRoles(ctx, ns, store.BasicRoleQuery{UserID: userIdentifiers.ID})
	if err != nil {
		return store.BasicRole{}, fmt.Errorf("could not get basic roles: %w", err)
	}
	if basicRole == nil {
		basicRole = &store.BasicRole{}
	}
	s.basicRoleCache.Set(basicRoleKey, *basicRole, 0)

	return *basicRole, nil
}

func (s *Service) checkPermission(ctx context.Context, scopeMap map[string]bool, req *CheckRequest) (bool, error) {
	ctx, span := s.tracer.Start(ctx, "authz_direct_db.service.checkPermission", trace.WithAttributes(
		attribute.Int("scope_count", len(scopeMap))))
	defer span.End()
	ctxLogger := s.logger.FromContext(ctx)

	// Only check action if the request doesn't specify scope
	if req.Name == "" {
		return len(scopeMap) > 0, nil
	}

	// Wildcard grant, no further checks needed
	if scopeMap["*"] {
		return true, nil
	}

	scope, has := s.actionMapper.Scope(req.Group, req.Resource, req.Name)
	if !has {
		ctxLogger.Error("could not get attribute for resource", "resource", req.Resource)
		return false, fmt.Errorf("could not get attribute for resource")
	}
	if scopeMap[scope] {
		return true, nil
	}

	return s.checkInheritedPermissions(ctx, scopeMap, req)
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

func (s *Service) checkInheritedPermissions(ctx context.Context, scopeMap map[string]bool, req *CheckRequest) (bool, error) {
	if req.ParentFolder == "" {
		return false, nil
	}

	ctx, span := s.tracer.Start(ctx, "authz_direct_db.service.checkInheritedPermissions")
	defer span.End()
	ctxLogger := s.logger.FromContext(ctx)

	folderMap, err := s.buildFolderTree(ctx, req.Namespace)
	if err != nil {
		ctxLogger.Error("could not build folder and dashboard tree", "error", err)
		return false, err
	}

	currentUID := req.ParentFolder
	for {
		if node, has := folderMap[currentUID]; has {
			scope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(node.uid)
			if scopeMap[scope] {
				return true, nil
			}
			if node.parentUID == nil {
				break
			}
			currentUID = *node.parentUID
		} else {
			break
		}
	}
	return false, nil
}

func (s *Service) buildFolderTree(ctx context.Context, ns claims.NamespaceInfo) (map[string]FolderNode, error) {
	ctx, span := s.tracer.Start(ctx, "authz_direct_db.service.buildFolderTree")
	defer span.End()

	key := folderCacheKey(ns.Value)
	if cached, ok := s.folderCache.Get(key); ok {
		return cached.(map[string]FolderNode), nil
	}

	res, err, _ := s.sf.Do(ns.Value+"_buildFolderTree", func() (interface{}, error) {
		folders, err := s.store.GetFolders(ctx, ns)
		if err != nil {
			return nil, fmt.Errorf("could not get folders: %w", err)
		}
		span.SetAttributes(attribute.Int("num_folders", len(folders)))

		folderMap := make(map[string]FolderNode, len(folders))
		for _, folder := range folders {
			if node, has := folderMap[folder.UID]; !has {
				folderMap[folder.UID] = FolderNode{
					uid:       folder.UID,
					parentUID: folder.ParentUID,
				}
			} else {
				node.parentUID = folder.ParentUID
				folderMap[folder.UID] = node
			}
			// Register that the parent has this child node
			if folder.ParentUID == nil {
				continue
			}
			if parent, has := folderMap[*folder.ParentUID]; has {
				parent.childrenUIDs = append(parent.childrenUIDs, folder.UID)
				folderMap[*folder.ParentUID] = parent
			} else {
				folderMap[*folder.ParentUID] = FolderNode{
					uid:          *folder.ParentUID,
					childrenUIDs: []string{folder.UID},
				}
			}
		}

		s.folderCache.Set(key, folderMap, 0)
		return folderMap, nil
	})

	if err != nil {
		return nil, err
	}

	return res.(map[string]FolderNode), nil
}

func (s *Service) listPermission(ctx context.Context, scopeMap map[string]bool, req *ListRequest) (*authzv1.ListResponse, error) {
	if scopeMap["*"] {
		return &authzv1.ListResponse{All: true}, nil
	}

	ctx, span := s.tracer.Start(ctx, "authz_direct_db.service.listPermission")
	defer span.End()
	ctxLogger := s.logger.FromContext(ctx)

	folderMap, err := s.buildFolderTree(ctx, req.Namespace)
	if err != nil {
		ctxLogger.Error("could not build folder and dashboard tree", "error", err)
		return nil, err
	}

	folderSet := make(map[string]struct{}, len(scopeMap))
	dashSet := make(map[string]struct{}, len(scopeMap))
	for scope := range scopeMap {
		if strings.HasPrefix(scope, "folders:uid:") {
			identifier := scope[len("folders:uid:"):]
			if _, ok := folderSet[identifier]; ok {
				continue
			}
			folderSet[identifier] = struct{}{}
			getChildren(folderMap, identifier, folderSet)
		} else if strings.HasPrefix(scope, "dashboards:uid:") {
			identifier := scope[len("dashboards:uid:"):]
			dashSet[identifier] = struct{}{}
		}
	}

	folderList := make([]string, 0, len(folderSet))
	for folder := range folderSet {
		folderList = append(folderList, folder)
	}

	dashList := make([]string, 0, len(dashSet))
	for dash := range dashSet {
		dashList = append(dashList, dash)
	}

	span.SetAttributes(attribute.Int("num_folders", len(folderList)), attribute.Int("num_dashboards", len(dashList)))
	return &authzv1.ListResponse{Folders: folderList, Items: dashList}, nil
}

func getChildren(folderMap map[string]FolderNode, folderUID string, folderSet map[string]struct{}) {
	folder, has := folderMap[folderUID]
	if !has {
		return
	}
	for _, child := range folder.childrenUIDs {
		// We have already processed all the children of this folder
		if _, ok := folderSet[child]; ok {
			return
		}
		folderSet[child] = struct{}{}
		getChildren(folderMap, child, folderSet)
	}
}
