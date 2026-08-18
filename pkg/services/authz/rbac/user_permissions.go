package rbac

import (
	"context"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"k8s.io/apiserver/pkg/endpoints/request"

	authzlib "github.com/grafana/authlib/authz"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/rbac/store"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/user"
)

const userPermissionsChunkSize = 1000

func (s *Service) GetUserPermissions(req *authzv1.GetUserPermissionsRequest, stream authzv1.AuthzService_GetUserPermissionsServer) error {
	ctx, span := s.tracer.Start(stream.Context(), "authz_direct_db.service.GetUserPermissions")
	defer span.End()

	ns, err := validateNamespace(ctx, req.GetNamespace())
	if err != nil {
		return err
	}
	authInfo, ok := types.AuthInfoFrom(ctx)
	if !ok {
		return status.Error(codes.Internal, "could not get auth info from context")
	}
	if !authzlib.CheckServicePermissions(authInfo, "authz.grafana.app", "userpermissions", "get").Allowed {
		return status.Error(codes.PermissionDenied, "user permissions request denied")
	}

	userUID, identityType, err := s.validateSubject(ctx, req.GetSubject())
	if err != nil {
		return err
	}
	ctx = request.WithNamespace(ctx, ns.Value)

	permissions, evaluated, err := s.getAllIdentityPermissions(ctx, ns, identityType, userUID, req.GetTeams(), req.GetOptions().GetSkipcache())
	if err != nil {
		return err
	}
	if !evaluated {
		if s.actionResolver != nil {
			permissions = s.actionResolver.ExpandActionSets(permissions)
		}
		permissions = append(permissions, accesscontrol.Permission{
			Action: folder.ActionFoldersRead,
			Scope:  folder.ScopeFoldersProvider.GetResourceScopeUID(folder.SharedWithMeFolderUID),
		})
	}
	permissions = deduplicateUserPermissions(permissions)

	protoPermissions := make([]*authzv1.UserPermission, 0, len(permissions))
	for _, permission := range permissions {
		protoPermissions = append(protoPermissions, &authzv1.UserPermission{
			Action: permission.Action,
			Scope:  permission.Scope,
		})
	}

	for start := 0; start < len(protoPermissions); start += userPermissionsChunkSize {
		end := min(start+userPermissionsChunkSize, len(protoPermissions))
		if err := stream.Send(&authzv1.GetUserPermissionsResponse{
			Permissions: protoPermissions[start:end],
		}); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) mergeZanzanaUserPermissions(ctx context.Context, requester identity.Requester, permissions []accesscontrol.Permission) []accesscontrol.Permission {
	if s.userPermissionsResolver == nil {
		return permissions
	}
	zanzanaPermissions, err := s.userPermissionsResolver.ResolveCurrentUserPermissions(ctx, requester)
	if err != nil {
		s.logger.Warn("could not get zanzana user permissions, using legacy only", "error", err)
		return permissions
	}
	return append(permissions, zanzanaPermissions...)
}

func deduplicateUserPermissions(permissions []accesscontrol.Permission) []accesscontrol.Permission {
	type key struct {
		action string
		scope  string
	}

	seen := make(map[key]struct{}, len(permissions))
	result := make([]accesscontrol.Permission, 0, len(permissions))
	for _, permission := range permissions {
		permissionKey := key{action: permission.Action, scope: permission.Scope}
		if _, ok := seen[permissionKey]; ok {
			continue
		}
		seen[permissionKey] = struct{}{}
		result = append(result, permission)
	}
	return result
}

func (s *Service) getAllIdentityPermissions(ctx context.Context, ns types.NamespaceInfo, identityType types.IdentityType, userUID string, contextualTeams []string, skipCache bool) ([]accesscontrol.Permission, bool, error) {
	switch identityType {
	case types.TypeUser, types.TypeServiceAccount:
		identifiers, err := s.getUserIdentifiers(ctx, ns, userUID, skipCache)
		if err != nil {
			return nil, false, err
		}
		basicRole, err := s.getUserBasicRoleWithCache(ctx, ns, identifiers, skipCache)
		if err != nil {
			return nil, false, err
		}
		teamIDs, err := s.getUserTeamsWithCache(ctx, ns, identifiers, skipCache)
		if err != nil {
			return nil, false, err
		}
		requester := &user.SignedInUser{
			UserID:           identifiers.ID,
			UserUID:          identifiers.UID,
			OrgID:            ns.OrgID,
			OrgRole:          identity.RoleType(basicRole.Role),
			Namespace:        ns.Value,
			IsGrafanaAdmin:   basicRole.IsAdmin,
			IsServiceAccount: identityType == types.TypeServiceAccount,
			TeamIDs:          teamIDs,
			TeamUIDs:         contextualTeams,
			ExternalGroups:   contextualTeams,
		}
		if s.userPermissionsEvaluator != nil {
			permissions, err := s.userPermissionsEvaluator.GetLocalUserPermissions(ctx, requester, accesscontrol.Options{
				ReloadCache:      skipCache,
				SkipZanzanaCache: true,
			})
			return permissions, true, err
		}
		permissions, err := s.permissionStore.GetUserPermissions(ctx, ns, store.PermissionsQuery{
			UserID:        identifiers.ID,
			TeamIDs:       teamIDs,
			Role:          basicRole.Role,
			IsServerAdmin: basicRole.IsAdmin,
		})
		if err != nil {
			return nil, false, err
		}
		permissions = s.mergeZanzanaUserPermissions(ctx, requester, permissions)
		return permissions, false, nil
	case types.TypeAnonymous:
		requester := &user.SignedInUser{
			OrgID:          ns.OrgID,
			OrgRole:        identity.RoleType(s.settings.AnonOrgRole),
			Namespace:      ns.Value,
			IsAnonymous:    true,
			TeamUIDs:       contextualTeams,
			ExternalGroups: contextualTeams,
		}
		if s.userPermissionsEvaluator != nil {
			permissions, err := s.userPermissionsEvaluator.GetLocalUserPermissions(ctx, requester, accesscontrol.Options{
				ReloadCache:      skipCache,
				SkipZanzanaCache: true,
			})
			return permissions, true, err
		}
		permissions, err := s.permissionStore.GetUserPermissions(ctx, ns, store.PermissionsQuery{Role: s.settings.AnonOrgRole})
		if err != nil {
			return nil, false, err
		}
		return s.mergeZanzanaUserPermissions(ctx, requester, permissions), false, nil
	case types.TypeRenderService:
		return []accesscontrol.Permission{
			{Action: "dashboards:read", Scope: "*"},
			{Action: "folders:read", Scope: "*"},
			{Action: "datasources:read", Scope: "*"},
			{Action: "datasources:query", Scope: "*"},
			{Action: "plugins.metas:read", Scope: "*"},
		}, false, nil
	default:
		return nil, false, status.Error(codes.PermissionDenied, "unsupported identity type")
	}
}
