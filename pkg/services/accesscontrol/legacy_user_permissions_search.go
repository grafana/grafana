package accesscontrol

import (
	"context"
	"fmt"
	"slices"

	"github.com/go-jose/go-jose/v4/jwt"
	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

const LegacyUserPermissionsSearchGrant = "authz.grafana.app/legacyuserpermissions:search"

func LegacyUserPermissionsSearchEnabled(ctx context.Context) bool {
	return openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagAuthzUserPermissionsSearch, false, openfeature.TransactionContext(ctx))
}

func LegacySearchPermissionCaller(namespace string) types.AuthInfo {
	return authnlib.NewAccessTokenAuthInfo(authnlib.Claims[authnlib.AccessTokenClaims]{
		Claims: jwt.Claims{Subject: "access-policy:embedded-grafana"},
		Rest:   authnlib.AccessTokenClaims{Namespace: namespace, Permissions: []string{LegacyUserPermissionsGrant, LegacyUserPermissionsSearchGrant}},
	})
}

func GetLegacySearchUsersPermissions(ctx context.Context, client legacyclient.SearchService, caller identity.Requester, options SearchOptions, cfg *setting.Cfg) (map[int64][]Permission, error) {
	if client == nil {
		return nil, fmt.Errorf("embedded legacy AuthZ search client is not configured")
	}
	originalNamespace := caller.GetNamespace()
	namespace := originalNamespace
	if namespace == "" {
		if cfg.StackID != "" {
			namespace = "stacks-" + cfg.StackID
		} else {
			namespace = types.OrgNamespaceFormatter(caller.GetOrgID())
		}
	}
	ns, err := types.ParseNamespace(namespace)
	if err != nil || ns.OrgID < 1 || ns.OrgID != caller.GetOrgID() {
		return nil, fmt.Errorf("legacy search namespace does not match evaluation organization")
	}
	var internalID *int64
	if id, err := caller.GetInternalID(); err == nil {
		internalID = &id
	}
	cacheKey := caller.GetCacheKey()
	groups := caller.GetGroups()
	if cfg.IDUseExternalGroupsForGroupsClaim {
		groups = caller.GetExternalGroups()
	}
	response, err := client.LegacySearchUsersPermissions(ctx, LegacySearchPermissionCaller(namespace), legacyclient.LegacySearchUsersPermissionsRequest{
		Namespace: namespace, Action: options.Action, ActionPrefix: options.ActionPrefix, Scope: options.Scope, UserID: options.UserID,
		Caller: legacyclient.LegacyPermissionIdentity{
			Type: caller.GetIdentityType(), UID: caller.GetIdentifier(), InternalID: internalID,
			HasUniqueID: caller.HasUniqueId(), OrgRole: string(caller.GetOrgRole()), IsGrafanaAdmin: caller.GetIsGrafanaAdmin(),
			TeamIDs: slices.Clone(caller.GetTeams()), Groups: slices.Clone(groups), CacheKey: &cacheKey,
			RequesterNamespace: &originalNamespace,
		},
	})
	if err != nil {
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		return nil, err
	}
	permissions := make(map[int64][]Permission, len(response.Permissions))
	for id, grants := range response.Permissions {
		permissions[id] = make([]Permission, len(grants))
		for i, grant := range grants {
			permissions[id][i] = Permission{Action: grant.Action, Scope: grant.Scope}
		}
	}
	return permissions, nil
}
