package acimpl

import (
	"context"
	"errors"
	"fmt"
	"slices"

	authlib "github.com/grafana/authlib/types"
	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

func LegacyUserPermissionsEnabled(ctx context.Context) bool {
	return openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagAuthzLegacyUserPermissions, false, openfeature.TransactionContext(ctx))
}

func GetLegacyUserPermissions(ctx context.Context, client legacyclient.Service, usr identity.Requester, options ac.Options, cfg *setting.Cfg) (permissions []ac.Permission, err error) {
	ctx, span := tracer.Start(ctx, "accesscontrol.GetLegacyUserPermissions")
	defer func() {
		if err != nil {
			span.RecordError(err)
		}
		span.End()
	}()

	if client == nil {
		return nil, fmt.Errorf("embedded legacy AuthZ client is not configured")
	}
	originalNamespace, cacheKey := usr.GetNamespace(), usr.GetCacheKey()
	namespace := originalNamespace
	global := usr.GetOrgID() == ac.GlobalOrgID
	noOrgMembership := usr.GetOrgID() == -1
	// Self-managed global and missing-membership namespaces are requester state,
	// not transport tenants. Preserve them in Identity using an instance anchor.
	if (global || noOrgMembership) && cfg.StackID == "" && namespace == authlib.OrgNamespaceFormatter(usr.GetOrgID()) {
		namespace = ""
	}
	if namespace == "" {
		if cfg.StackID != "" {
			namespace = "stacks-" + cfg.StackID
		} else {
			orgID := usr.GetOrgID()
			if global || noOrgMembership {
				orgID = 1
			}
			namespace = authlib.OrgNamespaceFormatter(orgID)
		}
	}
	ns, err := authlib.ParseNamespace(namespace)
	if err != nil || ns.OrgID < 1 || (!global && !noOrgMembership && ns.OrgID != usr.GetOrgID()) {
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
	response, err := client.LegacyGetUserPermissions(ctx, legacypermissions.LegacyPermissionCaller(namespace), legacyclient.LegacyGetUserPermissionsRequest{
		Namespace:        namespace,
		GlobalOrg:        global,
		NoOrgMembership:  noOrgMembership,
		ReloadCache:      options.ReloadCache,
		SkipZanzanaCache: options.SkipZanzanaCache,
		Identity: legacyclient.LegacyPermissionIdentity{
			Type: usr.GetIdentityType(), UID: usr.GetIdentifier(), InternalID: internalID,
			HasUniqueID: usr.HasUniqueId(), OrgRole: string(usr.GetOrgRole()), IsGrafanaAdmin: usr.GetIsGrafanaAdmin(),
			TeamIDs: slices.Clone(usr.GetTeams()), Groups: slices.Clone(groups),
			CacheKey: &cacheKey, RequesterNamespace: &originalNamespace,
		},
	})
	if err != nil {
		return nil, errors.Join(ctx.Err(), err)
	}
	permissions = make([]ac.Permission, len(response.Permissions))
	for i, p := range response.Permissions {
		permissions[i] = ac.Permission{Action: p.Action, Scope: p.Scope}
	}
	return permissions, nil
}
