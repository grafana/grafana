package rbac

import (
	"context"
	"errors"
	"fmt"
	"slices"

	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/rbac/store"
	"github.com/grafana/grafana/pkg/services/folder"
)

type legacyGlobalIdentity struct {
	requester identity.StaticRequester
}

type legacyGlobalPermissionLoader interface {
	GetGlobalUserPermissions(context.Context, identity.Requester, []string) (map[string][]string, error)
}

func (s *Service) validateLegacyGlobalEvaluation(
	global *authzextv1.LegacyGlobalEvaluation,
	req legacyScopeRequest,
) error {
	if global.GetRequesterOrgId() != accesscontrol.NoOrgID && global.GetRequesterOrgId() != accesscontrol.GlobalOrgID {
		return errors.New("global evaluation requires requester org 0 or NoOrgID")
	}

	// Global org zero belongs to an instance, not a cross-tenant namespace.
	// Standalone AuthZ needs an explicit provider for that instance boundary.
	if req.namespace.OrgID < 1 || s.legacyScopeNamespace == nil || s.legacyScopeNamespace(req.namespace.OrgID) != req.namespace.Value {
		return errors.New("global evaluation requires a namespace belonging to the embedded instance")
	}

	if !types.IsIdentityType(req.identityType, types.TypeUser, types.TypeServiceAccount) {
		return errors.New("global evaluation requires a user or service account")
	}

	return nil
}

func (s *Service) getLegacyGlobalIdentity(
	ctx context.Context,
	req legacyScopeRequest,
	requesterOrgID int64,
) (*legacyGlobalIdentity, error) {
	identifiers, err := s.getUserIdentifiers(ctx, req.namespace, req.userUID, req.skipCache)
	if err != nil {
		return nil, fmt.Errorf("could not get global user identifiers: %w", err)
	}

	globalNamespace := req.namespace
	globalNamespace.OrgID = accesscontrol.GlobalOrgID

	// The organization-role cache is keyed by transport namespace. Read admin
	// state directly so a global lookup cannot reuse or overwrite an org role.
	role, err := s.store.GetBasicRoles(ctx, globalNamespace, store.BasicRoleQuery{UserID: identifiers.ID})
	if err != nil {
		return nil, fmt.Errorf("could not get global user admin state: %w", err)
	}
	if role == nil {
		return nil, errors.New("global user admin state is missing")
	}

	return &legacyGlobalIdentity{
		requester: identity.StaticRequester{
			Type:           req.identityType,
			UserID:         identifiers.ID,
			UserUID:        identifiers.UID,
			OrgID:          requesterOrgID,
			OrgRole:        identity.RoleNone,
			IsGrafanaAdmin: role.IsAdmin,
			Namespace:      req.namespace.Value,
			CacheKey:       fmt.Sprintf("%s:global:%d:%s", req.namespace.Value, requesterOrgID, types.NewTypeID(req.identityType, identifiers.UID)),
		},
	}, nil
}

func (s *Service) getLegacyGlobalPermissions(
	ctx context.Context,
	checkedIdentity *legacyGlobalIdentity,
	actions []string,
) (map[string][]string, error) {
	loader, ok := s.userPermissionsEvaluator.(legacyGlobalPermissionLoader)
	if !ok {
		return nil, errors.New("filtered global permission loader is not configured")
	}

	// Preserve the tenant namespace while selecting global assignment rules.
	// The original requester org is retained for resolver callbacks.
	requester := checkedIdentity.requester
	requester.OrgID = accesscontrol.GlobalOrgID

	permissions, err := loader.GetGlobalUserPermissions(ctx, &requester, actions)
	if err != nil {
		return nil, fmt.Errorf("could not get global user permissions: %w", err)
	}

	return permissions, nil
}

func (s *Service) legacyGlobalResolverRequester(
	ctx context.Context,
	req legacyScopeRequest,
	permissions map[string][]string,
) (identity.Requester, error) {
	requester := req.globalIdentity.requester
	grants := make(map[string][]string, len(permissions)+1)
	for action, scopes := range permissions {
		grants[action] = slices.Clone(scopes)
	}

	// Library-panel resolution can perform folder visibility checks as the
	// subject. Load that action explicitly instead of fetching a full snapshot.
	//
	// TODO: in the follow-up PRs (of this task https://github.com/grafana/identity-access-team/issues/2436)
	// we will need to address the issue that ALL resolvers load folder.ActionFoldersRead
	// even when the resolver does not need it (f.e. datasources)
	if _, ok := grants[folder.ActionFoldersRead]; !ok {
		additional, err := s.getLegacyGlobalPermissions(ctx, req.globalIdentity, []string{folder.ActionFoldersRead})
		if err != nil {
			return nil, err
		}
		grants[folder.ActionFoldersRead] = additional[folder.ActionFoldersRead]
	}

	requester.Permissions = map[int64]map[string][]string{accesscontrol.GlobalOrgID: grants}

	return &requester, nil
}

func (s *Service) prepareLegacyGlobalEvaluation(
	ctx context.Context,
	global *authzextv1.LegacyGlobalEvaluation,
	actions []string,
	scopeRequest legacyScopeRequest,
) (legacyEvaluationArgs, error) {
	if err := s.validateLegacyGlobalEvaluation(global, scopeRequest); err != nil {
		return legacyEvaluationArgs{}, err
	}

	// NoOrgID selects Permissions[0], not Permissions[-1]. Loading grants must
	// not turn an absent or empty global map into an allowed empty ALL expression.
	if !global.GetHasPermissions() {
		return legacyEvaluationArgs{hasAnyPermissions: false, scopeRequest: scopeRequest}, nil
	}

	checkedIdentity, err := s.getLegacyGlobalIdentity(ctx, scopeRequest, global.GetRequesterOrgId())
	if err != nil {
		return legacyEvaluationArgs{}, err
	}

	permissions, err := s.getLegacyGlobalPermissions(ctx, checkedIdentity, actions)
	if err != nil {
		return legacyEvaluationArgs{}, err
	}

	scopeRequest.globalIdentity = checkedIdentity

	// Global loading includes SharedWithMe, so the full effective set remains
	// nonempty even when none of the requested actions has a matching grant.
	return legacyEvaluationArgs{
		permissions:       permissions,
		hasAnyPermissions: true,
		scopeRequest:      scopeRequest,
	}, nil
}
