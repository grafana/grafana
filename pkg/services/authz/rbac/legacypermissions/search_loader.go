package legacypermissions

import (
	"context"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	authzv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/rbac/store"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

type LoaderOption func(*Loader)

func WithSearchPermissionStore(searchStore store.SearchPermissionStore) LoaderOption {
	return func(loader *Loader) { loader.search.store = searchStore }
}

func newLoaderSearchService(loader *Loader) *LegacySearchService {
	staticRoles := func(context.Context) map[string]*ac.RoleDTO {
		roles := ac.BuildBasicRoleDefinitions()
		for name, role := range roles {
			role.Permissions = loader.catalog.Permissions(name)
		}
		return roles
	}
	search := NewLegacySearchService(store.NewSQLPermissionStore(legacysql.NewDatabaseProvider(loader.store.sql), tracer), staticRoles, loader.actions, loader.cache)
	search.enforcementEnabled = func() bool { return loader.license.FeatureEnabled("accesscontrol.enforcement") }
	search.callerPermissions = func(ctx context.Context, ns types.NamespaceInfo, assertion *authzv1.LegacyPermissionIdentity, enforced bool) ([]ac.Permission, error) {
		namespace := ns.Value
		if assertion.RequesterNamespace != nil {
			namespace = *assertion.RequesterNamespace
		}
		caller := &legacyRequester{
			SignedInUser: &user.SignedInUser{OrgID: ns.OrgID, OrgRole: identity.RoleType(assertion.OrgRole), IsGrafanaAdmin: assertion.IsGrafanaAdmin, TeamIDs: assertion.TeamIds}, //nolint:staticcheck // Numeric legacy RBAC memberships remain distinct from contextual groups.
			identity:     assertion, namespace: namespace,
		}
		permissions, err := loader.uncached(ctx, caller, loadSettings{
			enforcementEnabled: enforced,
			//nolint:staticcheck // Preserve the existing legacy enumeration setting.
			excludeRedundantManagedPermissions: loader.features.IsEnabledGlobally(featuremgmt.FlagExcludeRedundantManagedPermissions),
		})
		if err != nil || loader.zanzana == nil {
			return permissions, err
		}
		migrated, err := loader.zanzana.ResolveCurrentUserPermissions(ctx, caller)
		if err != nil {
			loader.log.Warn("could not get zanzana caller permissions, using legacy only", "error", err)
			return permissions, nil
		}
		return MergeUserPermissions(permissions, migrated), nil
	}
	return search
}
