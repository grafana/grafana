package legacypermissions

import (
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/restcfg"
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/legacyscopes"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideLoader(sql db.DB, catalog *RoleCatalog, actions ac.ActionResolver,
	cache *localcache.CacheService, cfg *setting.Cfg, features featuremgmt.FeatureToggles,
	license licensing.Licensing, zanzanaClient zanzana.Client, restConfig restcfg.RestConfigProvider,
) *Loader {
	var migrated MigratedPermissions
	// Preserve the independent enumeration-merge gate, not the Check/List engine selection.
	//nolint:staticcheck // The existing merge toggle is not migrated by this rollout.
	if features.IsEnabledGlobally(featuremgmt.FlagZanzanaMergeUserPermissions) && zanzanaClient != nil {
		// Current-user enumeration does not use the user service; only the out-of-scope
		// search methods need it. The REST client remains lazy to avoid an apiserver cycle.
		migrated = NewZanzanaPermissionResolver(zanzanaClient, nil, restConfig, cfg.IDUseExternalGroupsForGroupsClaim)
	}
	loader := NewLoader(sql, catalog, actions, cache, cfg, features, license, migrated)
	loader.scopeResolver = NewPermissionScopeResolver(features, restConfig)
	return loader
}

func ProvideClient(loader *Loader, cfg *setting.Cfg) legacyclient.Service {
	return NewEmbeddedClient(loader, cfg)
}

func NewPermissionScopeResolver(features featuremgmt.FeatureToggles, restConfig restcfg.RestConfigProvider) legacyscopes.ScopeResolver {
	//nolint:staticcheck // Scope aliases follow the existing enumeration merge rollout.
	if features == nil || !features.IsEnabledGlobally(featuremgmt.FlagZanzanaMergeUserPermissions) {
		return nil
	}
	return legacyscopes.NewUIDResolver(restConfig)
}
