package rbac

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"golang.org/x/sync/singleflight"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"k8s.io/apiserver/pkg/endpoints/request"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/cache"
	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
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

	store           store.Store
	permissionStore store.PermissionStore
	identityStore   legacy.LegacyIdentityStore

	mapper mapper

	logger  log.Logger
	tracer  tracing.Tracer
	metrics *metrics

	// Deduplication of concurrent requests
	sf *singleflight.Group

	// Cache for user permissions, user team memberships and user basic roles
	idCache        *cacheWrap[store.UserIdentifiers]
	permCache      *cacheWrap[map[string]bool]
	teamCache      *cacheWrap[[]int64]
	basicRoleCache *cacheWrap[store.BasicRole]
	folderCache    *cacheWrap[map[string]FolderNode]
}

func NewService(
	sql legacysql.LegacyDatabaseProvider,
	identityStore legacy.LegacyIdentityStore,
	permissionStore store.PermissionStore,
	logger log.Logger,
	tracer tracing.Tracer,
	reg prometheus.Registerer,
	cache cache.Cache,
) *Service {
	return &Service{
		store:           store.NewStore(sql, tracer),
		permissionStore: permissionStore,
		identityStore:   identityStore,
		logger:          logger,
		tracer:          tracer,
		metrics:         newMetrics(reg),
		mapper:          newMapper(),
		idCache:         newCacheWrap[store.UserIdentifiers](cache, logger, longCacheTTL),
		permCache:       newCacheWrap[map[string]bool](cache, logger, shortCacheTTL),
		teamCache:       newCacheWrap[[]int64](cache, logger, shortCacheTTL),
		basicRoleCache:  newCacheWrap[store.BasicRole](cache, logger, longCacheTTL),
		folderCache:     newCacheWrap[map[string]FolderNode](cache, logger, shortCacheTTL),
		sf:              new(singleflight.Group),
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
		s.metrics.requestCount.WithLabelValues("true", "false", req.GetVerb(), req.GetGroup(), req.GetResource()).Inc()
		return deny, err
	}
	ctx = request.WithNamespace(ctx, req.GetNamespace())

	permissions, err := s.getIdentityPermissions(ctx, checkReq.Namespace, checkReq.IdentityType, checkReq.UserUID, checkReq.Action)
	if err != nil {
		ctxLogger.Error("could not get user permissions", "subject", req.GetSubject(), "error", err)
		s.metrics.requestCount.WithLabelValues("true", "true", req.GetVerb(), req.GetGroup(), req.GetResource()).Inc()
		return deny, err
	}

	allowed, err := s.checkPermission(ctx, permissions, checkReq)
	if err != nil {
		ctxLogger.Error("could not check permission", "error", err)
		s.metrics.requestCount.WithLabelValues("true", "true", req.GetVerb(), req.GetGroup(), req.GetResource()).Inc()
		return deny, err
	}

	s.metrics.requestCount.WithLabelValues("false", "true", req.GetVerb(), req.GetGroup(), req.GetResource()).Inc()
	return &authzv1.CheckResponse{Allowed: allowed}, nil
}

func (s *Service) List(ctx context.Context, req *authzv1.ListRequest) (*authzv1.ListResponse, error) {
	ctx, span := s.tracer.Start(ctx, "authz_direct_db.service.List")
	defer span.End()
	ctxLogger := s.logger.FromContext(ctx)

	listReq, err := s.validateListRequest(ctx, req)
	if err != nil {
		ctxLogger.Error("invalid request", "error", err)
		s.metrics.requestCount.WithLabelValues("true", "false", req.GetVerb(), req.GetGroup(), req.GetResource()).Inc()
		return &authzv1.ListResponse{}, err
	}
	ctx = request.WithNamespace(ctx, req.GetNamespace())

	permissions, err := s.getIdentityPermissions(ctx, listReq.Namespace, listReq.IdentityType, listReq.UserUID, listReq.Action)
	if err != nil {
		ctxLogger.Error("could not get user permissions", "subject", req.GetSubject(), "error", err)
		s.metrics.requestCount.WithLabelValues("true", "true", req.GetVerb(), req.GetGroup(), req.GetResource()).Inc()
		return nil, err
	}

	resp, err := s.listPermission(ctx, permissions, listReq)
	s.metrics.requestCount.WithLabelValues(strconv.FormatBool(err != nil), "true", req.GetVerb(), req.GetGroup(), req.GetResource()).Inc()
	return resp, err
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
	authInfo, has := claims.AuthInfoFrom(ctx)
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
	// Permission check currently only checks user, anonymous user, service account and renderer permissions
	if !(identityType == claims.TypeUser || identityType == claims.TypeServiceAccount || identityType == claims.TypeAnonymous || identityType == claims.TypeRenderService) {
		ctxLogger.Error("unsupported identity type", "type", identityType)
		return "", "", status.Error(codes.PermissionDenied, "unsupported identity type")
	}
	return userUID, identityType, nil
}

func (s *Service) validateAction(ctx context.Context, group, resource, verb string) (string, error) {
	ctxLogger := s.logger.FromContext(ctx)

	t, ok := s.mapper.translation(group, resource)
	if !ok {
		ctxLogger.Error("unsupport resource", "group", group, "resource", resource)
		return "", status.Error(codes.NotFound, "unsupported resource")
	}

	action, ok := t.action(verb)
	if !ok {
		ctxLogger.Error("unsupport verb", "group", group, "resource", resource, "verb", verb)
		return "", status.Error(codes.NotFound, "unsupported verb")
	}

	return action, nil
}

func (s *Service) getIdentityPermissions(ctx context.Context, ns claims.NamespaceInfo, idType claims.IdentityType, userID, action string) (map[string]bool, error) {
	ctx, span := s.tracer.Start(ctx, "authz_direct_db.service.getIdentityPermissions")
	defer span.End()

	// When checking folder creation permissions, also check edit and admin action sets for folder, as the scoped folder create actions aren't stored in the DB separately
	var actionSets []string
	if action == "folders:create" {
		actionSets = append(actionSets, "folders:edit")
		actionSets = append(actionSets, "folders:admin")
	}

	switch idType {
	case claims.TypeAnonymous:
		return s.getAnonymousPermissions(ctx, ns, action, actionSets)
	case claims.TypeRenderService:
		return s.getRendererPermissions(ctx, action)
	case claims.TypeUser, claims.TypeServiceAccount:
		return s.getUserPermissions(ctx, ns, userID, action, actionSets)
	default:
		return nil, fmt.Errorf("unsupported identity type: %s", idType)
	}
}

func (s *Service) getUserPermissions(ctx context.Context, ns claims.NamespaceInfo, userID, action string, actionSets []string) (map[string]bool, error) {
	ctx, span := s.tracer.Start(ctx, "authz_direct_db.service.getUserPermissions")
	defer span.End()

	userIdentifiers, err := s.GetUserIdentifiers(ctx, ns, userID)
	if err != nil {
		return nil, err
	}

	userPermKey := userPermCacheKey(ns.Value, userIdentifiers.UID, action)
	if cached, ok := s.permCache.Get(ctx, userPermKey); ok {
		s.metrics.permissionCacheUsage.WithLabelValues("true", action).Inc()
		return cached, nil
	}
	s.metrics.permissionCacheUsage.WithLabelValues("false", action).Inc()

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
			ActionSets:    actionSets,
			TeamIDs:       teamIDs,
			Role:          basicRoles.Role,
			IsServerAdmin: basicRoles.IsAdmin,
		}

		permissions, err := s.permissionStore.GetUserPermissions(ctx, ns, userPermQuery)
		if err != nil {
			return nil, err
		}
		scopeMap := getScopeMap(permissions)

		s.permCache.Set(ctx, userPermKey, scopeMap)
		span.SetAttributes(attribute.Int("num_permissions_fetched", len(permissions)))

		return scopeMap, nil
	})

	if err != nil {
		return nil, err
	}

	return res.(map[string]bool), nil
}

func (s *Service) getAnonymousPermissions(ctx context.Context, ns claims.NamespaceInfo, action string, actionSets []string) (map[string]bool, error) {
	ctx, span := s.tracer.Start(ctx, "authz_direct_db.service.getAnonymousPermissions")
	defer span.End()

	anonPermKey := anonymousPermCacheKey(ns.Value, action)
	if cached, ok := s.permCache.Get(ctx, anonPermKey); ok {
		return cached, nil
	}
	res, err, _ := s.sf.Do(anonPermKey+"_getAnonymousPermissions", func() (interface{}, error) {
		permissions, err := s.permissionStore.GetUserPermissions(ctx, ns, store.PermissionsQuery{Action: action, ActionSets: actionSets, Role: "Viewer"})
		if err != nil {
			return nil, err
		}
		scopeMap := getScopeMap(permissions)
		s.permCache.Set(ctx, anonPermKey, scopeMap)
		return scopeMap, nil
	})

	if err != nil {
		return nil, err
	}

	return res.(map[string]bool), nil
}

// Renderer is granted permissions to read all dashboards and folders, and no other permissions
func (s *Service) getRendererPermissions(ctx context.Context, action string) (map[string]bool, error) {
	_, span := s.tracer.Start(ctx, "authz_direct_db.service.getRendererPermissions")
	defer span.End()

	if action == "dashboards:read" || action == "folders:read" || action == "datasources:read" {
		return map[string]bool{"*": true}, nil
	}
	return map[string]bool{}, nil
}

func (s *Service) GetUserIdentifiers(ctx context.Context, ns claims.NamespaceInfo, userUID string) (*store.UserIdentifiers, error) {
	uidCacheKey := userIdentifierCacheKey(ns.Value, userUID)
	if cached, ok := s.idCache.Get(ctx, uidCacheKey); ok {
		return &cached, nil
	}

	idCacheKey := userIdentifierCacheKeyById(ns.Value, userUID)
	if cached, ok := s.idCache.Get(ctx, idCacheKey); ok {
		return &cached, nil
	}

	var userIDQuery store.UserIdentifierQuery
	// Assume that numeric UID is user ID
	if userID, err := strconv.Atoi(userUID); err == nil {
		userIDQuery = store.UserIdentifierQuery{UserID: int64(userID)}
	} else {
		userIDQuery = store.UserIdentifierQuery{UserUID: userUID}
	}
	userIdentifiers, err := s.store.GetUserIdentifiers(ctx, userIDQuery)
	if err != nil || userIdentifiers == nil {
		return nil, fmt.Errorf("could not get user internal id: %w", err)
	}

	s.idCache.Set(ctx, uidCacheKey, *userIdentifiers)
	s.idCache.Set(ctx, idCacheKey, *userIdentifiers)

	return userIdentifiers, nil
}

func (s *Service) getUserTeams(ctx context.Context, ns claims.NamespaceInfo, userIdentifiers *store.UserIdentifiers) ([]int64, error) {
	ctx, span := s.tracer.Start(ctx, "authz_direct_db.service.getUserTeams")
	defer span.End()

	teamIDs := make([]int64, 0, 50)
	teamsCacheKey := userTeamCacheKey(ns.Value, userIdentifiers.UID)
	if cached, ok := s.teamCache.Get(ctx, teamsCacheKey); ok {
		return cached, nil
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
	s.teamCache.Set(ctx, teamsCacheKey, teamIDs)
	span.SetAttributes(attribute.Int("num_user_teams", len(teamIDs)))

	return teamIDs, nil
}

func (s *Service) getUserBasicRole(ctx context.Context, ns claims.NamespaceInfo, userIdentifiers *store.UserIdentifiers) (store.BasicRole, error) {
	ctx, span := s.tracer.Start(ctx, "authz_direct_db.service.getUserBasicRole")
	defer span.End()

	basicRoleKey := userBasicRoleCacheKey(ns.Value, userIdentifiers.UID)
	if cached, ok := s.basicRoleCache.Get(ctx, basicRoleKey); ok {
		return cached, nil
	}

	basicRole, err := s.store.GetBasicRoles(ctx, ns, store.BasicRoleQuery{UserID: userIdentifiers.ID})
	if err != nil {
		return store.BasicRole{}, fmt.Errorf("could not get basic roles: %w", err)
	}
	if basicRole == nil {
		basicRole = &store.BasicRole{}
	}
	s.basicRoleCache.Set(ctx, basicRoleKey, *basicRole)

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

	t, ok := s.mapper.translation(req.Group, req.Resource)
	if !ok {
		ctxLogger.Error("unsupport resource", "group", req.Group, "resource", req.Resource)
		return false, status.Error(codes.NotFound, "unsupported resource")
	}

	if scopeMap[t.scope(req.Name)] {
		return true, nil
	}

	if !t.folderSupport {
		return false, nil
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
			scope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(node.UID)
			if scopeMap[scope] {
				return true, nil
			}
			if node.ParentUID == nil {
				break
			}
			currentUID = *node.ParentUID
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
	if cached, ok := s.folderCache.Get(ctx, key); ok {
		return cached, nil
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
					UID:       folder.UID,
					ParentUID: folder.ParentUID,
				}
			} else {
				node.ParentUID = folder.ParentUID
				folderMap[folder.UID] = node
			}
			// Register that the parent has this child node
			if folder.ParentUID == nil {
				continue
			}
			if parent, has := folderMap[*folder.ParentUID]; has {
				parent.ChildrenUIDs = append(parent.ChildrenUIDs, folder.UID)
				folderMap[*folder.ParentUID] = parent
			} else {
				folderMap[*folder.ParentUID] = FolderNode{
					UID:          *folder.ParentUID,
					ChildrenUIDs: []string{folder.UID},
				}
			}
		}

		s.folderCache.Set(ctx, key, folderMap)
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

	t, ok := s.mapper.translation(req.Group, req.Resource)
	if !ok {
		ctxLogger.Error("unsupport resource", "group", req.Group, "resource", req.Resource)
		return nil, status.Error(codes.NotFound, "unsupported resource")
	}

	var folderMap map[string]FolderNode
	if t.folderSupport {
		var err error
		folderMap, err = s.buildFolderTree(ctx, req.Namespace)
		if err != nil {
			ctxLogger.Error("could not build folder and dashboard tree", "error", err)
			return nil, err
		}
	}

	folderSet := make(map[string]struct{}, len(scopeMap))

	prefix := t.prefix()
	itemSet := make(map[string]struct{}, len(scopeMap))
	for scope := range scopeMap {
		if strings.HasPrefix(scope, "folders:uid:") {
			identifier := strings.TrimPrefix(scope, "folders:uid:")
			if _, ok := folderSet[identifier]; ok {
				continue
			}
			folderSet[identifier] = struct{}{}
			getChildren(folderMap, identifier, folderSet)
		} else {
			identifier := strings.TrimPrefix(scope, prefix)
			itemSet[identifier] = struct{}{}
		}
	}

	folderList := make([]string, 0, len(folderSet))
	for folder := range folderSet {
		folderList = append(folderList, folder)
	}

	itemList := make([]string, 0, len(itemSet))
	for item := range itemSet {
		itemList = append(itemList, item)
	}

	span.SetAttributes(attribute.Int("num_folders", len(folderList)), attribute.Int("num_items", len(itemList)))
	return &authzv1.ListResponse{Folders: folderList, Items: itemList}, nil
}

func getChildren(folderMap map[string]FolderNode, folderUID string, folderSet map[string]struct{}) {
	folder, has := folderMap[folderUID]
	if !has {
		return
	}
	for _, child := range folder.ChildrenUIDs {
		// We have already processed all the children of this folder
		if _, ok := folderSet[child]; ok {
			return
		}
		folderSet[child] = struct{}{}
		getChildren(folderMap, child, folderSet)
	}
}
