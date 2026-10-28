package legacypermissions

import (
	"context"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	authzv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/user"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/rbac/store"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

func (l *Loader) WithSearchPermissionStore(searchStore store.SearchPermissionStore) *Loader {
	l.search.store = searchStore
	return l
}

func newLoaderSearchService(loader *Loader) *LegacySearchService {
	staticRoles := func(context.Context) map[string]*ac.RoleDTO {
		roles := ac.BuildBasicRoleDefinitions()
		for name, role := range roles {
			role.Permissions = loader.catalog.Permissions(name)
		}
		return roles
	}
	search := NewLegacySearchService(store.NewSQLPermissionStore(legacysql.NewDatabaseProvider(loader.store.sql), tracer, false), staticRoles, loader.actions)
	search.enforcementEnabled = func() bool { return loader.license.FeatureEnabled("accesscontrol.enforcement") }
	search.callerPermissions = func(ctx context.Context, ns types.NamespaceInfo, assertion *authzv1.LegacyPermissionIdentity, enforced bool) ([]ac.Permission, error) {
		caller := searchRequester(ns, assertion, nil)
		permissions, err := loader.uncached(ctx, caller, loadSettings{
			enforcementEnabled: enforced,
			//nolint:staticcheck // Preserve the existing legacy enumeration setting.
			excludeRedundantManagedPermissions: loader.features.IsEnabledGlobally(featuremgmt.FlagExcludeRedundantManagedPermissions),
		})
		if err != nil || loader.zanzana == nil || (!enforced && loader.license.Edition() != licensing.OpenSourceEdition) {
			return permissions, err
		}
		migrated, err := loader.zanzana.ResolveCurrentUserPermissions(ctx, caller)
		if err != nil {
			loader.log.Warn("could not get zanzana caller permissions, using legacy only", "error", err)
			return permissions, nil
		}
		return MergeUserPermissions(permissions, migrated), nil
	}
	if loader.zanzana != nil {
		search.mergePermissions = func(ctx context.Context, caller identity.Requester, options ac.SearchOptions, legacy map[int64][]ac.Permission, enforced bool) map[int64][]ac.Permission {
			if !enforced && loader.license.Edition() != licensing.OpenSourceEdition {
				return legacy
			}
			migrated, err := loader.zanzana.SearchUsersPermissions(ctx, caller, caller.GetOrgID(), options)
			if err != nil {
				loader.log.Warn("could not get zanzana search permissions, using legacy only", "error", err)
				return legacy
			}
			return MergePermissions(legacy, migrated)
		}
	}
	return search
}

func searchRequester(ns types.NamespaceInfo, assertion *authzv1.LegacyPermissionIdentity, permissions []ac.Permission) *legacyRequester {
	namespace := ns.Value
	if assertion.RequesterNamespace != nil {
		namespace = *assertion.RequesterNamespace
	}
	caller := &legacyRequester{
		SignedInUser: &user.SignedInUser{
			OrgID: ns.OrgID, UserUID: assertion.Uid,
			Namespace: namespace, IsServiceAccount: types.IdentityType(assertion.Type) == types.TypeServiceAccount,
			OrgRole:        identity.RoleType(assertion.OrgRole),
			IsGrafanaAdmin: assertion.IsGrafanaAdmin,
			TeamIDs:        assertion.TeamIds, //nolint:staticcheck // Numeric legacy RBAC memberships remain distinct from contextual groups.
			TeamUIDs:       assertion.Groups,
			ExternalGroups: assertion.Groups,
			Permissions:    map[int64]map[string][]string{ns.OrgID: ac.Reduce(permissions)},
		},
		identity: assertion, namespace: namespace,
	}
	switch types.IdentityType(assertion.Type) {
	case types.TypeUser, types.TypeServiceAccount:
		caller.UserID = assertion.GetInternalId()
	case types.TypeAnonymous:
		caller.IsAnonymous = true
	case types.TypeRenderService:
		caller.AuthenticatedBy = "render"
	case types.TypeAPIKey:
		caller.ApiKeyID = assertion.GetInternalId()
	default:
		caller.FallbackType = types.IdentityType(assertion.Type)
	}
	return caller
}
