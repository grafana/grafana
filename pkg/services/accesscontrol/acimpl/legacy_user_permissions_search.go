package acimpl

import (
	"context"
	"fmt"
	"slices"

	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/legacyscopes"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

func LegacyUserPermissionsSearchEnabled(ctx context.Context) bool {
	return openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagAuthzLegacyUserPermissionsSearch, false, openfeature.TransactionContext(ctx))
}

func GetLegacySearchUsersPermissions(ctx context.Context, client legacyclient.LegacyUserPermissionsClient, caller identity.Requester, options ac.SearchOptions, cfg *setting.Cfg) (map[int64][]ac.Permission, error) {
	if client == nil {
		return nil, fmt.Errorf("embedded legacy AuthZ search client is not configured")
	}
	originalNamespace := caller.GetNamespace()
	namespace := legacyscopes.PermissionNamespace(ctx, caller)
	if originalNamespace == "" && cfg != nil && cfg.StackID != "" {
		namespace = legacyscopes.StackNamespace(cfg.StackID)
	}
	var internalID *int64
	if id, err := caller.GetInternalID(); err == nil {
		internalID = &id
	}
	cacheKey := caller.GetCacheKey()
	directoryContext, _ := ctxkey.Get(ctx).(*contextmodel.ReqContext)
	response, err := client.LegacySearchUsersPermissions(ctx, legacypermissions.LegacySearchPermissionCaller(namespace), legacyclient.LegacySearchUsersPermissionsRequest{
		Namespace: namespace,
		Options:   options,
		Requester: legacyclient.LegacySearchRequester{
			Identity: legacyclient.LegacyPermissionIdentity{
				Type: caller.GetIdentityType(), UID: caller.GetIdentifier(), InternalID: internalID,
				HasUniqueID: caller.HasUniqueId(), OrgRole: string(caller.GetOrgRole()), IsGrafanaAdmin: caller.GetIsGrafanaAdmin(),
				TeamIDs: slices.Clone(caller.GetTeams()), Groups: slices.Clone(caller.GetGroups()), CacheKey: &cacheKey,
				RequesterNamespace: &originalNamespace,
			},
			OrgID:                caller.GetOrgID(),
			EffectivePermissions: caller.GetPermissions(),
			GlobalPermissions:    caller.GetGlobalPermissions(),
			ExternalGroups:       slices.Clone(caller.GetExternalGroups()),
			HasDirectoryContext:  directoryContext != nil,
			IAMIDToken:           caller.GetIDToken(),
			IAMAccessToken:       caller.GetAccessToken(),
			Username:             caller.GetUsername(),
			Name:                 caller.GetName(),
		},
	})
	return response.Permissions, err
}
