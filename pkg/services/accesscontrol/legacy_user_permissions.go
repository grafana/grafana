package accesscontrol

import (
	"context"
	"fmt"
	"slices"

	"github.com/go-jose/go-jose/v4/jwt"
	authnlib "github.com/grafana/authlib/authn"
	authlib "github.com/grafana/authlib/types"
	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

const LegacyUserPermissionsGrant = "authz.grafana.app/legacyuserpermissions:get"

func LegacyUserPermissionsEnabled(ctx context.Context) bool {
	return openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagAuthzLegacyUserPermissions, false, openfeature.TransactionContext(ctx))
}

// LegacyPermissionCaller represents only the trusted in-process Grafana service,
// never the user whose permissions are being enumerated.
func LegacyPermissionCaller(namespace string) authlib.AuthInfo {
	return authnlib.NewAccessTokenAuthInfo(authnlib.Claims[authnlib.AccessTokenClaims]{
		Claims: jwt.Claims{Subject: "access-policy:embedded-grafana"},
		Rest:   authnlib.AccessTokenClaims{Namespace: namespace, Permissions: []string{LegacyUserPermissionsGrant}},
	})
}

func GetLegacyUserPermissions(ctx context.Context, client authlib.LegacyAuthzService, usr identity.Requester, options Options, cfg *setting.Cfg) ([]Permission, error) {
	if client == nil {
		return nil, fmt.Errorf("embedded legacy AuthZ client is not configured")
	}
	originalNamespace, cacheKey := usr.GetNamespace(), usr.GetCacheKey()
	namespace := originalNamespace
	global := usr.GetOrgID() == GlobalOrgID
	if namespace == "" {
		if cfg.StackID != "" {
			namespace = "stacks-" + cfg.StackID
		} else {
			orgID := usr.GetOrgID()
			if global {
				orgID = 1
			}
			namespace = authlib.OrgNamespaceFormatter(orgID)
		}
	}
	ns, err := authlib.ParseNamespace(namespace)
	if err != nil || ns.OrgID < 1 || (!global && ns.OrgID != usr.GetOrgID()) {
		return nil, fmt.Errorf("legacy permission namespace does not match evaluation organization")
	}
	var internalID *int64
	if id, err := usr.GetInternalID(); err == nil {
		internalID = &id
	}
	groups := usr.GetGroups()
	if cfg.IDUseExternalGroupsForGroupsClaim {
		groups = usr.GetExternalGroups()
	}
	response, err := client.LegacyGetUserPermissions(ctx, LegacyPermissionCaller(namespace), authlib.LegacyGetUserPermissionsRequest{
		Namespace: namespace, GlobalOrg: global, ReloadCache: options.ReloadCache, SkipZanzanaCache: options.SkipZanzanaCache,
		Identity: authlib.LegacyPermissionIdentity{
			Type: usr.GetIdentityType(), UID: usr.GetIdentifier(), InternalID: internalID,
			HasUniqueID: usr.HasUniqueId(), OrgRole: string(usr.GetOrgRole()), IsGrafanaAdmin: usr.GetIsGrafanaAdmin(),
			TeamIDs: slices.Clone(usr.GetTeams()), Groups: slices.Clone(groups),
			CacheKey: &cacheKey, RequesterNamespace: &originalNamespace,
		},
	})
	if err != nil {
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		return nil, err
	}
	permissions := make([]Permission, len(response.Permissions))
	for i, p := range response.Permissions {
		permissions[i] = Permission{Action: p.Action, Scope: p.Scope}
	}
	return permissions, nil
}
